"use client";
// The ONLY client session adapter. It never decides how much time exists: it shows
// a countdown derived from server snapshots, renews the lease (carrying idempotent
// telemetry checkpoints), persists scans, and fails closed.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountSnapshot, SessionPolicy, TelemetryInput } from "@/shared/contracts";
import type { DestinationId } from "@/config/destinations";
import type { PoseStore } from "@/components/exploration/pose";

export type ExplorationState =
  | "LOADING_ACCOUNT"
  | "IDLE" // no active session; may Start if this destination has time
  | "RECOVERABLE" // an active session for THIS destination exists (refresh / other tab)
  | "OTHER_ACTIVE" // an active session exists for ANOTHER destination
  | "STARTING"
  | "ACTIVE"
  | "CONNECTION_LOST"
  | "ENDING"
  | "ENDED"
  | "EXPIRED"
  | "ERROR";

interface Controller {
  sessionId: string;
  token: string;
  generation: number;
}

interface Anchor {
  perf: number;
  balanceMs: number;
  authMs: number;
}

interface Segment {
  id: string;
  baseDist: number;
  baseMs: number;
  ackedDist: number;
}

const STORE_KEY = "lunara.controller";
const PENDING_START_KEY = "lunara.pendingStart";

function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

type ApiErr = Error & { code?: string; status?: number };

async function api<T>(path: string, body?: unknown, keepalive = false): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    keepalive,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.error?.message ?? `HTTP ${res.status}`) as ApiErr;
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json as T;
}

