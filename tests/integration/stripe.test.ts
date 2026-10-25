// Verifies the seeded TEST prices produce the required Checkout totals (needs STRIPE_SECRET_KEY + SUPABASE_DB_URL).
// Creates unpaid test-mode Checkout Sessions only; nothing is charged.
import { describe, expect, it } from "vitest";
import pg from "pg";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const url = process.env.SUPABASE_DB_URL;
const d = key.startsWith("sk_test_") && url ? describe : describe.skip;

d("Stripe test Checkout totals per destination", () => {
  it("Mars 1 min = USD 1,000 cents; Moon 1 min = USD 700 cents; 10 min scale linearly", async () => {
    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    const { rows } = await c.query(
      "select id, stripe_price_id from public.packages where id in ('mars-1m','moon-1m','mars-10m','moon-10m')",
    );
    await c.end();
    const stripe = new Stripe(key);
    const totals: Record<string, [number | null, string | null, boolean]> = {};
    for (const r of rows) {
      const cs = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: r.stripe_price_id, quantity: 1 }],
        success_url: "http://localhost:3000/purchase-status",
        cancel_url: "http://localhost:3000/pricing",
      });
      totals[r.id] = [cs.amount_total, cs.currency, cs.livemode];
      await stripe.checkout.sessions.expire(cs.id);
    }
    expect(totals["mars-1m"]).toEqual([1000, "usd", false]);
    expect(totals["moon-1m"]).toEqual([700, "usd", false]);
    expect(totals["mars-10m"]).toEqual([10000, "usd", false]);
    expect(totals["moon-10m"]).toEqual([7000, "usd", false]);
  });
});
