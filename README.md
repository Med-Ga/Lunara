# LUNARA — Explore Beyond Earth

Hackathon prototype (Lumen 2.0 · Beyond 2030): buy prepaid minutes with Stripe **test mode**, then explore **simulated** Mars and Moon terrains in first person while a server-authoritative clock runs down.

Live: https://lunara-space.vercel.app · Docs: `PRODUCT.md`, `ARCHITECTURE.md`, `BUSINESS_REQUIREMENTS.md`, `PITCH.md`, `docs/assets.md`

## Team
Mohamed Gouja · Youssef Essif · Aziz Benjaa · Aziz Chebbi

## Stack
Next.js 16 (App Router) · React 19 · Tailwind + shadcn/ui · Supabase Auth + Postgres · Stripe Checkout (test) · React Three Fiber/Drei · Vercel

## How it works
- **Time is owned by the database.** `supabase/migrations/0001_lunara_core.sql` holds all balance/session logic in locked SQL functions (integer milliseconds, 15 s connection lease, one active session per account, controller generations for tabs).
- **Payments credit once.** Webhook and "Check payment" both call `verifyAndFulfill` → `lunara_fulfill_purchase` (event-ID + purchase-status guards).
- **The browser only displays.** `src/features/sessions/client/useExplorationSession.ts` renews the lease every 5 s and freezes on any doubt.

## Run locally (PyCharm terminal)
```bash
npm install
cp .env.example .env        # then fill in the values
npm run stripe:setup        # creates the 3 test prices, writes supabase/seed.sql
npm run db:migrate          # creates tables/functions and seeds packages
npm run dev                 # http://localhost:3000
```
Supabase: turn **Confirm email** off (Authentication → Providers → Email) for smooth demos.

## Tests
```bash
npm run typecheck
npm test                    # accounting math (unit)
npm run test:integration    # real database: credits, races, expiry, grants
npm run build
```

## Deploy (Vercel)
1. Vercel → Project → Settings → Environment Variables: add every key from `.env` except `SUPABASE_DB_URL`, and set `APP_ORIGIN=https://lunara-space.vercel.app`.
2. `npm run stripe:webhook -- https://lunara-space.vercel.app` → copy the value from `.env.webhook` into Vercel as `STRIPE_WEBHOOK_SECRET`.
3. Supabase → Authentication → URL Configuration: Site URL = the Vercel URL; add `http://localhost:3000/**` to redirect URLs.
4. Redeploy.

## Demo
Register → Pricing → Buy 1 minute (card 4242 4242 4242 4242, any future date/CVC) → Explore Mars → Start → Z/W S Q/A D + mouse → wait for 00:00 → Buy more time → Start again. Full script in `PITCH.md`.

## Honest limits
Simulated terrain (not Mars imagery), test payments only, desktop keyboard/mouse only. Terrain license must be verified (see `docs/assets.md`). A modified browser can still render the downloaded 3D file; what is protected is the server balance and session.
