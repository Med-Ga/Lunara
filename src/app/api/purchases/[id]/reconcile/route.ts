import { z } from "zod";
import { requireActor } from "@/server/auth";
import { getOwnedPurchase, rpc, toPurchaseDTO } from "@/server/db";
import { assertSameOrigin, DomainError, handle, ok } from "@/server/http";
import { verifyAndFulfill } from "@/server/payments/stripe";

// "Check payment": asks Stripe for the real status and runs the SAME verified,
// idempotent fulfillment as the webhook. A return URL alone never credits time.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("purchase.reconcile", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("PURCHASE_NOT_FOUND");
    let p = await getOwnedPurchase(actor.id, id);
    if (!p) throw new DomainError("PURCHASE_NOT_FOUND");

    if (p.status !== "CREDITED" && p.stripe_checkout_id) {
      let result;
      try {
        result = await verifyAndFulfill(p.stripe_checkout_id, {
          expectedUserId: actor.id,
          expectedPurchaseId: p.id,
        });
      } catch (e) {
        if (e instanceof DomainError) throw e;
        console.error("[lunara] reconcile provider error", (e as Error).message);
        throw new DomainError("PAYMENT_PROVIDER_UNAVAILABLE");
      }
      if (result.kind === "not_paid" && result.expired) {
        await rpc("lunara_mark_purchase", {
          p_user: actor.id,
          p_purchase: p.id,
          p_status: "CHECKOUT_EXPIRED",
          p_event_id: null,
          p_event_type: null,
          p_checkout: p.stripe_checkout_id,
        });
      }
      p = (await getOwnedPurchase(actor.id, id))!;
    }
    return ok({ purchase: toPurchaseDTO(p) });
  });
}
