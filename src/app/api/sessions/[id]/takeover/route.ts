import { z } from "zod";
import { takeoverInput } from "@/shared/contracts";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, DomainError, handle, ok, parseBody } from "@/server/http";
import { sessions } from "@/server/sessions/service";

// Explicit recovery after refresh / from another tab. Compare-and-swap on generation.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("session.takeover", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    const input = await parseBody(req, takeoverInput);
    const snap = await sessions.takeover(
      actor.id,
      id,
      input.expectedGeneration,
      input.controllerToken,
      input.takeoverKey,
    );
    return ok(snap);
  });
}
