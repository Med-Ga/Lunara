"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DESTINATIONS } from "@/config/destinations";
import { formatMMSS } from "@/server/sessions/accounting";
import { bigButtonClass, bigButtonSecondaryClass } from "./styles";

interface Item {
  id: string;
  destinationId: "mars" | "moon";
  status: string;
  startedAt: number;
  endReason: string | null;
  consumedMs: number;
  observationCount: number;
  hasTelemetry: boolean;
  reportStatus: "READY" | "FAILED" | null;
}

const END: Record<string, string> = {
  USER_EXIT: "Exited",
  OWNER_ENDED: "Ended from dashboard",
  BALANCE_EXHAUSTED: "Time used up",
  LEASE_EXPIRED: "Interrupted",
};

export function MissionArchive() {
  const [items, setItems] = useState<Item[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async (before: number | null) => {
    setState("loading");
    try {
      const res = await fetch(`/api/missions${before ? `?before=${before}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message);
      setItems((prev) => (before ? [...prev, ...json.missions] : json.missions));
      setNext(json.nextBefore);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(null), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (state === "error" && items.length === 0) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-5">
        <p className="font-semibold">Your missions could not be loaded.</p>
        <button type="button" className={`${bigButtonClass} mt-4`} onClick={() => void load(null)}>Retry</button>
      </div>
    );
  }
  if (state === "loading" && items.length === 0) return <p role="status" className="text-muted-foreground">Loading missions…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-panel/60 p-6">
        <p className="font-semibold">No missions yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Each exploration session becomes a mission with a saved report.</p>
        <Link href="/dashboard" className={`${bigButtonClass} mt-4`}>Choose a destination</Link>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-panel/50">
        {items.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="font-semibold">
                {DESTINATIONS[m.destinationId].name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {new Date(m.startedAt).toLocaleString("en-GB")}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="tabular">{formatMMSS(m.consumedMs)}</span> used ·{" "}
                {m.status === "ACTIVE" ? "In progress" : END[m.endReason ?? ""] ?? m.status} ·{" "}
                {m.observationCount} observation{m.observationCount === 1 ? "" : "s"}
                {!m.hasTelemetry && " · no telemetry recorded"}
              </p>
            </div>
            <div className="text-sm">
              {m.status === "ACTIVE" ? (
                <span className="text-ok">Session running, report after it ends</span>
              ) : m.reportStatus === "READY" ? (
                <Link href={`/missions/${m.id}`} className={bigButtonSecondaryClass}>Read report</Link>
              ) : m.reportStatus === "FAILED" ? (
                <Link href={`/missions/${m.id}`} className="text-destructive underline-offset-4 hover:underline">Report failed, retry</Link>
              ) : (
                <Link href={`/missions/${m.id}`} className="text-warn underline-offset-4 hover:underline">Report pending</Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      {next && (
        <button type="button" disabled={state === "loading"} className={`${bigButtonSecondaryClass} mt-4`} onClick={() => void load(next)}>
          {state === "loading" ? "Loading…" : "Show older missions"}
        </button>
      )}
    </div>
  );
}
