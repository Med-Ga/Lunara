"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExplorationSession } from "@/features/sessions/client/useExplorationSession";
import { formatMMSS } from "@/server/sessions/accounting";
import { DESTINATIONS, type DestinationId, type GeoSite } from "@/config/destinations";
import { bigButtonClass, bigButtonOutlineClass, bigButtonSecondaryClass } from "@/components/saas/styles";
import { createPose } from "./pose";
import { MiniMap, type SiteMapState } from "./MiniMap";
import { TelemetryPanel } from "./TelemetryPanel";

const TerrainScene = dynamic(() => import("./TerrainScene"), { ssr: false });

type SceneState = "CHECKING" | "LOADING" | "READY" | "FAILED" | "UNSUPPORTED";
type ScanUi = { siteId: string; phase: "scanning" | "saving" } | null;

const SCAN_MS = 1500;
const BILLING_NOTICE =
  "Time runs continuously while your session is active, even when you stand still or scan. Escape releases the mouse; it does not pause billing. Use Exit session to stop. If the connection is lost, billing stops no later than 15 seconds after the last confirmed check, or when your time runs out.";

export function ExploreDestination({ destinationId }: { destinationId: DestinationId }) {
  const d = DESTINATIONS[destinationId];
  const pose = useMemo(() => createPose(), []);
  const s = useExplorationSession(destinationId, pose);
  const [scene, setScene] = useState<SceneState>("CHECKING");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [nearSite, setNearSite] = useState<GeoSite | null>(null);
  const [scanUi, setScanUi] = useState<ScanUi>(null);
  const [failedSites, setFailedSites] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<ScanUi>(null);
  const stateRef = useRef(s.state);
  useEffect(() => {
    stateRef.current = s.state;
  }, [s.state]);

  useEffect(() => {
    const desktop = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900;
    import("./TerrainScene").then(({ supportsWebGL }) => {
      setScene(supportsWebGL() && desktop && "requestPointerLock" in HTMLElement.prototype ? "LOADING" : "UNSUPPORTED");
    });
  }, []);

  const onReady = useCallback(() => setScene("READY"), []);
  const freeze = s.freeze;
  const onError = useCallback(
    (m: string) => {
      setScene("FAILED");
      setSceneError(m);
      freeze("The 3D view stopped working, so the session is being ended.");
    },
    [freeze],
  );
  const onContextLost = useCallback(() => onError("The graphics context was lost."), [onError]);

  const st = s.state;
  const active = st === "ACTIVE";
  const remaining = active || st === "ENDING" || st === "CONNECTION_LOST" ? s.remainingMs : s.destinationBalance;
  const balance = s.destinationBalance;
  const otherSession = s.snapshot?.session && s.snapshot.session.destinationId !== destinationId ? s.snapshot.session : null;

  // Nearest unsaved site within its scan radius (4 Hz; never per frame).
  useEffect(() => {
    if (!active) {
      setNearSite(null);
      return;
    }
    const id = window.setInterval(() => {
      let best: GeoSite | null = null;
      let bd = Infinity;
      for (const site of d.sites) {
        if (s.savedSites.has(site.id)) continue;
        const dist = Math.hypot(pose.x - site.x, pose.z - site.z);
        if (dist <= site.radius && dist < bd) {
          bd = dist;
          best = site;
        }
      }
      setNearSite((prev) => (prev?.id === best?.id ? prev : best));
    }, 250);
    return () => window.clearInterval(id);
  }, [active, d, pose, s.savedSites]);

  const scanFn = s.scan;
  const runScan = useCallback(
    async (site: GeoSite) => {
      if (scanRef.current) return;
      scanRef.current = { siteId: site.id, phase: "scanning" };
      setScanUi(scanRef.current);
      setFailedSites((f) => {
        const n = { ...f };
        delete n[site.id];
        return n;
      });
      await new Promise((r) => setTimeout(r, SCAN_MS));
      const stillNear = Math.hypot(pose.x - site.x, pose.z - site.z) <= site.radius;
      if (stateRef.current !== "ACTIVE" || !stillNear) {
        scanRef.current = null;
        setScanUi(null);
        if (stateRef.current === "ACTIVE") setFailedSites((f) => ({ ...f, [site.id]: "Scan cancelled: you moved out of range." }));
        return;
      }
      scanRef.current = { siteId: site.id, phase: "saving" };
      setScanUi(scanRef.current);
      try {
        await scanFn(site.id, pose.x, pose.z);
      } catch (e) {
        setFailedSites((f) => ({ ...f, [site.id]: (e as Error).message || "The scan could not be saved." }));
      } finally {
        scanRef.current = null;
        setScanUi(null);
      }
    },
    [pose, scanFn],
  );

  // E to scan (ignored while typing or when no site is in range).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.repeat) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName))) return;
      if (stateRef.current !== "ACTIVE" || !nearSite) return;
      e.preventDefault();
      void runScan(nearSite);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearSite, runScan]);

  const siteStates: Record<string, SiteMapState> = {};
  for (const site of d.sites) {
    siteStates[site.id] = s.savedSites.has(site.id)
      ? "saved"
      : scanUi?.siteId === site.id
        ? "pending"
        : failedSites[site.id]
          ? "failed"
          : "unscanned";
  }

  const overlayKey = `${st}-${scene}-${active && !locked}`;
  useEffect(() => {
    overlayRef.current?.focus();
  }, [overlayKey]);

  const showScene = scene !== "UNSUPPORTED" && scene !== "CHECKING" && st !== "EXPIRED";
  const lockAndStart = (fn: () => Promise<void>) => () => {
    document.querySelector("canvas")?.requestPointerLock();
    void fn();
  };
  const reportLink = s.lastSessionId ? `/missions/${s.lastSessionId}` : null;

  return (
    <div className="fixed inset-0 bg-background text-foreground">
      {showScene && (
        <div className="absolute inset-0" aria-hidden={!active}>
          <TerrainScene
            key={destinationId}
            destination={d}
            pose={pose}
            savedSites={s.savedSites}
            enabled={active}
            onReady={onReady}
            onError={onError}
            onContextLost={onContextLost}
            onPointerLockChange={setLocked}
          />
        </div>
      )}

      {/* HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto rounded-lg bg-background/75 px-4 py-2.5 backdrop-blur">
          <p className="font-heading text-sm font-bold">{d.name} simulation</p>
          <p className="text-xs text-muted-foreground">Simulated terrain, test payments</p>
        </div>
        <div className="rounded-lg bg-background/75 px-4 py-2.5 text-right backdrop-blur" role="timer" aria-live="off">
          <p className="font-heading text-3xl font-extrabold tabular" aria-label={`Time remaining ${formatMMSS(remaining)}`}>
            {formatMMSS(remaining)}
          </p>
          <p className={`text-xs font-semibold ${active ? "text-ok" : st === "CONNECTION_LOST" ? "text-warn" : "text-muted-foreground"}`}>
            {active ? "Active, billing" : st === "CONNECTION_LOST" ? "Connection lost" : st === "STARTING" ? "Connecting" : st === "ENDING" ? "Ending" : "Not billing"}
          </p>
        </div>
        <div className="pointer-events-auto">
          {(active || st === "CONNECTION_LOST") && (
            <button type="button" onClick={() => void s.exit()} className={bigButtonOutlineClass}>
              Exit session
            </button>
          )}
        </div>
      </header>

      {active && (
        <>
          <div className="pointer-events-none absolute bottom-4 left-4 z-10">
            <MiniMap destination={d} pose={pose} siteStates={siteStates} />
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 z-10">
            <TelemetryPanel
              destination={d}
              pose={pose}
              remainingMs={s.remainingMs}
              discoveries={s.savedSites.size}
              distance={s.displayDistance}
            />
          </div>
        </>
      )}

      {active && s.lowTimeWarned && s.remainingMs > 0 && (
        <p role="status" className="absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-md bg-warn/90 px-4 py-2 text-sm font-semibold text-background">
          Less than 30 seconds left
        </p>
      )}

      {active && (nearSite || scanUi || Object.keys(failedSites).length > 0) && (
        <div role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-1/2 z-10 mt-16 -translate-x-1/2 rounded-lg bg-background/80 px-4 py-2.5 text-center text-sm backdrop-blur">
          {scanUi ? (
            <p>
              {scanUi.phase === "scanning" ? "Scanning" : "Saving observation"}: {d.sites.find((x) => x.id === scanUi.siteId)?.name}…
            </p>
          ) : nearSite ? (
            <p>
              <kbd className="rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-xs">E</kbd> Scan{" "}
              <strong>{nearSite.name}</strong> <span className="text-muted-foreground">({nearSite.category})</span>
            </p>
          ) : (
            <p className="text-destructive">{Object.values(failedSites).at(-1)}</p>
          )}
        </div>
      )}

      {active && locked && (
        <p className="pointer-events-none absolute inset-x-0 top-28 z-10 text-center text-xs text-foreground/80">
          Z/W forward · S back · Q/A and D turn · mouse to look · E scan · Esc frees the mouse
        </p>
      )}

      <Overlay show={!(active && locked)} innerRef={overlayRef}>
        {scene === "CHECKING" || st === "LOADING_ACCOUNT" ? (
          <Panel title="Preparing">
            <p className="text-muted-foreground">Checking your account and device…</p>
          </Panel>
        ) : scene === "UNSUPPORTED" ? (
          <Panel title="3D could not start">
            <p className="text-muted-foreground">Exploration needs a desktop browser with WebGL, a mouse and a keyboard. No exploration time was used.</p>
            <Actions><Link href="/dashboard" className={bigButtonClass}>Return to dashboard</Link></Actions>
          </Panel>
        ) : st === "ERROR" ? (
          <Panel title="Account unavailable">
            <p className="text-muted-foreground">{s.message ?? "We could not load your balance."} Nothing was charged.</p>
            <Actions>
              <button type="button" className={bigButtonClass} onClick={() => window.location.reload()}>Retry</button>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : st === "EXPIRED" ? (
          <Panel title="Session ended: time used up">
            <p className="text-muted-foreground">Your {d.name} time reached 00:00 and exploration access has closed. Your mission report is being saved.</p>
            <Actions>
              {reportLink && <Link href={reportLink} className={bigButtonClass}>View mission report</Link>}
              <Link href={`/pricing?destination=${d.id}`} className={bigButtonSecondaryClass}>Buy more {d.name} time</Link>
            </Actions>
          </Panel>
        ) : scene === "FAILED" && !active ? (
          <Panel title="The terrain didn't load">
            <p className="text-muted-foreground">{sceneError} No exploration time was used for loading.</p>
            <Actions>
              <button type="button" className={bigButtonClass} onClick={() => window.location.reload()}>Try again</button>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : st === "OTHER_ACTIVE" && otherSession ? (
          <Panel title={`A ${DESTINATIONS[otherSession.destinationId].name} session is running`}>
            <p className="text-muted-foreground">
              Only one session can run at a time. End the {DESTINATIONS[otherSession.destinationId].name} session to switch to {d.name}; its unused time is kept.
            </p>
            {s.message && <p role="alert" className="mt-3 text-sm text-destructive">{s.message}</p>}
            <Actions>
              <button type="button" className={bigButtonClass} onClick={() => void s.endOther()}>End it and switch to {d.name}</button>
              <Link href={`/explore/${otherSession.destinationId}`} className={bigButtonSecondaryClass}>Return to {DESTINATIONS[otherSession.destinationId].name}</Link>
            </Actions>
          </Panel>
        ) : st === "CONNECTION_LOST" ? (
          <Panel title="Connection lost">
            <p className="text-muted-foreground">{s.message}</p>
            <Actions>
              <button type="button" className={bigButtonClass} onClick={() => void s.reconnect()}>Reconnect</button>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : active && !locked ? (
          <Panel title="Your session is running">
            <p className="text-muted-foreground">Time continues while the mouse is free. Click the view to take control again, or exit to stop the clock.</p>
            <Actions>
              <button type="button" className={bigButtonClass} onClick={() => document.querySelector("canvas")?.requestPointerLock()}>Take control</button>
              <button type="button" className={bigButtonOutlineClass} onClick={() => void s.exit()}>Exit session</button>
            </Actions>
          </Panel>
        ) : st === "RECOVERABLE" ? (
          <Panel title="A session is already running">
            <p className="text-muted-foreground">
              {s.message ?? "Your session kept running after a refresh or in another tab."} Resume it here to take control. The other tab will lose control.
            </p>
            <Actions>
              <button type="button" disabled={scene !== "READY"} className={bigButtonClass} onClick={lockAndStart(s.resume)}>
                {scene === "READY" ? "Resume here" : "Loading terrain…"}
              </button>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : st === "ENDED" ? (
          <Panel title="Session ended">
            <p className="text-muted-foreground">
              The clock stopped. <span className="tabular">{formatMMSS(balance)}</span> of {d.name} time remains on your account.
            </p>
            <Actions>
              {reportLink && <Link href={reportLink} className={bigButtonClass}>View mission report</Link>}
              {balance > 0 && (
                <button type="button" className={bigButtonSecondaryClass} onClick={lockAndStart(s.start)}>Start a new session</button>
              )}
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : balance <= 0 && st === "IDLE" ? (
          <Panel title={`No ${d.name} time`}>
            <p className="text-muted-foreground">Buy {d.name} minutes to start a session. Loading the terrain is free. Time bought for another destination can&rsquo;t be used here.</p>
            <Actions>
              <Link href={`/pricing?destination=${d.id}`} className={bigButtonClass}>Buy {d.name} time</Link>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : (
          <Panel title={scene === "READY" ? `Ready to explore ${d.name}` : `Loading ${d.name} terrain`}>
            <p className="text-sm text-muted-foreground">{d.disclosure}</p>
            <ul className="mt-4 grid gap-1 text-sm">
              <li><strong>Z</strong> or <strong>W</strong>: move forward, <strong>S</strong>: move back</li>
              <li><strong>Q</strong>/<strong>A</strong> and <strong>D</strong>: turn left and right</li>
              <li>Mouse: look around · <strong>E</strong>: scan a nearby site · <strong>Esc</strong>: free the mouse</li>
            </ul>
            <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">{BILLING_NOTICE}</p>
            {s.message && <p role="alert" className="mt-3 text-sm text-destructive">{s.message}</p>}
            <Actions>
              <button type="button" disabled={scene !== "READY" || st === "STARTING"} className={bigButtonClass} onClick={lockAndStart(s.start)}>
                {scene !== "READY" ? "Loading terrain…" : st === "STARTING" ? "Starting…" : `Start exploration (${formatMMSS(balance)} available)`}
              </button>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Back</Link>
            </Actions>
          </Panel>
        )}
      </Overlay>
    </div>
  );
}

function Overlay({ show, children, innerRef }: { show: boolean; children: React.ReactNode; innerRef: React.Ref<HTMLDivElement> }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/55 p-4 backdrop-blur-[2px]">
      <div ref={innerRef} tabIndex={-1} role="dialog" aria-modal="true" className="w-full max-w-lg outline-none">
        {children}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-panel/95 p-6 shadow-2xl">
      <h1 className="mb-3 text-2xl font-extrabold">{title}</h1>
      {children}
    </section>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap gap-3">{children}</div>;
}
