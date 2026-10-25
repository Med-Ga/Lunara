# LUNARA pitch: the story script (5 min + questions)

Deck (keywords only): shared by A — the same script is in each slide's speaker notes.
Live app: https://lunara-space.vercel.app
**Team:** Mohamed Gouja, Youssef Essif, Aziz Benjaa, Aziz Chebbi
Speakers: **A** = builder/demo · **B** = design · **C** = story/business. Rehearse 3 times with a timer.

The story arc: **2035 → nobody can look → minutes, not missions → how → why it's trustworthy → proof (demo) → who wins → how we earn → closing line.**

---

### 1. Cover — "LUNARA · Explore Beyond Earth" (C, 15 s)
"Good morning. We are Mohamed, Youssef, Aziz and Aziz, and this is LUNARA.
Before we explain anything, we want to take you on a short trip… to the year 2035."

### 2. Story — "2035 · Robots on the Moon. Robots on Mars." (C, 30 s)
"It is 2035. Robots are working on the Moon and on Mars. They carry cameras, they drive across craters, they look at rocks no human has ever seen.
Now imagine a 14-year-old student in Tunis. Or a science teacher. Or simply someone who loves space.
They would love to look through those cameras, even for one minute.
Today… they can't. And in 2035, without something like LUNARA, they still won't."

### 3. Problem — "Closed · Scarce · Unreachable" (C, 35 s)
"Why can't they? Three reasons.
**Closed:** space robots belong to agencies and a few companies. There is no public door.
**Scarce:** robot time is rare and expensive. Every minute must be shared fairly and counted honestly.
**Unreachable:** there is no simple service where a school or a fan can book a few minutes, pay, and keep a record of what they saw.
The robots exist, the people exist… but nothing connects them."

### 4. Solution — "Minutes, not missions · Mars $10/min · Moon $7/min" (C, 30 s)
"That is why we built LUNARA. Minutes, not missions.
You don't build a rocket or own a robot. You buy a few minutes, choose Mars or the Moon, and explore it in first person until your time runs out.
Mars costs more because a robot there is further away and harder to operate.
We can't connect to a real robot yet, so we built the full service around a realistic 3D simulation. Everything else — accounts, payments, the clock, the reports — is real and working."

### 5. How it works — "Sign up → Buy → Explore → Scan → Report" (B, 35 s)
"The user journey in five words.
**Sign up:** an account with email and password.
**Buy:** choose a world, pay with Stripe; minutes appear only after Stripe confirms.
**Explore:** press Start, the clock begins. It runs on our server, so refreshing or opening a second tab never gives free time. Even standing still, time counts — like a real robot booking.
**Scan:** near an interesting rock, press E; the observation is saved.
**Report:** when time ends, LUNARA writes a mission report you keep forever in your Discoveries archive."

### 6. Architecture — "Browser displays · API checks · Database decides · Stripe signed · Heartbeat 5 s · Lease 15 s" (A, 40 s)
"How do we make sure nobody cheats the clock or the payment? Displays, checks, decides.
The **browser** only displays: the countdown is a picture of the time, never the real time.
The **API**, our server on Vercel, checks every request: who you are, where it comes from, whether the data is valid.
The **database** decides: every change of money or time happens in locked database functions, one account at a time. Two tabs, a refresh or a duplicated payment message can never create extra minutes.
**Stripe** sends signed messages, so nobody can fake a payment.
Every 5 seconds the browser sends a **heartbeat**. If the internet drops, the 15-second **lease** expires and billing stops by itself. You never pay for time you couldn't use."

### 7. What we used, and why (A, 35 s)
| Tool | What it does for us | Why we chose it |
|---|---|---|
| **Next.js** | Website + server in one app | One thing to build and deploy; fast for a small team |
| **Supabase** | Login + PostgreSQL database | Secure login out of the box; real transactions for money/time |
| **Stripe** | Payments (test mode) | Trusted card page; we never touch card numbers |
| **Three.js / React Three Fiber** | 3D worlds in the browser | Nothing to install; works on any laptop |
| **Vercel** | Hosting | New version online about 1 minute after each push |
| **TypeScript** | The programming language | Catches mistakes before users see them |

