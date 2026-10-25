import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required server environment variable ${name}`);
  return v;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseSecretKey() {
    return process.env.SUPABASE_SECRET_KEY || required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get stripeSecretKey() {
    const k = required("STRIPE_SECRET_KEY");
    if (!k.startsWith("sk_test_")) throw new Error("LUNARA only runs with a Stripe TEST secret key");
    return k;
  },
  get stripeWebhookSecret() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  get appOrigin() {
    return (process.env.APP_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
  },
  get heartbeatMs() {
    return Number(process.env.SESSION_HEARTBEAT_MS || 5000);
  },
  get leaseMs() {
    return Number(process.env.SESSION_LEASE_MS || 15000);
  },
};
