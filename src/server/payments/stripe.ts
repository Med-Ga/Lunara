import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/server/env";
import { DomainError } from "@/server/http";
import { rpc, type PurchaseRow } from "@/server/db";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(serverEnv.stripeSecretKey, { maxNetworkRetries: 2, timeout: 10_000 });
  return client;
}

/** Reserve an owned purchase intent, then create (or recover) its hosted test Checkout. */
export async function createCheckout(
  actor: { id: string; email: string | null },
  packageId: string,
  requestKey: string,
): Promise<{ purchaseId: string; url: string }> {
  const purchase = await rpc<PurchaseRow>("lunara_reserve_purchase", {
    p_user: actor.id,
    p_package: packageId,
    p_request_key: requestKey,
  });
  if (purchase.status !== "PENDING") throw new DomainError("REQUEST_KEY_REUSED");
  if (purchase.checkout_url) return { purchaseId: purchase.id, url: purchase.checkout_url };

  const origin = serverEnv.appOrigin;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: purchase.expected_price_id, quantity: 1 }],
        client_reference_id: purchase.id,
        customer_email: actor.email ?? undefined,
        metadata: {
          purchase_id: purchase.id,
          user_id: actor.id,
          package_id: purchase.package_id,
          destination_id: purchase.destination_id,
        },
        payment_intent_data: { metadata: { purchase_id: purchase.id } },
        success_url: `${origin}/purchase-status?purchase=${purchase.id}`,
        cancel_url: `${origin}/purchase-status?purchase=${purchase.id}&canceled=1`,
      },
      // Stable key: a retried creation returns the same Checkout instead of a new one.
      { idempotencyKey: `lunara-checkout-${purchase.id}` },
    );
  } catch (e) {
    console.error("[lunara] stripe checkout create failed", (e as Error).message);
    throw new DomainError("PAYMENT_PROVIDER_UNAVAILABLE");
  }
  if (session.livemode) throw new Error("Live-mode checkout refused");
  await rpc("lunara_bind_checkout", {
    p_user: actor.id,
    p_purchase: purchase.id,
    p_checkout: session.id,
    p_url: session.url,
  });
  return { purchaseId: purchase.id, url: session.url! };
}

export type VerifyOutcome =
  | { kind: "fulfilled"; outcome: string; userId: string; purchaseId: string }
  | { kind: "not_paid"; userId: string; purchaseId: string; expired: boolean }
  | { kind: "rejected"; reason: string; purchaseId: string | null; userId: string | null };

/**
 * Retrieve the Checkout server-side, validate every payment fact, then run the
 * shared once-only fulfillment. Used by BOTH the webhook and the owner recheck.
 */
export async function verifyAndFulfill(
  checkoutId: string,
  opts: { expectedUserId?: string; expectedPurchaseId?: string; eventId?: string; eventType?: string },
): Promise<VerifyOutcome> {
  const cs = await stripe().checkout.sessions.retrieve(checkoutId, { expand: ["line_items"] });
  const purchaseId = cs.metadata?.purchase_id ?? null;
  const userId = cs.metadata?.user_id ?? null;

  const reject = (reason: string): VerifyOutcome => ({ kind: "rejected", reason, purchaseId, userId });
  if (cs.livemode) return reject("LIVEMODE");
  if (!purchaseId || !userId || cs.client_reference_id !== purchaseId) return reject("MISSING_BINDING");
  if (opts.expectedUserId && opts.expectedUserId !== userId) return reject("OWNER_MISMATCH");
  if (opts.expectedPurchaseId && opts.expectedPurchaseId !== purchaseId) return reject("PURCHASE_MISMATCH");
  if (cs.mode !== "payment") return reject("WRONG_MODE");

  if (cs.payment_status !== "paid" || cs.status !== "complete") {
    return { kind: "not_paid", userId, purchaseId, expired: cs.status === "expired" };
  }

  const items = cs.line_items?.data ?? [];
  if (items.length !== 1 || items[0].quantity !== 1 || !items[0].price) return reject("LINE_ITEMS");
  if (cs.amount_total == null || !cs.currency) return reject("NO_TOTAL");

  const res = await rpc<{ outcome: string }>("lunara_fulfill_purchase", {
    p_user: userId,
    p_purchase: purchaseId,
    p_checkout: cs.id,
    p_amount_total: cs.amount_total,
    p_currency: cs.currency,
    p_price_id: items[0].price.id,
    p_event_id: opts.eventId ?? null,
    p_event_type: opts.eventType ?? null,
  });
  if (res.outcome.startsWith("REJECTED")) return reject(res.outcome);
  return { kind: "fulfilled", outcome: res.outcome, userId, purchaseId };
}
