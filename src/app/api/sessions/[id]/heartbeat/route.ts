import { z } from "zod";
import { heartbeatInput } from "@/shared/contracts";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, DomainError, handle, ok, parseBody } from "@/server/http";
import { sessions } from "@/server/sessions/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("session.heartbeat", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    const input = await parseBody(req, heartbeatInput);
    const snap = await sessions.heartbeat(actor.id, id, input.controllerToken, input.generation, input.seq);
    return ok({ ...snap, seq: input.seq });
  });
}
