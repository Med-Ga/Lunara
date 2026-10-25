"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MissionReport } from "@/server/missions/report";
import { formatMMSS } from "@/server/sessions/accounting";
import { bigButtonClass, bigButtonSecondaryClass } from "./styles";

type Stored = { status: "READY" | "FAILED"; report: MissionReport | null; error: string | null } | null;
type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "active" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; report: MissionReport };

export function MissionReportView({ missionId }: { missionId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);

  const fromStored = (r: Stored, status: string): View =>
    r?.status === "READY" && r.report
      ? { kind: "ready", report: r.report }
      : r?.status === "FAILED"
        ? { kind: "failed", message: r.error ?? "Report generation failed." }
        : status === "ACTIVE"
          ? { kind: "active" }
          : { kind: "failed", message: "The report is not available yet." };

  const load = useCallback(async () => {
    setView({ kind: "loading" });
    try {
      const res = await fetch(`/api/missions/${missionId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Mission not found.");
      setView(fromStored(json.report, json.mission.status));
    } catch (e) {
      setView({ kind: "error", message: (e as Error).message });
    }
  }, [missionId]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function retry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/missions/${missionId}/report`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message);
      setView(fromStored(json.report, "ENDED"));
    } catch (e) {
      setView({ kind: "failed", message: (e as Error).message || "Retry failed." });
    } finally {
      setRetrying(false);
    }
  }

  if (view.kind === "loading") return <p role="status" className="text-muted-foreground">Loading mission report…</p>;
  if (view.kind === "error")
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-5">
        <p className="font-semibold">{view.message}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" className={bigButtonClass} onClick={() => void load()}>Retry</button>
          <Link href="/missions" className={bigButtonSecondaryClass}>All missions</Link>
        </div>
      </div>
    );
  if (view.kind === "active")
    return (
      <div role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-5">
        <p className="font-semibold">This mission is still running.</p>
        <p className="mt-1 text-sm text-muted-foreground">The report is generated automatically when the session ends.</p>
        <button type="button" className={`${bigButtonSecondaryClass} mt-4`} onClick={() => void load()}>Check again</button>
      </div>
    );
  if (view.kind === "failed")
    return (
      <div role="alert" className="rounded-lg border border-warn/40 bg-warn/10 p-5">
        <p className="font-semibold">Report pending</p>
        <p className="mt-1 text-sm text-muted-foreground">{view.message} Your time and observations are already saved.</p>
        <button type="button" disabled={retrying} className={`${bigButtonClass} mt-4`} onClick={() => void retry()}>
          {retrying ? "Generating…" : "Generate report"}
        </button>
      </div>
    );

  const r = view.report;
  const m = r.mission;
  const st = r.statistics;
  return (
    <article className="report">
      <header className="border-b border-border pb-6">
        <p className="text-sm text-muted-foreground">Mission report · simulated</p>
        <h1 className="mt-1 text-4xl font-extrabold">{m.destination}</h1>
        <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Mission ID" v={<span className="font-mono text-xs break-all">{m.id}</span>} />
          <Row k="Explorer" v={m.explorer} />
          <Row k="Started" v={new Date(m.startedAt).toLocaleString("en-GB")} />
          <Row k="Ended" v={m.endedAt ? new Date(m.endedAt).toLocaleString("en-GB") : "Unknown"} />
          <Row k="End reason" v={m.endReason} />
          <Row k="Exploration time used" v={<span className="tabular">{formatMMSS(m.timeConsumedMs)}</span>} />
        </dl>
        <div className="mt-5 flex gap-3 print:hidden">
          <button type="button" className={bigButtonSecondaryClass} onClick={() => window.print()}>Print / save as PDF</button>
          <Link href="/missions" className={bigButtonSecondaryClass}>All missions</Link>
        </div>
      </header>

      <section className="border-b border-border py-6" aria-labelledby="stats">
        <h2 id="stats" className="text-xl font-bold">Exploration statistics</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Recorded distance" v={st.distanceMu == null ? "Unavailable" : `${st.distanceMu} mu`} />
          <Row k="Average navigation speed" v={st.averageSpeedMuPerS == null ? "Unavailable" : `${st.averageSpeedMuPerS} mu/s`} />
          <Row k="Saved observations" v={String(st.observationCount)} />
          <Row k="Telemetry coverage" v={st.telemetryCoveragePct == null ? "None" : `${st.telemetryCoveragePct}% of billed time`} />
          {st.environment.map((e) => (
            <Row key={e.label} k={e.label} v={`${e.value} ${e.unit}`} />
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{st.speedDefinition} mu = map units, not calibrated to metres.</p>
        {st.telemetryNotes.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-warn">
            {st.telemetryNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b border-border py-6" aria-labelledby="obs">
        <h2 id="obs" className="text-xl font-bold">Observations ({r.observations.length})</h2>
        {r.observations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No observations were saved during this mission.</p>
        ) : (
          <ol className="mt-4 grid gap-5">
            {r.observations.map((o, i) => (
              <li key={o.siteId} className="rounded-lg border border-border bg-panel/60 p-4">
                <h3 className="font-bold">
                  {i + 1}. {o.name} <span className="font-normal text-muted-foreground">· {o.category}</span>
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Site {o.siteId} · X {o.coordinates.x}, Z {o.coordinates.z} mu · scanned{" "}
                  {new Date(o.scannedAt).toLocaleString("en-GB")} · dataset {o.datasetVersion} · {o.source}
                </p>
                <table className="mt-3 w-full max-w-md text-sm">
                  <tbody>
                    {o.attributes.map((a) => (
                      <tr key={a.label} className="border-b border-border/50">
                        <th scope="row" className="py-1 pr-4 text-left font-normal text-muted-foreground">{a.label}</th>
                        <td className="py-1 tabular">{a.value} {a.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm">{o.interpretation}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="py-6" aria-labelledby="sum">
        <h2 id="sum" className="text-xl font-bold">Summary</h2>
        <p className="mt-2 text-sm">{r.summary}</p>
        {r.hypotheticalQuestions.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Hypothetical questions (not objectives)</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
              {r.hypotheticalQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-6 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">{r.integrityStatement}</p>
      </section>
    </article>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
