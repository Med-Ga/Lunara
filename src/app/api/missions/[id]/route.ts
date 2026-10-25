import { connection } from "next/server";
import { z } from "zod";
import { requireActor } from "@/server/auth";
import { DomainError, handle, ok } from "@/server/http";
import { sessions } from "@/server/sessions/service";
import { finalizeReport, getMissionData } from "@/server/missions/service";

// Owned mission detail + report. Finalizes a missing report lazily (idempotent).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  return handle("missions.get", async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    await sessions.snapshot(actor.id); // settles a lapsed session so it can be finalized
    const data = await getMissionData(actor, id);
    const { mission, report } = await finalizeReport(actor, id, data);
    return ok({ mission: { ...mission.session, observationCount: mission.observations.length }, report });
  });
}