Say: "We chose tools that let a small team build something real and secure, fast. Most have free plans, so today the platform costs almost nothing to run."

### 8. Live demo — "One minute on the Moon" (A drives, C narrates, 90 s)
C: "Enough talking. Let's go to the Moon."
1. Dashboard → Moon → buy 1 minute → card `4242 4242 4242 4242`. "Stripe test mode, no real money."
2. "Time added." "The minute appears only after Stripe confirms."
3. Explore Moon → terrain loads. "Loading is free; the clock hasn't started."
4. Start → walk. "Clock running. Mini-map, telemetry: speed, distance, temperature."
5. Stand still 5 s. "Even standing still, time counts."
6. Reach the pillar, press **E**. "A geological site… saved. The marker turns green."
7. 00:00. "Time is up. Access closes by itself."
8. Open the report. "Written automatically: time, distance, what we scanned."
If anything fails → play the backup video: "Here is the same flow, recorded this morning."

### 9. Results — "55 tests · 2 worlds · 10 scan sites · 0 free minutes by cheating" (A, 25 s)
"This is not a mock-up; it's live today. 55 automated tests, 31 against the real database and Stripe: the same payment twice, two tabs at once, a lost connection, time ending at exactly zero."

### 10. Impact — "Schools learn · Fans explore · Operators earn" (B, 30 s)
"**Schools** book ten minutes on the Moon for a class; every student leaves with a report. **Fans** visit another world for the price of a cinema ticket. **Operators** get a ready platform to sell idle robot camera time. We open space exploration to people, not only agencies."
(These groups are our hypothesis; next step: interviews with teachers and fans.)

### 11. Business Model Canvas (C, 40 s)
| Block | Content |
|---|---|
| Key partners | Robot operators (future), Stripe, Supabase, schools |
| Key activities | Booking, billing, reports |
| Key resources | The platform, 3D worlds, site datasets |
| **Value proposition** | Minutes on another world, fair and prepaid, report included |
| Customer relationships | Self-service; the archive brings people back |
| Channels | Web app, school outreach, social media |
| Customer segments | Space fans → schools → museums → researchers |
| Cost structure | Payment fees, hosting, robot time (later) |
| Revenue streams | Prepaid minutes today; school packs and licences later |

### 12. How we make money — "$100 → −$3.20 → $0 → $96.80 kept" (C, 35 s)
"Customers pay before they explore. 10 minutes on Mars = **$100**. Stripe's standard card fee ≈ **$3.20** (2.9% + $0.30). Hosting today: **$0** on free plans. LUNARA keeps about **$96.80** before paying the robot operator.
When real robots arrive, we share revenue with operators: they earn from idle robot time, we earn a commission for booking, billing and reports. Every new world adds revenue without rebuilding the platform. Later: school packs and museum licences."
(Test prices — an illustration, not real sales. Operator share: "to negotiate, for example a revenue split.")

### 13. Questions? — "lunara-space.vercel.app" (C closes, all answer)
"In 2035 the robots will be there. With LUNARA, the people can be there too — one minute at a time. Thank you. Try it yourself at lunara-space.vercel.app."

---

## Ready answers (A → technical, B → users/design, C → business)
- **Hack the timer?** The screen shows a copy; the server owns the clock and recalculates on every request.
- **Payment sent twice?** Credited once: the account is locked and every Stripe event is recorded.
- **Close the tab?** Billing stops within 15 seconds.
- **Really the Moon?** A 3D model standing in for it; our product is the booking, billing and reporting layer real robots will need.
- **Scan values real?** Predefined simulated values, labelled in every report.
- **Why would people pay?** Hypothesis: fans and schools first; next step is interviews and a school pilot.
- **Tunisia / dinars?** Stripe doesn't support TND; for launch we'd add Konnect or Flouci.

## Demo checklist
- [ ] https://lunara-space.vercel.app opens; demo account logged in; Moon balance 00:00, some Mars minutes as backup
- [ ] Chrome, mouse, AZERTY checked (Z forward, Q/D turn, E scan)
- [ ] Backup video on the desktop; deck open in Present mode in another tab
- [ ] Decide who is speaker A, B and C
