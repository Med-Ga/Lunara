// Registers the Stripe TEST webhook for a deployed origin and stores its signing secret
// in .env.webhook (git-ignored) so it can be copied to Vercel without printing it.
// Usage: node --env-file=.env scripts/setup-webhook.mjs https://your-app.vercel.app
import Stripe from "stripe";
import { writeFileSync } from "node:fs";

const origin = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(origin)) {
  console.error("Pass the deployed https origin, e.g. https://saas-hackathon.vercel.app");
  process.exit(1);
}
const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a TEST key");
  process.exit(1);
}
const stripe = new Stripe(key);
const url = `${origin}/api/webhooks/stripe`;

// A signing secret is only returned at creation, so replace any existing endpoint for this URL.
for (const ep of (await stripe.webhookEndpoints.list({ limit: 100 })).data) {
  if (ep.url === url) await stripe.webhookEndpoints.del(ep.id);
}
const ep = await stripe.webhookEndpoints.create({
  url,
  enabled_events: [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ],
  description: "LUNARA test-mode fulfillment",
});
writeFileSync(new URL("../.env.webhook", import.meta.url), `STRIPE_WEBHOOK_SECRET=${ep.secret}\n`);
console.log(`Webhook ${ep.id} -> ${url}`);
console.log("Signing secret written to .env.webhook (not printed). Add it to Vercel as STRIPE_WEBHOOK_SECRET.");
