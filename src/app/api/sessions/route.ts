import { startSessionInput } from "@/shared/contracts";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, handle, ok, parseBody } from "@/server/http";
import { policy, sessions } from "@/server/sessions/service";

// Explicit Start. Billing begins when this commits.
export async function POST(req: Request) {
  return handle("session.start", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const input = await parseBody(req, startSessionInput);
    const snap = await sessions.start(actor.id, input.destinationId, input.requestKey, input.controllerToken);
    return ok({ ...snap, policy: policy() }, 201);
  });
}
