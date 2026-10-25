# LUNARA — Technical Architecture

Version 2.0 · 25 October 2026

## 1. Overview

One Next.js application deployed on Vercel, backed by Supabase (Auth + PostgreSQL) and Stripe (test mode).

```
Browser (Next.js pages, 3D scene)
   │  HTTPS, same-origin requests with session cookie
   ▼
Next.js API routes on Vercel ──► Stripe (Checkout, signed webhook)
   │  server-only secret key
   ▼
Supabase PostgreSQL — locked SQL functions own balances, sessions, scans, reports
```

**Principle: the browser displays, the API checks, the database decides.**
The browser is never trusted for identity, price, balance, elapsed time or payment result.

## 2. Stack

| Layer | Technology | Why |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript | Pages and API in one deployable app; typed code |
| UI | Tailwind CSS, shadcn/ui | Fast, consistent styling |
| 3D | Three.js, React Three Fiber, Drei | First-person terrain rendering in the browser, nothing to install |
| Auth | Supabase Auth (email + password) | Secure accounts without custom password handling |
| Database | Supabase PostgreSQL | Real transactions, row locks, constraints, row-level security |
| Payments | Stripe Checkout (test mode) | Hosted card page; signed webhooks |
| Hosting | Vercel | Deploys automatically from GitHub `main` |
| Tests | Vitest | Unit tests and integration tests against the real database and Stripe |

## 3. Source layout

| Path | Contents |
|---|---|
| `src/app/` | Pages: landing, pricing, login, register, dashboard, purchase-status, explore/[destination], missions, missions/[id] |
| `src/app/api/` | Route handlers: account, packages, checkout, purchases, webhooks/stripe, sessions (start, heartbeat, takeover, stop, end, observations), missions, logout |
| `src/server/` | Server-only modules: auth, env, http (errors, CSRF origin check), db (RPC wrapper), payments/stripe, sessions, missions (report builder + finalization) |
| `src/features/sessions/client/` | The single client session adapter (`useExplorationSession`) |
| `src/components/exploration/` | Terrain scene, heightmap, mini-map, telemetry panel, exploration page |
| `src/components/saas/` | Site chrome, buttons, auth form, purchase status, archive, report viewer |
| `src/config/destinations.ts` | Typed destination configuration (terrain, navigation, bounds, sites, environment) |
| `src/shared/contracts.ts` | Shared DTOs, zod validators, error codes |
| `supabase/migrations/` | 0001 core schema, 0002 destinations + discovery, 0003 scan plausibility |
| `scripts/` | Stripe price setup, webhook setup, migration runner |
| `public/models/` | Optimized terrains: `mars-terrain.glb` (7 MB), `moon-terrain.glb` (2.9 MB) |
| `tests/` | `unit/` and `integration/` |

## 4. Data model

| Table | Purpose | Key rules |
|---|---|---|
| `accounts` | One row per user | Legacy balance column retired (locked at 0) |
| `destination_balances` | Balance per user and destination | PK (user, destination); 0 ≤ balance ≤ 1 year in ms |
| `packages` | Catalog: destination, duration, price, Stripe price ID | Old packages deactivated, never deleted |
| `purchases` | Immutable purchase intent and price snapshot | Unique (user, request key); unique Checkout ID; CREDITED is final |
| `payment_events` | Processed Stripe event IDs | PK event ID (deduplication) |
| `exploration_sessions` | A session = a mission | One ACTIVE row per account (partial unique index); destination mars/moon |
| `mission_telemetry` | Accepted distance and sampled time per mission | Idempotent checkpoints by segment and sequence |
| `observations` | Saved scans with a frozen copy of the site data | Unique (mission, site) |
| `mission_reports` | Canonical report per mission | READY is immutable; FAILED can be retried |

All tables have row-level security enabled with no public policies; only the server role can read or write, and only through the `lunara_*` functions, which are granted to the server role alone. Every function checks ownership.

## 5. Time accounting

Each function locks the account row first, then reconciles the active session:

