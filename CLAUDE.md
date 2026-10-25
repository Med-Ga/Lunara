# CLAUDE.md: SaaS Hackathon Project

## About me
- Beginner coder on Windows, using PyCharm. Project folder: C:\Workspace\Saas-hackathon
- Preparing for a SaaS hackathon where AI use is allowed. Team of 3.
- Explain things in simple words and ask before anything risky (installs, deleting files, git push).

## Next.js notes
@AGENTS.md

## Goal
MVP ONLY: the smallest version that works and demos well. Build a beautiful, working SaaS demo: one clear user, one painful problem, one core feature done really well. Polish matters more than the number of features.

## Tech stack
- Next.js + Tailwind CSS + shadcn/ui (front end, must look like a polished startup)
- Supabase (login + database, no custom backend)
- Stripe in TEST MODE (Free vs Pro plans, "Upgrade to Pro" checkout)
- Vercel (live link, deployed from GitHub): https://saas-hackathon.vercel.app (repo: github.com/Med-Ga/saas-hackathon)
- Claude API only if the core feature needs AI
- API keys go in .env, which must be in .gitignore. Never commit secrets.

## Team roles
- Me (A), builder: the ONLY person who changes code, always with Claude. Owns the GitHub repo. Builds everything: login, database, main feature, payments, landing page, pricing page.
- B, designer (no Claude Code): ideas only. Picks the name, logo, colors, font and example sites to copy the style of. Tests on phone using the live Vercel link and sends me feedback.
- C, pitch and business (no Claude Code): research, pricing, pitch deck, demo script, demo data, backup demo video, submission.
- Friends don't need Node.js or Git. They give me design ideas and feedback, and I turn them into code with Claude.
- Since only I code, we work on the main branch: no branches or merging needed.

