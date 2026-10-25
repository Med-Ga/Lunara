import { z } from "zod";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, DomainError, handle, ok } from "@/server/http";
import { sessions } from "@/server/sessions/service";
import { finalizeReport } from "@/server/missions/service";

// Explicit retry of report generation (only replaces a FAILED report; READY is immutable).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("missions.report", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    await sessions.snapshot(actor.id);
    const { report } = await finalizeReport(actor, id);
    if (!report) throw new DomainError("SESSION_NOT_CLOSED");
    return ok({ report });
  });
}
