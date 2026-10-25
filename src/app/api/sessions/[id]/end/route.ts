import { scheduleReport } from "@/server/missions/service";
import { z } from "zod";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, DomainError, handle, ok } from "@/server/http";
import { sessions } from "@/server/sessions/service";

// Account-level "End session" from the dashboard (owner action, no controller token).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("session.end", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    const snap = await sessions.stop(actor.id, id, null, null);
    if (snap.session && snap.session.status !== "ACTIVE") scheduleReport(actor, snap.session.id);
    return ok(snap);
  });
}