## Roadmap (24h; stretch for 48h)
- Hours 0-2: pick the idea, write a 1-page spec (user, problem, 3-5 screens, what we're NOT building). Deploy a blank version immediately.
- Hours 2-10: core flow works end to end (sign up, core action, result). Ugly is OK.
- Hours 10-16: Stripe test checkout, dashboard, design applied everywhere, loading/empty states, mobile.
- Hours 16-20: FEATURE FREEZE. Bug fixes and polish only. Record a 2-min backup demo video.
- Hours 20-24: pitch (problem, live demo, pricing, what's next), rehearse 3x, submit 1 hour early.

## How we work
- Plan first for each feature, then build after I approve.
- One feature at a time: build, I test in the browser, then commit.
- For design: use the frontend-design plugin and Playwright to screenshot pages on desktop and mobile and fix what looks off.
- Never add features that aren't in the spec.
- Before the pitch, explain how the app works in simple words.
- After every finished feature, update PITCH.md (demo steps, what to say, who says it). Keep it short. By the end, the pitch must be ready.
- Save tokens: short answers, no long explanations unless asked, read only the files needed, no screenshots unless checking design.

## REMINDER: rename everything once the app name is chosen
When the team picks the app name, remind me and rename everything visible in the demo/pitch:
- App: page titles (browser tab "Create Next App"), logo/text, favicon, README
- Vercel domain (saas-hackathon.vercel.app -> <name>.vercel.app)
- Supabase: organization ("Peugeot 106"), project ("Saas_Hackathon"), login email sender name
- Stripe: business/product names on the checkout page (e.g. "<Name> Pro")
- GitHub repo name (optional)

## Known gotchas (handle when building)
- Supabase free plan sends only a few auth emails per hour: turn OFF "Confirm email" (Authentication > Sign In / Providers > Email) so demo sign-ups never get stuck.
- Supabase Authentication > URL Configuration: set Site URL to the Vercel link, add http://localhost:3000 to redirect URLs.
- Add the 4 keys from .env to Vercel (Project > Settings > Environment Variables), then redeploy.
- Create the Stripe "Pro" product + monthly price in test mode; show TND on the pricing page.
- Prepare a demo account with good demo data before the pitch.

## Hackathon rules note
Some hackathons require code to be written during the event. Until the hackathon starts, everything here is PRACTICE ONLY.

## Current tasks (practice setup, before the hackathon)
1. Check if Node.js (LTS) and Git are installed. If not, install them with winget and verify.
2. This folder currently has a PyCharm Python template (.venv, main.py). Ask me before removing anything.
3. Create a practice Next.js + Tailwind + shadcn/ui app, start it, and tell me which link to open.
4. Make sure .env exists and is in .gitignore.
5. Tell me which accounts I still need (GitHub, Vercel, Supabase, Stripe) and guide me through connecting each one.
6. Remind me to install the plugins myself with:
   /plugin install frontend-design@claude-plugins-official
   /plugin install playwright@claude-plugins-official


# CLAUDE.md — LUNARA Repository Instructions

Applies to this repository. Read this file before implementing or modifying LUNARA. This file is an implementation guide, not evidence that the application already exists or works.

## Product and scope

LUNARA — Explore Beyond Earth is a SaaS hackathon demonstration of prepaid access to hypothetical future planetary robotic cameras. The current product is a browser-rendered Mars simulation. It does not provide real robotics, live Martian imagery, or authentic planetary geography unless separately proven.

Required flow: landing → register/login → dashboard → choose test package → Stripe test Checkout → server-verified once-only credit → choose Mars → load and validate scene → explicit server-accepted Start → first-person exploration with continuous active billing → expiry/disabled navigation → purchase more → explicit new Start. Exit retains unused time according to the documented policy.

Five developers have nine elapsed hours, using GitHub feature branches, Claude Code and PyCharm. Prefer the existing coherent stack and small reliable modules. Do not add services merely to improve architectural fashion.

MVP includes one selected terrain and one playable Mars destination. Excluded: visible rover, wheel animation, phone controller, real charges, physical robotics, advanced vehicle physics, procedural planet generation, second playable world, multiplayer, chatbot, subscription implementation or admin dashboard. Simulated signal/latency decoration is optional and must not affect input or billing.

## Source of truth and known reconciliation items

Read `PRODUCT.md`, `ARCHITECTURE.md`, `API_CONTRACT.md` and your assigned section of `TASKS.md`. Inspect actual repository files and package scripts before editing. Preserve existing work; do not assume an empty repo or claim nonexistent assets/tests.

Order of authority: explicit current team/user decisions → product requirements for scope → architecture for technical invariants → frozen API contract for interface details → tasks for ownership/sequence. A conflict across these is a reconciliation task for the lead and affected owners, not permission to silently violate security or make each module choose a different behavior. Record decisions and update affected documents/contracts together.

Two explicit corrections govern older documents:

- **Controls are literal Z forward, S backward, Q turn left, D turn right, mouse look.** Escape unlocks the pointer/returns accessible UI. Q/D turn, not strafe. Do not implement old W/S/A/D defaults.
- **Loading and validation precede a new billable Start.** Opening the route is not Start. Reloading an existing active session does not pause its accepted billing interval.

The working asset path `public/models/mars-terrain.glb` is provisional. A corresponding browser URL is `/models/mars-terrain.glb`. Confirm the actual selected asset and centralized manifest; do not invent bytes, dimensions, license or a replacement map.

At document preparation, a matching `API_CONTRACT.md` was unavailable. LUN-02 must locate or define/review/freeze it before dependent production integration. Do not claim you read an absent file. Use isolated presentation/scene fixtures for independent work only; never create a competing production contract silently.

PRD proposals still requiring kickoff confirmation include the 5-second heartbeat/15-second lease, test prices, retained non-expiring credit/fixed spawn, Auth verification configuration and chosen provider/dependency setup. Use the documented provisional baseline consistently until the lead changes it; do not turn a proposal into a claim of approval.

## Ownership and collaboration

T1 owns SaaS pages, presentation components, dashboard/purchase states and HUD/overlays. T2 owns scene/model/manifest/navigation and asset notes. T3 owns Auth, provider clients, catalog/Checkout/payment verification and purchase routes. T4 owns SQL schema/functions/grants, account/session routes, accounting and the sole client session adapter. T5 owns integration, root config/lockfile/layout, shared types, source-document reconciliation, deployment and acceptance evidence.

Follow the detailed path matrix in TASKS.md. Edit only assigned files unless an explicit handoff is recorded. T4 owns all migration edits, including payment schema; T3 reviews credit validation. T5 coordinates package/shared contract changes. Do not concurrently install dependencies/change a lockfile or rewrite another role's files.

Use a separate clone/worktree for each developer. Do not start extra agents that edit shared ownership areas without a task assignment and isolation plan. Prefer small commits/PRs to integration. Never force-push shared branches, discard uncommitted work, reset someone else's changes, or resolve semantic conflicts by blindly selecting one side. T5 controls final merge/release. An individual task prompt does not authorize deploying unrelated projects or manipulating real payment accounts.

## Stack and project conventions

Use the repository's selected Next.js App Router, React/TypeScript, Tailwind/shadcn as needed, Three.js/R3F/Drei, Supabase Auth and its PostgreSQL database, Stripe test Checkout and Vercel deployment. Supabase supplies the PostgreSQL database; these are not separate competing stores. No new backend language, microservice, queue, WebSocket service, or persistent session timer process without a reviewed need.

Choose compatible stable versions using current official documentation and peer dependencies. Follow the existing package manager and lockfile. Keep server-only modules out of client imports. Browser/WebGL code belongs in client boundaries and must not run during server rendering. Inspect package.json for real commands; do not invent a command and report it passed.

Keep UI separate from provider verification and accounting. Use frozen shared DTOs and runtime validation; TypeScript alone does not validate input. Use explicit millisecond units and safe numeric serialization. Avoid generic abstractions that make the nine-hour implementation harder to integrate.

## Non-negotiable authentication and data security

- Verify identity on the server for every protected operation; derive actor ID from verified Auth state. Never trust a client user ID or unverified cookie user object.
- Check resource ownership again in privileged database functions. Page redirects are not sufficient API authorization.
- Enable RLS and restrict table/function grants. No anon/authenticated writes to balances, purchases, events or sessions, and no public execution of privileged mutation functions. Privileged server access bypasses RLS; application ownership checks remain required.
- Keep service-role/privileged Supabase keys, Stripe secrets and webhook secrets server-only. No NEXT_PUBLIC secrets, repository secrets, browser bundles, logs or sample screenshots containing credentials.
- Use validated inputs, parameterized DB calls, fixed internal return destinations, configured CSRF/origin protection for cookie mutations, HTTPS and private/no-store account responses. Webhooks use signature verification rather than browser CSRF.
- Errors expose safe domain/correlation codes, not another account's data, SQL, stack traces or tokens. Log useful purchase/session/request outcomes without raw sensitive payloads.
- No public manual credit/reset/time-travel endpoint. No release auth bypass or automatic mock success when providers fail.

## Payment invariants

Stripe must remain in test mode. Card entry is hosted by Stripe. Do not switch to live keys or real-money transactions.

Server catalog defines price, currency, quantity and duration. Reserve an owned immutable purchase intent before provider creation; stable request/provider idempotency keys recover timeouts without a new accidental Checkout. Follow the architecture's bounded unresolved-creation recovery policy. Do not trust the client amount/duration, redirect parameters, or a success page.

Verify the raw webhook body/signature before trusting events. Retrieve Checkout/line items server-side and validate paid status, test mode, account/intent binding, expected Checkout, Price, quantity, currency and exact total. Failed/unpaid/mismatched events grant zero. A canceled browser return is not conclusive provider failure.

The shared atomic fulfillment path must be used by both webhook and authenticated owned recheck. Deduplicate by event identity and also guard purchase CREDITED status/Checkout identity under lock. Different events for the same purchase must not grant twice. Commit purchase status, credit and processed event together; rollback on failure. Do not acknowledge successful fulfillment before commit. Retryable failures remain retryable; out-of-order failures never reverse an already credited purchase.

T3 verifies provider facts; T4 enforces credit atomicity. A chain of independent REST writes is not a transaction. No direct client balance mutation, manual demo grant, or mock purchase may substitute for actual provider acceptance evidence.

## Accounting and session invariants

Backend database time and committed records are authoritative. Frontend time is presentation only. Active time is consumed even when stationary. Never accept client elapsed duration, remaining balance, earlier stop time, or local wall clock as ledger truth.

Store integer milliseconds to avoid per-heartbeat/session rounding. Minutes convert to 60,000 ms. Serialize numeric values explicitly within safe limits. Lock the account first, then relevant session/purchase/event rows in the architecture's consistent order. Sample database time after lock acquisition. Use short SQL transactions and no provider network calls inside them.

Reconciliation for an ACTIVE session follows ARCHITECTURE §5.5: A=accountedThrough, B=settled balance, L=raw lease; N=current DB time clamped at least A; E=A+B; C=min(L,E); T=min(N,C). Debit max(0,T−A) once, update consumed/accountedThrough, close at C when N≥C. Equal exhaustion/lease cutoffs classify EXPIRED. Terminal rows do not accrue more usage or reopen. Account reads reconcile without extending lease.

Require positive effective balance, Mars allowlist and no effective active session on new Start. Enforce one ACTIVE row/account with locking plus a partial unique index. Durable start request identity returns the original session on retry, even after it ends; it never creates a second interval. Billing starts at server acceptance/commit, including when the HTTP response is lost. Normal client must load and validate the scene before sending Start.

Only one current controller renews. Store token hashes, generation and heartbeat sequence; verify owned identity plus controller binding. Duplicate/stale sequences return state without renewing. Explicit takeover uses expected-generation compare-and-swap and fresh credentials; exact retries do not increment or renew again. Old-generation heartbeat/controller stop must not affect the replacement. Owner-level End Session is a separate explicit action.

Use the confirmed kickoff policy; provisional defaults are 5-second renewal and 15-second raw lease, capped for authorization by balance exhaustion. No background worker is required: persisted deadlines define effective expiry, and later requests settle through that deadline. Do not charge until the next request arrival if the lease already expired. Browser dashboard polling must not keep a session alive.

Stop freezes client input immediately and asks the server to settle through acceptance or an earlier cutoff. If request delivery is uncertain, say exit is unconfirmed and the last accepted lease bounds the tail. Hidden pages stop renewing and attempt exit; unload delivery is best effort. Escape only releases pointer lock and does not pause billing.

Fulfillment settles prior use before adding once-only credit. Credit alone does not renew connectivity. Credit arriving after effective closure leaves a terminal session and available balance for explicit new Start. Never silently revive a terminal session. Preserve nonnegative balance and the conservation check: total credited ms minus total consumed ms equals settled account balance after reconciliation.

## Client adapter and 3D boundary

T4 owns the only session adapter and renewal loop. Use one in-flight heartbeat, monotonically ordered requests/responses, server timing/revision/generation, and a monotonic display clock such as performance.now. Conservative local deadlines cannot extend server authorization. A local countdown edit must not mint time. Show rounded-up positive seconds and zero at exhaustion; distinguish balance remaining from connection lease remaining.

Enable normal scene movement only when current authorization, readiness, visible page and active controls permit it. Fail closed on auth/network/graphics uncertainty. Recheck deadlines on focus; ignore stale responses; never auto-recover an old controller in a takeover loop. Freeze and cover/unmount interactive scene at expiry; held keys cannot continue moving. Unknown status is not success and unavailable balance is not zero.

T2's renderer accepts explicit enabled state and emits ready/error/context-loss events. It does not call payment or accounting APIs. Load the chosen licensed environment, validate ground/spawn and render readiness before Start. Do not start sessions from component mount/effects, including development double mounts.

Use literal Z/S/Q/D via normalized KeyboardEvent.key; ignore controls when editing text and test actual AZERTY behavior. Mouse looks; Q/D yaw, no strafing. Clear pressed keys on blur, hide, unlock, error or authorization loss. Use a fixed validated spawn, near-ground camera, lightweight raycast/proxy and safe boundaries. Reject missing ground or unsafe steps; a downward ray is not complete wall collision. Restrict the route rather than adding a rushed physics engine.

Inspect model format/size/scale/textures/decoder dependencies/license and record real findings in docs/assets.md. Do not rename another file format to GLB. Confirm deployed URL serves model bytes rather than a Git LFS pointer or error page. Coordinate external static delivery with T5 if needed. Before-start asset failures are uncharged; after-start failures freeze/request stop under the same interruption policy.

Security claim is limited to server entitlement/accounting and normal-client cutoff. Downloaded 3D assets cannot be made tamper-proof against a modified client. A replaced tab may display its old grant until its next rejection/deadline, but must not obtain further server renewal. Do not claim instant remote display revocation or real-robot security.

## UX and accessibility

Show simulation and test-payment labels; trustworthy package duration/price; effective time balance; explicit Ready/Start; active stationary billing; prominent countdown; accessible Exit; pending/failed payment; uncertain stop; session conflict/recovery; expiry and Buy More. Keep billed Start separate from loading. A success redirect does not unlock zero-balance exploration.

Standard pages require labels, visible keyboard focus, semantic controls, non-color-only status and useful error actions. Escape returns access to Exit. Focus expiry/error overlays appropriately; announce significant state changes rather than every second. Avoid head bob/shake/flashes/autoplay audio. Unsupported devices receive an uncharged explanation, not a claim of equivalent immersive access. Keep optional decoration out until mandatory gates pass.

## Tests, completion and release

Use TASKS task IDs and ARCHITECTURE AT tests/PRD C gates. Minimum critical tests: auth/ownership; genuine and invalid Stripe test fulfillment; duplicate/different-event/recheck races; exact 60−20 and subsecond math; rollback; zero-balance rejection; duplicate/concurrent starts; stale sequences/takeovers/stops; credit vs expiry; refresh/disconnect/restart; held-key expiry; actual asset controls/bounds/failure; accessible Exit; secrets/grants/no-store; complete hosted buy/explore/expire/repurchase journey.

Unit mocks do not prove SQL transaction behavior. Test races against actual database functions. Fixtures/test clocks belong only in isolated tests and must not become public runtime inputs. Record PASS/FAIL/BLOCKED/NOT RUN, actual command/observation, commit, tester and environment. Never claim benchmarks, deployment, licenses or tests were verified without evidence.

Before editing: read documents/current code, inspect git status and assigned ownership, identify missing dependencies. During work: implement the assigned task, preserve interfaces/invariants, make focused changes and test them. After work: report task IDs/status, files changed, tests actually run/results, blockers/config needs and next handoff. Stage explicit files and provide small reviewable commits/PRs. Mark DONE only after acceptance/review and integration merge.

Target feature freeze at 7.5 hours and release freeze at 8.5 hours. Cut optional visual polish/history/signal/extra packages first. Do not weaken auth, signatures, atomic accounting, concurrency or expiry to meet time. No broad dependency upgrades or unrelated refactors during freeze. T5 coordinates release/deployment; keep the last known working commit and honest demo fallback.

No code, API shape, or asset should be invented to conceal a missing requirement. Report the smallest concrete blocker, continue independent work within the assigned scope, and let the lead resolve contract/provider/product decisions. The required outcome is a working, truthful and testable paid-access simulation, not a larger unintegrated feature list.

