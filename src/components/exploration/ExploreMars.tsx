"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useExplorationSession } from "@/features/sessions/client/useExplorationSession";
import { formatMMSS } from "@/server/sessions/accounting";
import { MARS } from "@/config/destinations";
import { bigButtonClass, bigButtonOutlineClass, bigButtonSecondaryClass } from "@/components/saas/styles";

const MarsScene = dynamic(() => import("./MarsScene"), { ssr: false });

type SceneState = "CHECKING" | "LOADING" | "READY" | "FAILED" | "UNSUPPORTED";

const BILLING_NOTICE =
  "Time runs continuously while your session is active, even when you stand still. Escape releases the mouse; it does not pause billing. Use Exit session to stop. If the connection is lost, billing stops no later than 15 seconds after the last confirmed check, or when your time runs out.";

export function ExploreMars() {
  const s = useExplorationSession();
  const [scene, setScene] = useState<SceneState>("CHECKING");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Capability check before any download or billing.
  useEffect(() => {
    const desktop = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900;
    import("./MarsScene").then(({ supportsWebGL }) => {
      setScene(supportsWebGL() && desktop && "requestPointerLock" in HTMLElement.prototype ? "LOADING" : "UNSUPPORTED");
    });
  }, []);

  const onReady = useCallback(() => setScene("READY"), []);
  const onError = useCallback(
    (m: string) => {
      setScene("FAILED");
      setSceneError(m);
      s.freeze("The 3D view stopped working, so the session is being ended.");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const onContextLost = useCallback(() => onError("The graphics context was lost."), [onError]);

  const st = s.state;
  const active = st === "ACTIVE";
  const remaining = active || st === "ENDING" || st === "CONNECTION_LOST" ? s.remainingMs : s.snapshot?.balanceMs ?? 0;
  const balance = s.snapshot?.balanceMs ?? 0;

  // Move focus to the overlay when it changes (expiry, errors, escape).
  const overlayKey = `${st}-${scene}-${active && !locked}`;
  useEffect(() => {
    overlayRef.current?.focus();
  }, [overlayKey]);

  const showScene = scene !== "UNSUPPORTED" && scene !== "CHECKING" && st !== "EXPIRED";

  return (
    <div className="fixed inset-0 bg-background text-foreground">
      {showScene && (
        <div className="absolute inset-0" aria-hidden={!active}>
          <MarsScene
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
          <p className="font-heading text-sm font-bold">Mars simulation</p>
          <p className="text-xs text-muted-foreground">Simulated terrain, test payments</p>
        </div>
        <div className="rounded-lg bg-background/75 px-4 py-2.5 text-right backdrop-blur" role="timer" aria-live="off">
          <p className="font-heading text-3xl font-extrabold tabular" aria-label={`Time remaining ${formatMMSS(remaining)}`}>
            {formatMMSS(remaining)}
          </p>
          <p className={`text-xs font-semibold ${active ? "text-ok" : st === "CONNECTION_LOST" ? "text-warn" : "text-muted-foreground"}`}>
            {active
              ? "Active, billing"
              : st === "CONNECTION_LOST"
                ? "Connection lost"
                : st === "STARTING"
                  ? "Connecting"
                  : st === "ENDING"
                    ? "Ending"
                    : "Not billing"}
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

      {active && s.lowTimeWarned && s.remainingMs > 0 && (
        <p role="status" className="absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-md bg-warn/90 px-4 py-2 text-sm font-semibold text-background">
          Less than 30 seconds left
        </p>
      )}

      {active && locked && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-sm text-foreground/85">
          Z/W forward · S back · Q/A and D turn · mouse to look · Esc frees the mouse
        </p>
      )}

      {/* Overlays */}
      <Overlay show={!(active && locked)} innerRef={overlayRef}>
        {scene === "CHECKING" || st === "LOADING_ACCOUNT" ? (
          <Panel title="Preparing">
            <p className="text-muted-foreground">Checking your account and device…</p>
          </Panel>
        ) : scene === "UNSUPPORTED" ? (
          <Panel title="3D could not start">
            <p className="text-muted-foreground">
              Exploration needs a desktop browser with WebGL, a mouse and a keyboard. No exploration time was used.
            </p>
            <Actions>
              <Link href="/dashboard" className={bigButtonClass}>Return to dashboard</Link>
            </Actions>
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
            <p className="text-muted-foreground">
              Your purchased time reached 00:00 and exploration access has closed. Buy more time to start a new session.
            </p>
            <Actions>
              <Link href="/pricing" className={bigButtonClass}>Buy more time</Link>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
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
            <p className="text-muted-foreground">
              Time continues while the mouse is free. Click the view to take control again, or exit to stop the clock.
            </p>
            <Actions>
              <button
                type="button"
                className={bigButtonClass}
                onClick={() => document.querySelector("canvas")?.requestPointerLock()}
              >
                Take control
              </button>
              <button type="button" className={bigButtonOutlineClass} onClick={() => void s.exit()}>
                Exit session
              </button>
            </Actions>
          </Panel>
        ) : st === "RECOVERABLE" ? (
          <Panel title="A session is already running">
            <p className="text-muted-foreground">
              {s.message ?? "Your session kept running after a refresh or in another tab."} Resume it here to take
              control. The other tab will lose control.
            </p>
            <Actions>
              <button type="button" disabled={scene !== "READY"} className={bigButtonClass} onClick={() => { document.querySelector("canvas")?.requestPointerLock(); void s.resume(); }}>
                {scene === "READY" ? "Resume here" : "Loading terrain…"}
              </button>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : st === "ENDED" ? (
          <Panel title="Session ended">
            <p className="text-muted-foreground">
              The clock stopped. <span className="tabular">{formatMMSS(balance)}</span> remains on your account.
            </p>
            <Actions>
              {balance > 0 && (
                <button type="button" className={bigButtonClass} onClick={() => { document.querySelector("canvas")?.requestPointerLock(); void s.start(); }}>Start a new session</button>
              )}
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : balance <= 0 && st === "IDLE" ? (
          <Panel title="No exploration time">
            <p className="text-muted-foreground">Buy a package to start a session. Loading the terrain is free.</p>
            <Actions>
              <Link href="/pricing" className={bigButtonClass}>Buy time</Link>
              <Link href="/dashboard" className={bigButtonSecondaryClass}>Dashboard</Link>
            </Actions>
          </Panel>
        ) : (
          <Panel title={scene === "READY" ? "Ready to explore" : "Loading Mars terrain"}>
            <p className="text-sm text-muted-foreground">{MARS.disclosure}</p>
            <ul className="mt-4 grid gap-1 text-sm">
              <li><strong>Z</strong> or <strong>W</strong>: move forward, <strong>S</strong>: move back</li>
              <li><strong>Q</strong>/<strong>A</strong> and <strong>D</strong>: turn left and right</li>
              <li>Mouse: look around · <strong>Esc</strong>: free the mouse</li>
            </ul>
            <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">{BILLING_NOTICE}</p>
            {s.message && <p role="alert" className="mt-3 text-sm text-destructive">{s.message}</p>}
            <Actions>
              <button
                type="button"
                disabled={scene !== "READY" || st === "STARTING"}
                className={bigButtonClass}
                onClick={() => { document.querySelector("canvas")?.requestPointerLock(); void s.start(); }}
              >
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