```
A = accounted_through   B = destination balance   L = lease deadline   N = now (≥ A)
E = A + B (exhaustion)  C = min(L, E) (cutoff)    T = min(N, C)
debit = max(0, T − A); balance −= debit; accounted_through = T
if N ≥ C: close at C → EXPIRED if E ≤ L else INTERRUPTED
```

- Integer milliseconds; no rounding per request; balance can never go negative.
- No background worker: deadlines are stored, and the next request settles up to the stored cutoff.
- **Start:** positive balance for that destination, no active session on the account, idempotent start key.
- **Heartbeat** every 5 s with sequence number and controller token (hashed in the database); each renewal extends the lease to 15 s. Replays never extend.
- **Takeover** (refresh or other tab): compare-and-swap on controller generation; the old tab is fenced out.
- **Stop:** settles to the server time of acceptance; repeated stops change nothing.

## 6. Payments

1. `POST /api/checkout` with a package ID and request key → the database reserves a purchase with the package's frozen price, currency, duration and destination.
2. The server creates the Stripe Checkout with an idempotency key derived from the purchase.
3. **Fulfillment** (shared by the signed webhook and the "Check payment" recheck): retrieve the Checkout from Stripe, require paid, test mode, matching owner, purchase, price, quantity 1, currency and total → `lunara_fulfill_purchase` credits the purchase's destination once, under lock, and records the event.
4. Duplicate events, different events for the same purchase and races all result in one credit. Unpaid, expired or mismatched payments credit nothing.

## 7. 3D exploration

- Each destination config defines terrain URL, scale, spawn, speed, traversable bounds, sites and simulated temperature.
- On load, a height grid is built once from the terrain vertices; movement samples it for ground height and rejects steps outside bounds, onto missing ground or up steep slopes.
- The renderer writes the camera pose to a mutable store; the mini-map (8 Hz), telemetry (4 Hz) and scan prompt (4 Hz) read it on their own timers, so the page does not re-render every frame.
- Controls are enabled only while the session is active; held keys are cleared on blur, pointer unlock and expiry.
- Terrains were optimized from the source models (texture resize, WebP, quantized geometry): Mars 39 MB → 7 MB, Moon 42 MB → 2.9 MB.

## 8. Scanning, telemetry and reports

- **Scan:** the browser sends only the site ID and its position. The server takes the site's coordinates, radius and values from its own dataset, checks the session is active, owned and controlled by this tab, the destination matches, the position is within the radius and plausible compared to the last accepted position, then inserts one observation per mission and site.
- **Telemetry:** heartbeats carry cumulative distance and active time per page segment; the server adds only the difference, rejects implausible jumps (speed limit × elapsed time) and ignores data after the session closes.
- **Reports:** built by a pure function from the closed session, accepted telemetry and saved observations. Generated after exit/expiry, and lazily when the archive or report page is opened (which also settles interrupted sessions). Saving is idempotent; a failure is recorded as FAILED and can be retried, and never affects billing.

## 9. Security

- Identity verified with Supabase on every protected request; user ID always comes from the verified session.
- Same-origin check on every state-changing request (CSRF protection); webhook uses Stripe signature verification instead.
- Input validated with zod; private responses are `no-store`.
- Secrets are server-only environment variables; nothing secret is sent to the browser or committed.
- Limitation: a modified browser can still render the downloaded 3D files; what is protected is the server balance, sessions and saved data.

## 10. Environment and deployment

Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_ORIGIN` (plus `SUPABASE_DB_URL` locally for migrations and tests).

| Command | Purpose |
|---|---|
| `npm run dev` | Local development (http://localhost:3000) |
| `npm run stripe:setup` | Create/reuse test prices and write `supabase/seed.sql` |
| `npm run db:migrate` | Apply pending migrations and the seed |
| `npm run stripe:webhook -- <origin>` | Register the Stripe webhook for a deployed origin |
| `npm test` / `npm run test:integration` | Unit / integration tests |
| `npm run build` | Production build |

Deployment: push to `main` → Vercel builds and deploys to https://lunara-space.vercel.app. Database migrations are applied separately with `npm run db:migrate` before deploying code that needs them. Migration 0002 moved each legacy balance 1:1 into Mars time; do not roll the database back, fix forward.
