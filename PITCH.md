# LUNARA pitch (5 min + 5 min questions)

Deck: https://claude.ai/artifact/N3fq2zzjXHBJ7HhYSua9BB (share it with the team from the deck's Share menu).
Live app: https://lunara-space.vercel.app
Rehearse 3 times. A = builder/demo, B = design, C = pitch/business.

| Time | Slide (7-part plan) | Who | What to say / do |
|------|------|-----|------------------|
| 0:00–0:20 | Cover | C | "We are LUNARA. Imagine renting a few minutes of a robot's eyes on the Moon or Mars, like renting a scooter." |
| 0:20–0:55 | 1 · Problem | C | Robots will explore after 2030, but only agencies can use them. Robot time is scarce. No simple service to book, pay and keep a record. (No numbers unless sourced.) |
| 0:55–1:20 | 2 · Our solution | C | Buy minutes per destination (Mars $10/min, Moon $7/min, test prices), explore, scan, get a report. Today it is a simulation so the whole service can be shown working. |
| 1:20–1:50 | 3 · How it works | B | The 5-step SaaS pipeline. Key line: "The clock lives on our server: refresh or a second tab never gives free time." |
| 1:50–2:30 | 4 · Architecture | A | Browser only displays → API checks identity → locked database functions own time and money → Stripe signed webhook, credited once → 5 s heartbeat, 15 s lease. |
| 2:30–4:00 | 5 · Demo (live) | A drives, C narrates | Moon → buy 1 min → card 4242 4242 4242 4242 → "Time added" → load terrain (free) → Start → walk to the pillar ahead, press E (scan saved, map turns green) → stand still 5 s → let it hit 00:00 → open the report → Discoveries. |
| 4:00–4:15 | 5 · Results | A | 55 automated tests (31 against the real database and Stripe): double payments, two tabs, lost connection, expiry at exactly 00:00. |
| 4:15–4:45 | 6 · Impact & value | B then C | Who gains (schools, fans, robot operators), then the Business Model Canvas left to right. Segments are hypotheses: "we believe"; next step is interviews. |
| 4:45–5:00 | 7 · Q&A | All | "Questions? Try it yourself: lunara-space.vercel.app." |

## Demo checklist (before going on stage)
- [ ] Live link opens: https://lunara-space.vercel.app
- [ ] Demo account logged in, Moon balance 00:00 (so the purchase is live), Mars has some minutes as backup
- [ ] Chrome, mouse plugged in, AZERTY checked (Z forward, Q/D turn, E scan)
- [ ] Backup video recorded (2 min), on the laptop desktop
- [ ] Deck open in Present mode on a second tab

## Likely judge questions (short answers)
- **Can someone hack the timer?** The countdown on screen is only a display. The server records start time and deadlines; every request recalculates the real balance.
- **What if Stripe sends the payment twice?** Each payment is credited once: the account is locked, the purchase is checked, and every Stripe event ID is recorded.
- **What if the user closes the tab?** The page tries to stop the session; otherwise the server stops billing at the 15-second lease.
- **Is it really the Moon / Mars?** No. 3D landscapes standing in for them; the product is the booking, billing and reporting layer a robot service would need.
- **Are the scan readings real science?** No. Predefined simulated values, clearly labelled in every report.
- **Who pays?** Hypothesis: space fans and schools first. Next step: interviews and a school pilot.
- **Why per-destination prices?** Robot time would cost more on Mars than on the Moon (distance, operations). Prices are test fixtures for now.

## Who does what (no Claude Code needed for B and C)
- **A:** architecture, live demo, technical questions.
- **B:** how it works, impact, design questions; checks the site on phone before the pitch.
- **C:** opening, problem, solution, business model canvas, timekeeping; holds the backup video.
