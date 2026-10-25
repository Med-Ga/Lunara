import { checkoutInput } from "@/shared/contracts";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, handle, ok, parseBody } from "@/server/http";
import { createCheckout } from "@/server/payments/stripe";

// Client sends ONLY a package id and request key; price/duration come from the server catalog.
export async function POST(req: Request) {
  return handle("checkout", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const input = await parseBody(req, checkoutInput);
    return ok(await createCheckout(actor, input.packageId, input.requestKey));
  });
}
