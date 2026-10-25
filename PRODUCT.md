# LUNARA — Product Requirements

Version 2.0 · 25 October 2026 · Lumen 2.0 hackathon (Beyond 2030)

## 1. Product

- **Name:** LUNARA — Explore Beyond Earth
- **Tagline:** Rent a window on another world, by the minute.
- **Category:** Planetary exploration as a service.
- **Live:** https://lunara-space.vercel.app

LUNARA lets people buy prepaid minutes of exploration time for a destination (Mars or the Moon), explore it in first person, scan geological sites, and keep an automatically written mission report.

**Today:** a browser simulation. The landscapes are 3D models standing in for Mars and the Moon; payments run in Stripe test mode. No real robot, live imagery or real money is involved.
**Tomorrow:** the same booking, billing and reporting layer connected to robots operated by partners.

## 2. Problem

After 2030, robots will explore the Moon and Mars, but:

1. **Closed** — exploration hardware belongs to agencies and a few companies.
2. **Scarce** — robot camera time is limited and must be shared and counted fairly.
3. **Unreachable** — there is no simple service for a school or a space fan to book a few minutes, pay, and keep a record of what they saw.

## 3. Solution

"Minutes, not missions." Customers buy time per destination, explore until the clock runs out, scan sites with one key, and receive a mission report saved in their archive.

| Destination | Price (test mode) | Packages |
|---|---|---|
| Mars | $10 / minute | 1 · 5 · 10 minutes |
| Moon | $7 / minute | 1 · 5 · 10 minutes |

Mars costs more because remote operation there would be further away and harder.

## 4. Users

| User | Goal |
|---|---|
| Visitor | Understand the offer, see prices, create an account |
| Customer without time | Choose a destination and buy minutes |
| Explorer | Load a world, start a session, navigate, scan, exit |
| Returning customer | Read past reports, buy more time |

Target segments (hypotheses to validate): space enthusiasts, schools and universities, science museums, and later research teams.

## 5. Features (implemented)

1. **Accounts** — register, log in, log out (Supabase Auth). Protected pages and APIs.
2. **Destinations** — Mars and Moon cards on the dashboard: preview, description, price per minute, the user's balance for that destination, Buy and Explore actions.
3. **Per-destination prepaid time** — time bought for one destination can only be used there. Balances are stored on the server in milliseconds.
4. **Stripe test checkout** — the user chooses a package; the server creates the Checkout from its own catalog. Minutes are credited only after the server verifies the payment with Stripe, exactly once.
5. **Server-controlled sessions** — explicit Start after the terrain has loaded. Time runs continuously while active, even when standing still. One active session per account, across all destinations. Exit keeps unused time. Automatic expiry at 00:00.
6. **3D first-person exploration** — Z/W forward, S back, Q/A and D turn, mouse look, Escape frees the mouse. Ground following and safe boundaries.
7. **Mini-map** — position, facing direction, boundaries and observation sites (unscanned, saving, saved, failed).
8. **Geological scanning** — 5 sites per destination. Near a site, press E; the server validates the session, destination, proximity and saves one observation per site per mission.
9. **Telemetry panel** — destination, remaining time, speed, distance, coordinates, heading, simulated temperature, saved discoveries. Units are map units (mu), not metres.
10. **Mission reports** — written automatically when a session ends (exit, time used up or interruption) from saved data only. Includes mission info, statistics, observations with their simulated values, a summary and an integrity statement.
11. **Discoveries archive** — list of past missions with destination, date, time used, end reason, observation count and report status; reports stay available with zero balance.

## 6. User flow

```
Landing → Sign up / Log in → Dashboard
  → choose Mars or Moon → Pricing (destination) → Stripe test Checkout
  → Purchase status (verified credit) → Explore <destination>
  → terrain loads (free) → Start (billing begins)
  → navigate · scan with E · mini-map · telemetry
  → Exit or 00:00 → Mission report → Discoveries archive
  → buy more time → new session
```

## 7. Billing and session rules

- 1 minute = 60,000 ms. The server stores and counts integer milliseconds.
- Loading the terrain is free; billing starts when the server accepts Start.
- Time is consumed while the session is active, moving or not. Escape does not pause.
- The browser renews the session every 5 seconds. If renewals stop, billing ends at most 15 seconds after the last accepted renewal.
- Refreshing recovers the same session; another tab must explicitly take over.
- Changing destination requires ending the current session and starting a new one.
- At zero the session closes and the scene is disabled; new credit never reopens a closed session.

## 8. Honesty rules (shown in the product)

- Every page that matters says: simulated exploration, test payments only.
- Scan values are predefined simulated values with units, labelled as such in reports.
- Each report ends with: "This report contains simulated observations generated within LUNARA's planetary exploration environment. It does not represent measurements collected by real extraterrestrial instruments."

## 9. Out of scope

Real payments, real robots or imagery, visible rover or vehicle physics, phone controller, more destinations, multiplayer, missions/quests/achievements, leaderboards, admin dashboard.

## 10. Business model

- **Revenue:** prepaid minutes today; school packs and institution licences later.
- **Costs:** payment fees (Stripe standard card fee 2.9% + $0.30), hosting (free plans while small), robot time from partners (later).
- **Example:** 10 minutes on Mars = $100 → Stripe ≈ $3.20 → hosting $0 → about $96.80 kept before the operator's share.
- **Local market:** Stripe does not support TND; for a Tunisian launch, add Konnect or Flouci.

## 11. Acceptance (verified)

- Register → buy (Mars $10, Moon $7 in Stripe test mode) → credit only for the chosen destination → load terrain → Start → navigate → scan → exit or expire → report → archive.
- Duplicate or concurrent payment events credit once; forged price or destination grants nothing.
- Two tabs, refresh, lost connection and expiry keep the timing rules.
- Other users' missions, reports and observations are not accessible.
- Automated tests: unit tests for accounting, map transform and reports; integration tests against the real database and Stripe (`npm test`, `npm run test:integration`).

## 12. Next steps

1. Interviews with teachers and space fans; a school pilot.
2. Partnership with a robot or lander operator.
3. Local payment methods for Tunisia.
4. More destinations once a real data source exists.
