import { z } from "zod";
import { stopInput } from "@/shared/contracts";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, DomainError, handle, ok, parseBody } from "@/server/http";
import { sessions } from "@/server/sessions/service";

// Controller Exit. Settles through server acceptance time; idempotent.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("session.stop", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    const input = await parseBody(req, stopInput);
    const snap = await sessions.stop(actor.id, id, input.controllerToken, input.generation);
    return ok(snap);
  });
}
