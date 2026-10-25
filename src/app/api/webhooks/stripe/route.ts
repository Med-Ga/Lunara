import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { serverEnv } from "@/server/env";
import { rpc } from "@/server/db";
import { DomainError } from "@/server/http";
import { stripe, verifyAndFulfill } from "@/server/payments/stripe";


// Signed Stripe notifications. 400 = bad signature; 5xx = retryable; 2xx = committed/ignored.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature ?? "", serverEnv.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    if (event.livemode) {
      await rpc("lunara_record_event", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_checkout: null,
        p_livemode: true,
        p_outcome: "REJECTED",
        p_reason: "LIVEMODE",
      });
      return NextResponse.json({ received: true });
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const cs = event.data.object as Stripe.Checkout.Session;
      const res = await verifyAndFulfill(cs.id, { eventId: event.id, eventType: event.type });
      if (res.kind === "rejected") {
        console.warn(`[lunara] webhook rejected event=${event.id} reason=${res.reason}`);
        await rpc("lunara_record_event", {
          p_event_id: event.id,
          p_event_type: event.type,
          p_checkout: cs.id,
          p_livemode: false,
          p_outcome: "REJECTED",
          p_reason: res.reason,
        });
      } else if (res.kind === "not_paid") {
        // Completed but not paid: stays PENDING/UNPAID, never credited.
        await rpc("lunara_mark_purchase", {
          p_user: res.userId,
          p_purchase: res.purchaseId,
          p_status: "UNPAID",
          p_event_id: event.id,
          p_event_type: event.type,
          p_checkout: cs.id,
        });
      } else {
        console.info(`[lunara] webhook event=${event.id} purchase=${res.purchaseId} outcome=${res.outcome}`);
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const cs = event.data.object as Stripe.Checkout.Session;
      const purchaseId = cs.metadata?.purchase_id;
      const userId = cs.metadata?.user_id;
      if (purchaseId && userId) {
        await rpc("lunara_mark_purchase", {
          p_user: userId,
          p_purchase: purchaseId,
          p_status: event.type === "checkout.session.expired" ? "CHECKOUT_EXPIRED" : "UNPAID",
          p_event_id: event.id,
          p_event_type: event.type,
          p_checkout: cs.id,
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    if (e instanceof DomainError) {
      // Permanent mismatch (e.g. unknown purchase): record, acknowledge, never credit.
      await rpc("lunara_record_event", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_checkout: null,
        p_livemode: event.livemode,
        p_outcome: "REJECTED",
        p_reason: e.code,
      }).catch(() => undefined);
      return NextResponse.json({ received: true });
    }
    // Not committed: let Stripe retry.
    console.error(`[lunara] webhook processing failed event=${event.id}`, (e as Error).message);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
