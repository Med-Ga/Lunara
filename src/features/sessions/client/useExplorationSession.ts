"use client";
// The ONLY client session adapter. It never decides how much time exists: it shows
// a countdown derived from server snapshots, renews the lease, and fails closed.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountSnapshot, SessionPolicy } from "@/shared/contracts";

export type ExplorationState =
  | "LOADING_ACCOUNT"
  | "IDLE" // no active session; may Start if balance > 0
  | "RECOVERABLE" // an active session exists (refresh / other tab); explicit Resume needed
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
  perf: number; // performance.now() when the snapshot was received (minus half RTT)
  balanceMs: number; // settled balance at that instant
  authMs: number; // ms of authorization remaining at that instant
}

const STORE_KEY = "lunara.controller";
const PENDING_START_KEY = "lunara.pendingStart";

function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

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
    const err = new Error(json?.error?.message ?? `HTTP ${res.status}`) as Error & { code?: string; status?: number };
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json as T;
}

export function useExplorationSession() {
  const [state, setState] = useState<ExplorationState>("LOADING_ACCOUNT");
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [policy, setPolicy] = useState<SessionPolicy>({ heartbeatMs: 5000, leaseMs: 15000 });
  const [message, setMessage] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [lowTimeWarned, setLowTimeWarned] = useState(false);

  const stateRef = useRef<ExplorationState>("LOADING_ACCOUNT");
  const controller = useRef<Controller | null>(null);
  const anchor = useRef<Anchor | null>(null);
  const seq = useRef(0);
  const inFlight = useRef(false);

  const go = useCallback((s: ExplorationState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  /** Apply a server snapshot received after a request that started at t0. */
  const applySnapshot = useCallback(
    (snap: AccountSnapshot, t0: number) => {
      const t1 = performance.now();
      setSnapshot(snap);
      const s = snap.session;
      const ctl = controller.current;
      if (ctl && s && s.id === ctl.sessionId && s.controllerGeneration !== ctl.generation) {
        // Someone took over in another tab.
        controller.current = null;
        anchor.current = null;
        go("RECOVERABLE");
        setMessage("This session was taken over by another tab.");
        return;
      }
      if (s && s.status === "ACTIVE" && ctl && s.id === ctl.sessionId && s.authorizedUntil != null) {
        // Conservative: count the whole round trip against the user's display.
        anchor.current = {
          perf: t1,
          balanceMs: snap.balanceMs - (t1 - t0),
          authMs: s.authorizedUntil - snap.serverNow - (t1 - t0),
        };
        setRemainingMs(Math.max(0, anchor.current.balanceMs));
        return;
      }
      anchor.current = null;
      setRemainingMs(snap.balanceMs);
      if (s && s.status === "ACTIVE" && !ctl) {
        go("RECOVERABLE");
      } else if (s && ctl && s.id === ctl.sessionId && s.status !== "ACTIVE") {
        controller.current = null;
        sessionStorage.removeItem(STORE_KEY);
        go(s.status === "EXPIRED" ? "EXPIRED" : s.status === "ENDED" ? "ENDED" : "CONNECTION_LOST");
        if (s.status === "INTERRUPTED") setMessage("The connection lease ran out, so the session was closed. Your remaining time is saved.");
      } else if (stateRef.current === "LOADING_ACCOUNT" || stateRef.current === "RECONNECTING" as ExplorationState) {
        go("IDLE");
      }
    },
    [go],
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

  /** Explicit, billable Start. Only call after the scene is ready. */
  const start = useCallback(async () => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "ENDED" && stateRef.current !== "CONNECTION_LOST") return;
    go("STARTING");
    setMessage(null);
    setLowTimeWarned(false);
    // Reuse a pending start identity if a previous response was lost.
    let pending = JSON.parse(sessionStorage.getItem(PENDING_START_KEY) ?? "null") as
      | { requestKey: string; token: string }
      | null;
    if (!pending) {
      pending = { requestKey: crypto.randomUUID(), token: randomToken() };
      sessionStorage.setItem(PENDING_START_KEY, JSON.stringify(pending));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = performance.now();
      try {
        const snap = await api<AccountSnapshot & { policy: SessionPolicy }>("/api/sessions", {
          destinationId: "mars",
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
        controller.current = { sessionId: s.id, token: pending.token, generation: s.controllerGeneration };
        sessionStorage.setItem(STORE_KEY, JSON.stringify(controller.current));
        seq.current = 0;
        applySnapshot(snap, t0);
        go("ACTIVE");
        return;
      } catch (e) {
        const err = e as Error & { code?: string; status?: number };
        if (err.status && err.status < 500) {
          sessionStorage.removeItem(PENDING_START_KEY);
          setMessage(err.message);
          await refresh();
          go(err.code === "SESSION_ALREADY_ACTIVE" ? "RECOVERABLE" : "IDLE");
          return;
        }
        // Network/5xx: retry the SAME request key (never a second session).
      }
    }
    setMessage("Start could not be confirmed. If it started, use Resume to recover it.");
    await refresh();
    if ((stateRef.current as ExplorationState) === "STARTING") go("IDLE");
  }, [applySnapshot, go, refresh]);

  /** Explicit recovery of an active session (refresh or other tab). */
  const resume = useCallback(async () => {
    const s = snapshot?.session;
    if (!s || s.status !== "ACTIVE") return;
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
      controller.current = { sessionId: ns.id, token, generation: ns.controllerGeneration };
      sessionStorage.setItem(STORE_KEY, JSON.stringify(controller.current));
      seq.current = 0;
      applySnapshot(snap, t0);
      setMessage(null);
      go("ACTIVE");
    } catch (e) {
      setMessage((e as Error).message);
      await refresh();
      if ((stateRef.current as ExplorationState) === "STARTING") go("IDLE");
    }
  }, [applySnapshot, go, refresh, snapshot]);

  /** Exit: freeze immediately, then ask the server to settle and close. */
  const exit = useCallback(
    async (keepalive = false) => {
      const ctl = controller.current;
      if (!ctl) return;
      go("ENDING");
      const t0 = performance.now();
      try {
        const snap = await api<AccountSnapshot>(
          `/api/sessions/${ctl.sessionId}/stop`,
          { controllerToken: ctl.token, generation: ctl.generation },
          keepalive,
        );
        controller.current = null;
        sessionStorage.removeItem(STORE_KEY);
        anchor.current = null;
        applySnapshot(snap, t0);
        const st = snap.session?.status;
        go(st === "EXPIRED" ? "EXPIRED" : "ENDED");
      } catch {
        setMessage("Exit not confirmed; billing stops by the displayed connection cutoff (at most 15 seconds).");
        go("CONNECTION_LOST");
      }
    },
    [applySnapshot, go],
  );

  // Heartbeat loop: one request in flight, monotonic sequence.
  useEffect(() => {
    if (state !== "ACTIVE") return;
    const id = window.setInterval(async () => {
      const ctl = controller.current;
      if (!ctl || inFlight.current || stateRef.current !== "ACTIVE") return;
      inFlight.current = true;
      const mySeq = ++seq.current;
      const t0 = performance.now();
      try {
        const snap = await api<AccountSnapshot & { seq: number }>(`/api/sessions/${ctl.sessionId}/heartbeat`, {
          controllerToken: ctl.token,
          generation: ctl.generation,
          seq: mySeq,
        });
        if (stateRef.current === "ACTIVE" && snap.seq === seq.current) applySnapshot(snap, t0);
      } catch (e) {
        const err = e as Error & { code?: string };
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
  }, [state, policy.heartbeatMs, applySnapshot, go, refresh]);

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
        window.setTimeout(() => void refresh(), 600); // confirm with the server
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

  /** After a lost connection: drop the local controller and re-read server truth. */
  const reconnect = useCallback(async () => {
    controller.current = null;
    anchor.current = null;
    sessionStorage.removeItem(STORE_KEY);
    stateRef.current = "RECONNECTING" as ExplorationState;
    setMessage(null);
    const snap = await refresh();
    if (!snap) go("CONNECTION_LOST");
  }, [go, refresh]);

  const inputEnabled = state === "ACTIVE";
  return {
    state,
    snapshot,
    policy,
    message,
    remainingMs,
    lowTimeWarned,
    inputEnabled,
    start,
    resume,
    exit,
    refresh,
    reconnect,
    freeze: (reason: string) => {
      if (stateRef.current === "ACTIVE") {
        setMessage(reason);
        void exit();
      }
    },
  };
}
