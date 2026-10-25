# LUNARA pitch (5 min + 5 min questions)

Updated by Claude as features are built. Rehearse 3 times. Use a fresh account + the 1-minute Demo Pass so expiry happens live.

| Time | Part | Who | What to say / do |
|------|------|-----|------------------|
| 0:00–0:40 | Problem + honesty | C | "After 2030, robots will be exploring the Moon and Mars, but only space agencies can use them. What if anyone could rent a few minutes of a robot's eyes?" Then: "Today's demo is a simulation: the terrain is a 3D model and payments are Stripe test mode." |
| 0:40–1:40 | Sign up + buy | A | Create account → Pricing → **Buy 1 minute** → card 4242 4242 4242 4242 → "Time added". Say: "Time is only added after our server verifies the payment with Stripe, never because the browser says so." |
| 1:40–2:05 | Prepare Mars | A | Explore Mars → terrain loads → "Loading is free: the clock hasn't started." → **Start exploration** |
| 2:05–3:05 | Explore + expire | A | Z/W forward, Q/A and D turn, mouse look. **Stand still**: "The clock keeps running, like a real robot booking." Let it hit 00:00 → "Session ended" screen appears by itself. |
| 3:05–3:45 | Buy again + restart | A | **Buy more time** → pay → Start again: new session, fresh spawn. |
| 3:45–4:30 | Why it's trustworthy | B | Server owns the clock: refresh, second tab or editing the timer can't add time. One payment = one credit, even if Stripe notifies twice. Lost connection: billing stops within 15 seconds. |
| 4:30–5:00 | Business + next | C | Prepaid minutes: Demo €1 · Explorer €4 · Horizon €10. Customers: space fans, schools, researchers. Next: real robot partners, Moon and more worlds, local payments (Konnect/Flouci for Tunisia). |

## Demo checklist (before going on stage)
- [ ] Live link opens: https://saas-hackathon.vercel.app
- [ ] Fresh email ready for sign-up (email confirmation OFF in Supabase)
- [ ] Spare account with a few minutes already bought (backup)
- [ ] Laptop: Chrome, mouse plugged in, keyboard layout checked (AZERTY: Z/Q/S/D)
- [ ] Backup video recorded (2 min)

## Likely judge questions (short answers)
- **Can someone hack the timer?** The countdown on screen is only a display. The server records start time and deadlines in the database; every request recalculates the real balance. Editing the page can't create time.
- **What if Stripe sends the payment twice?** Each payment is credited once: we lock the account, check the purchase is not already credited, and record each Stripe event ID.
- **What if the user closes the tab?** The page tries to stop the session; if it can't, the server stops billing at the last 15-second lease.
- **Is it really Mars?** No. It's a 3D landscape standing in for Mars. The product is the access + billing layer a future robot service would need.
- **Who pays?** Hypothesis: enthusiasts and schools first. Not validated yet; next step is interviews and a pilot with an education partner.

## Who does what (no Claude Code needed for B and C)
- **A:** live demo (clicks), answers technical questions.
- **B:** "why it's trustworthy" part; checks the site on phone before pitch.
- **C:** opening, business, closing, timekeeping; holds the backup video.
