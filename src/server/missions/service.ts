import "server-only";
import { after } from "next/server";
import { rpc } from "@/server/db";
import { sessions } from "@/server/sessions/service";
import type { Actor } from "@/server/auth";
import { buildReport, maskEmail, type MissionData, type MissionReport } from "./report";

export interface StoredReport {
  status: "READY" | "FAILED";
  report: MissionReport | null;
  error: string | null;
  generatedAt: number;
}

type MissionDataWithReport = MissionData & { report: StoredReport | null };

export interface MissionListItem {
  id: string;
  destinationId: "mars" | "moon";
  status: string;
  startedAt: number;
  endedAt: number | null;
  endReason: string | null;
  consumedMs: number;
  observationCount: number;
  hasTelemetry: boolean;
  reportStatus: "READY" | "FAILED" | null;
}

export async function getMissionData(actor: Actor, sessionId: string) {
  return rpc<MissionDataWithReport>("lunara_mission_data", { p_user: actor.id, p_session: sessionId });
}

/**
 * Idempotent report finalization for a CLOSED mission. Billing is already final when this
 * runs; a failure here is recorded as FAILED (retryable) and never touches the session.
 */
export async function finalizeReport(actor: Actor, sessionId: string, data?: MissionDataWithReport) {
  const m = data ?? (await getMissionData(actor, sessionId));
  if (m.session.status === "ACTIVE") return { mission: m, report: null };
  if (m.report?.status === "READY") return { mission: m, report: m.report };
  let saved: StoredReport;
  try {
    const report = buildReport(m, maskEmail(actor.email));
    saved = await rpc<StoredReport>("lunara_save_report", {
      p_user: actor.id,
      p_session: sessionId,
      p_status: "READY",
      p_report: report,
      p_error: null,
    });
  } catch (e) {
    console.error(`[lunara] report generation failed session=${sessionId}`, (e as Error).message);
    saved = await rpc<StoredReport>("lunara_save_report", {
      p_user: actor.id,
      p_session: sessionId,
      p_status: "FAILED",
      p_report: null,
      p_error: "Report generation failed. Retry to generate it again.",
    });
  }
  return { mission: m, report: saved };
}

/** Best-effort finalization after the response is sent (closure already committed). */
export function scheduleReport(actor: Actor, sessionId: string) {
  try {
    after(async () => {
      await finalizeReport(actor, sessionId).catch((e) =>
        console.error(`[lunara] deferred report failed session=${sessionId}`, (e as Error).message),
      );
    });
  } catch {
    // Outside a request scope: the archive/report read path will finalize lazily.
  }
}

/** Archive page: reconcile first (closes lapsed sessions), then finalize missing reports lazily. */
export async function listMissions(actor: Actor, before: string | null, limit = 10) {
  await sessions.snapshot(actor.id);
  const items = await rpc<MissionListItem[]>("lunara_list_missions", {
    p_user: actor.id,
    p_limit: limit,
    p_before: before,
  });
  for (const it of items) {
    if (it.status !== "ACTIVE" && it.reportStatus !== "READY") {
      try {
        const r = await finalizeReport(actor, it.id);
        it.reportStatus = r.report?.status ?? null;
      } catch (e) {
        console.error(`[lunara] archive finalize failed session=${it.id}`, (e as Error).message);
      }
    }
  }
  return items;
}