export function useExplorationSession(destination: DestinationId, pose: PoseStore) {
  const [state, setState] = useState<ExplorationState>("LOADING_ACCOUNT");
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [policy, setPolicy] = useState<SessionPolicy>({ heartbeatMs: 5000, leaseMs: 15000 });
  const [message, setMessage] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [lowTimeWarned, setLowTimeWarned] = useState(false);
  const [savedSites, setSavedSites] = useState<ReadonlySet<string>>(new Set());
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  const stateRef = useRef<ExplorationState>("LOADING_ACCOUNT");
  const controller = useRef<Controller | null>(null);
  const anchor = useRef<Anchor | null>(null);
  const segment = useRef<Segment | null>(null);
  const serverDistance = useRef(0);
  const seq = useRef(0);
  const inFlight = useRef(false);

  const go = useCallback((s: ExplorationState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const newSegment = useCallback(() => {
    segment.current = { id: crypto.randomUUID(), baseDist: pose.distance, baseMs: pose.activeMs, ackedDist: 0 };
  }, [pose]);

  const telemetry = useCallback((): TelemetryInput | undefined => {
    const seg = segment.current;
    if (!seg || !pose.ready) return undefined;
    return {
      segment: seg.id,
      dist: Math.max(0, pose.distance - seg.baseDist),
      ms: Math.max(0, Math.round(pose.activeMs - seg.baseMs)),
      x: pose.x,
      z: pose.z,
      heading: pose.yaw,
    };
  }, [pose]);

  const applySnapshot = useCallback(
    (snap: AccountSnapshot, t0: number) => {
      const t1 = performance.now();
      setSnapshot(snap);
      const s = snap.session;
      if (s && s.destinationId === destination) {
        serverDistance.current = s.distanceMu;
        setSavedSites((prev) => (s.scannedSites.every((x) => prev.has(x)) ? prev : new Set([...prev, ...s.scannedSites])));
      }
      const ctl = controller.current;
      if (ctl && s && s.id === ctl.sessionId && s.controllerGeneration !== ctl.generation) {
        controller.current = null;
        anchor.current = null;
        go("RECOVERABLE");
        setMessage("This session was taken over by another tab.");
        return;
      }
      if (s && s.status === "ACTIVE" && ctl && s.id === ctl.sessionId && s.authorizedUntil != null) {
        anchor.current = {
          perf: t1,
          balanceMs: snap.balanceMs - (t1 - t0),
          authMs: s.authorizedUntil - snap.serverNow - (t1 - t0),
        };
        setRemainingMs(Math.max(0, anchor.current.balanceMs));
        return;
      }
      anchor.current = null;
      setRemainingMs(snap.balances[destination] ?? 0);
      if (s && s.status === "ACTIVE" && !ctl) {
        go(s.destinationId === destination ? "RECOVERABLE" : "OTHER_ACTIVE");
      } else if (s && ctl && s.id === ctl.sessionId && s.status !== "ACTIVE") {
        controller.current = null;
        sessionStorage.removeItem(STORE_KEY);
        setLastSessionId(s.id);
        go(s.status === "EXPIRED" ? "EXPIRED" : s.status === "ENDED" ? "ENDED" : "CONNECTION_LOST");
        if (s.status === "INTERRUPTED")
          setMessage("The connection lease ran out, so the session was closed. Your remaining time is saved.");
      } else if (
        stateRef.current === "LOADING_ACCOUNT" ||
        stateRef.current === ("RECONNECTING" as ExplorationState) ||
        stateRef.current === "OTHER_ACTIVE"
      ) {
        go("IDLE");
      }
    },
    [go, destination],
  );

  const refresh = useCallback(async () => {
    const t0 = performance.now();
    try {
      const snap = await api<AccountSnapshot & { policy: SessionPolicy }>("/api/account");
      setPolicy(snap.policy);
      applySnapshot(snap, t0);
      return snap;
    } catch (e) {
      setMessage((e as Error).message);
      if (stateRef.current === "LOADING_ACCOUNT") go("ERROR");
      return null;
    }
  }, [applySnapshot, go]);

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const becomeController = useCallback(
    (snap: AccountSnapshot, token: string, t0: number) => {
      const s = snap.session!;
      controller.current = { sessionId: s.id, token, generation: s.controllerGeneration };
      sessionStorage.setItem(STORE_KEY, JSON.stringify(controller.current));
      seq.current = 0;
      newSegment(); // fresh sampling anchor: recovery/spawn never counts as distance
      setLastSessionId(s.id);
      applySnapshot(snap, t0);
      go("ACTIVE");
    },
    [applySnapshot, go, newSegment],
  );

  /** Explicit, billable Start. Only call after the scene is ready. */
  const start = useCallback(async () => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "ENDED" && stateRef.current !== "CONNECTION_LOST") return;
    go("STARTING");
    setMessage(null);
    setLowTimeWarned(false);
    setSavedSites(new Set());
    serverDistance.current = 0;
    let pending = JSON.parse(sessionStorage.getItem(PENDING_START_KEY) ?? "null") as
      | { requestKey: string; token: string; destination: DestinationId }
      | null;
    if (!pending || pending.destination !== destination) {
      pending = { requestKey: crypto.randomUUID(), token: randomToken(), destination };
      sessionStorage.setItem(PENDING_START_KEY, JSON.stringify(pending));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = performance.now();
      try {
        const snap = await api<AccountSnapshot & { policy: SessionPolicy }>("/api/sessions", {
          destinationId: destination,
          requestKey: pending.requestKey,
          controllerToken: pending.token,
        });
        sessionStorage.removeItem(PENDING_START_KEY);
        setPolicy(snap.policy);
        const s = snap.session!;
        if (s.status !== "ACTIVE") {
          applySnapshot(snap, t0);
          go(s.status === "EXPIRED" ? "EXPIRED" : "ENDED");
          return;
        }
        becomeController(snap, pending.token, t0);
        return;
      } catch (e) {
        const err = e as ApiErr;
        if (err.status && err.status < 500) {
          sessionStorage.removeItem(PENDING_START_KEY);
          setMessage(err.message);
          await refresh();
          if ((stateRef.current as ExplorationState) === "STARTING")
            go(err.code === "SESSION_ALREADY_ACTIVE" ? "RECOVERABLE" : "IDLE");
          return;
        }
      }
    }
    setMessage("Start could not be confirmed. If it started, use Resume to recover it.");
    await refresh();
    if ((stateRef.current as ExplorationState) === "STARTING") go("IDLE");
  }, [applySnapshot, becomeController, destination, go, refresh]);

  /** Explicit recovery of an active session for this destination (refresh or other tab). */
  const resume = useCallback(async () => {
    const s = snapshot?.session;
    if (!s || s.status !== "ACTIVE" || s.destinationId !== destination) return;
    go("STARTING");
    const token = randomToken();
    const t0 = performance.now();
    try {
      const snap = await api<AccountSnapshot>(`/api/sessions/${s.id}/takeover`, {
        expectedGeneration: s.controllerGeneration,
        controllerToken: token,
        takeoverKey: crypto.randomUUID(),
      });
      const ns = snap.session!;
      if (ns.status !== "ACTIVE") {
        applySnapshot(snap, t0);
        go(ns.status === "EXPIRED" ? "EXPIRED" : "ENDED");
        return;
      }
      setMessage(null);
      becomeController(snap, token, t0);
    } catch (e) {
      setMessage((e as Error).message);
      await refresh();
      if ((stateRef.current as ExplorationState) === "STARTING") go("IDLE");
    }
  }, [applySnapshot, becomeController, destination, go, refresh, snapshot]);

  /** End an active session that belongs to another destination (to switch destinations). */
  const endOther = useCallback(async () => {
    const s = snapshot?.session;
    if (!s || s.status !== "ACTIVE") return;
    try {
      await api(`/api/sessions/${s.id}/end`, {});
    } catch (e) {
      setMessage((e as Error).message);
    }
    stateRef.current = "RECONNECTING" as ExplorationState;
    await refresh();
  }, [refresh, snapshot]);

  /** Exit: freeze immediately, then ask the server to settle and close (with a final checkpoint). */
  const exit = useCallback(
    async (keepalive = false) => {
      const ctl = controller.current;
      if (!ctl) return;
      go("ENDING");
      const t0 = performance.now();
      try {
        const snap = await api<AccountSnapshot>(
          `/api/sessions/${ctl.sessionId}/stop`,
          { controllerToken: ctl.token, generation: ctl.generation, telemetry: telemetry() },
          keepalive,
        );
        controller.current = null;
        sessionStorage.removeItem(STORE_KEY);
        anchor.current = null;
        setLastSessionId(ctl.sessionId);
        applySnapshot(snap, t0);
        go(snap.session?.status === "EXPIRED" ? "EXPIRED" : "ENDED");
      } catch {
        setMessage("Exit not confirmed; billing stops by the displayed connection cutoff (at most 15 seconds).");
        go("CONNECTION_LOST");
      }
    },
    [applySnapshot, go, telemetry],
  );

  /** Persist a scan for the current session. Resolves only after the server stored it. */
  const scan = useCallback(async (siteId: string, x: number, z: number) => {
    const ctl = controller.current;
    if (!ctl || stateRef.current !== "ACTIVE") throw new Error("The session is not active.");
    const res = await api<{ outcome: string; siteId: string }>(`/api/sessions/${ctl.sessionId}/observations`, {
      controllerToken: ctl.token,
      generation: ctl.generation,
      siteId,
      x,
      z,
    });
    setSavedSites((prev) => new Set([...prev, res.siteId]));
    return res;
  }, []);

  // Heartbeat loop: one request in flight, monotonic sequence, cumulative telemetry checkpoint.
  useEffect(() => {
    if (state !== "ACTIVE") return;
    const id = window.setInterval(async () => {
      const ctl = controller.current;
      if (!ctl || inFlight.current || stateRef.current !== "ACTIVE") return;
      inFlight.current = true;
      const mySeq = ++seq.current;
      const tel = telemetry();
      const t0 = performance.now();
      try {
        const snap = await api<AccountSnapshot & { seq: number }>(`/api/sessions/${ctl.sessionId}/heartbeat`, {
          controllerToken: ctl.token,
          generation: ctl.generation,
          seq: mySeq,
          telemetry: tel,
        });
        if (tel && segment.current?.id === tel.segment) segment.current.ackedDist = tel.dist;
        if (stateRef.current === "ACTIVE" && snap.seq === seq.current) applySnapshot(snap, t0);
      } catch (e) {
        const err = e as ApiErr;
        if (err.code === "STALE_CONTROLLER") {
          controller.current = null;
          setMessage("Another tab took control of this session.");
          await refresh();
        } else if (stateRef.current === "ACTIVE") {
          setMessage("Connection lost. Controls are frozen. Billing stops no later than the connection cutoff.");
          go("CONNECTION_LOST");
        }
      } finally {
        inFlight.current = false;
      }
    }, policy.heartbeatMs);
    return () => window.clearInterval(id);
  }, [state, policy.heartbeatMs, applySnapshot, go, refresh, telemetry]);

  // Local cutoff guard + countdown display (performance.now, not wall clock).
  useEffect(() => {
    if (state !== "ACTIVE") return;
    const id = window.setInterval(() => {
      const a = anchor.current;
      if (!a) return;
      const elapsed = performance.now() - a.perf;
      const rem = Math.max(0, a.balanceMs - elapsed);
      setRemainingMs(rem);
      if (rem <= 30_000) setLowTimeWarned(true);
      if (rem <= 0) {
        go("EXPIRED");
        controller.current = null;
        sessionStorage.removeItem(STORE_KEY);
        window.setTimeout(() => void refresh(), 600);
      } else if (a.authMs - elapsed <= 0) {
        setMessage("Connection could not be confirmed in time. Controls are frozen.");
        go("CONNECTION_LOST");
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [state, go, refresh]);

  // Hidden page: stop renewing and attempt exit (best effort).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && stateRef.current === "ACTIVE") void exit(true);
    };
    const onPageHide = () => {
      if (stateRef.current === "ACTIVE") void exit(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [exit]);

  const reconnect = useCallback(async () => {
    controller.current = null;
    anchor.current = null;
    sessionStorage.removeItem(STORE_KEY);
    stateRef.current = "RECONNECTING" as ExplorationState;
    setMessage(null);
    const snap = await refresh();
    if (!snap) go("CONNECTION_LOST");
  }, [go, refresh]);

  /** Server-accepted distance plus the not-yet-acknowledged local part of this segment. */
  const displayDistance = useCallback(() => {
    const seg = segment.current;
    const local = seg ? Math.max(0, pose.distance - seg.baseDist - seg.ackedDist) : 0;
    return serverDistance.current + local;
  }, [pose]);

  const freeze = useCallback(
    (reason: string) => {
      if (stateRef.current === "ACTIVE") {
        setMessage(reason);
        void exit();
      }
    },
    [exit],
  );

  return {
    state,
    snapshot,
    policy,
    message,
    remainingMs,
    lowTimeWarned,
    savedSites,
    lastSessionId,
    destinationBalance: snapshot?.balances[destination] ?? 0,
    inputEnabled: state === "ACTIVE",
    start,
    resume,
    exit,
    endOther,
    scan,
    refresh,
    reconnect,
    displayDistance,
    freeze,
  };
}
