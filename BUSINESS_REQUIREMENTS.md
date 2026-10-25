# LUNARA — Business Requirements Document (BRD)

**Planetary Exploration as a Service · LUNARA 2.0 — Planetary Discovery**  
**Version:** 1.0 · **Prepared:** 25 October 2026 · **Status:** Business proposal / hackathon BRD  
**Audience:** LUMEN 2.0 judges, product team, prospective education/research customers, potential infrastructure partners and investors  
**Document ownership:** LUNARA project team (five members)

> **Evidence and status convention.** **Existing (team-reported)** means the team has said the original LUNARA application works; its code has not been audited for this BRD. **Upgrade requirement** means a feature requested for LUNARA 2.0, not independently verified as deployed. **Future concept** means a potential commercial service requiring external partnerships and feasibility validation. **Illustrative assumption** means a planning input, not measured business performance. Stripe payments in the hackathon use **test mode and generate no actual sales revenue**. All in-app geological findings are **simulated**.

## 1. Executive Summary

As humanity develops infrastructure beyond Earth, access to robotic observation capacity, surface imagery and scientific instruments may become valuable but difficult for smaller organizations and individuals to obtain. Operating spacecraft and planetary robots requires expertise, capital, communications systems, mission governance and approvals. **LUNARA proposes Planetary Exploration as a Service:** a software marketplace and mission interface where eligible customers obtain time-limited access to approved exploration capacity without buying their own robotic hardware. Its first intended segments are science enthusiasts and education providers, with research organizations and infrastructure operators representing more demanding longer-term markets.

LUNARA's working hackathon demonstration uses a **simulated first-person planetary environment**, account login, destination selection, prepaid exploration time and a Stripe **test-mode** checkout. The LUNARA 2.0 product specification adds **Mars at $10 per minute** and **Moon at $7 per minute**, a mini-map, exploration telemetry, predefined synthetic geological observation sites, resource scanning, automatically generated mission reports and a persistent discovery archive. These reports provide an observable deliverable, but they **must not** be presented as real scientific data. The paid-time model is the intended revenue engine; no actual commercial sales have been established by this demonstration.

The commercial thesis is that LUNARA could eventually turn scarce, provider-authorized planetary observation capacity into a bookable digital service, initially tested through education and simulation before progressing to genuinely sourced data, scheduled observation tasks and potentially robotic partnerships. Its most important unanswered questions are **customer willingness to pay**, **the cost and availability of authentic robotic capacity**, and **whether operators will allow third-party access**. Therefore, this BRD treats the current product as a compelling feasibility demonstration and the extraterrestrial service as a business hypothesis requiring staged validation—not as a launched space-robotics business.

## 2. Project Objectives

### 2.1 Strategic objective and customer problem

**Strategic objective:** validate whether a trusted platform can make planetary exploration accessible through a destination-specific, prepaid time model, with durable scientific/educational outputs that justify the price. The product is **not** selling ownership of a location, guaranteed physical resource discovery, or an actual robotic command link in the current release.

**Proposed value by segment:**

| Segment | Job to be done | Potential reason to pay | Principal objection to validate |
|---|---|---|---|
| Individual space enthusiasts | Explore a convincing planetary environment personally | Interactive, time-limited experience and collectible session reports | Why pay rather than play a free simulation? |
| Schools, educators, science museums | Deliver engaging guided planetary exploration activities | A structured, repeatable learning exercise with an observation record | Is it affordable and useful for a class? |
| University/research teams | Examine or request observation of scientifically relevant locations | Future verified datasets, traceability and access scheduling | Synthetic data is not research-grade; is real access available? |
| Exploration infrastructure operators | Monetize pre-approved unused capacity or provide public engagement | Distribution, billing, user controls, demand aggregation | Safety, scientific priorities, command authority, liability and cost |

### 2.2 SMART-style success objectives

The targets below are **proposed validation thresholds**, not historical results. Their clocks start only after a pilot is authorized.

| ID | Objective | Proposed measurable target | Window | Evidence |
|---|---|---|---|---|
| OBJ-01 | Demonstrate an understandable SaaS journey | At least 80% of 20 moderated testers can complete planet selection → test purchase → exploration without staff intervention | First 30 days of user testing | Observed task-completion log |
| OBJ-02 | Make the pricing legible | At least 90% of 20 testers correctly identify Mars $10/min and Moon $7/min before checkout | First 30 days | Comprehension test |
| OBJ-03 | Demonstrate correct entitlements | Zero cross-planet time usage and zero duplicated credit across the agreed acceptance-test suite | Before LUNARA 2.0 demo release | Test results and audit log |
| OBJ-04 | Deliver scientific-style output | At least 90% of successful tested sessions generate the correct report, including empty-observation sessions | Before LUNARA 2.0 demo release | Report test matrix |
| OBJ-05 | Validate demand, not merely interest | Conduct at least 30 structured interviews across enthusiasts, educators and research users | 60 days after pilot launch | Interview notes, segment analysis |
| OBJ-06 | Test paid demand ethically | Run a clearly disclosed concept/pricing experiment, recording actual purchase intent separately from test checkout behavior | 90 days after validation launch | Experiment results and consented feedback |
| OBJ-07 | Assess partner feasibility | Obtain at least 3 exploratory conversations with relevant remote-instrument or planetary-data operators | 120 days after pilot launch | Partner feasibility notes |

**North-star candidate:** *completed paid-access exploration sessions producing a customer-viewable observation report*. For a commercial release, report this alongside paid minutes **actually consumed**, paying customers, gross margin and repeat purchases. For the present demo, track **test completions**, not real revenue.

### 2.3 Business KPI definitions

| KPI | Definition | Caveat |
|---|---|---|
| Checkout completion | Successful test checkouts ÷ initiated test checkouts | Technical funnel indicator only, not validated willingness to pay |
| Active exploring users | Distinct users with a valid exploration session in period | Distinguish test traffic |
| Paid minutes sold | Minutes purchased through **live** valid payments | **Zero confirmed actual sales** in test-mode prototype |
| Consumed minutes | Server-recognized exploration time consumed | May differ from minutes sold due to carry-forward balances |
| Planet revenue mix | Recognized Mars revenue vs Moon revenue | Requires live sales and a revenue-recognition policy |
| Observation capture | Completed scans ÷ sessions | Product engagement, not scientific quality |
| Report retrieval | Users opening their reports ÷ completed missions | Tests value of output |
| Repeat purchase rate | Live paying customers who purchase more than once ÷ live paying customers | Future metric |
| Contribution margin/minute | Net selling price minus attributable variable service cost | Actual robot access cost is not known |

### 2.4 Alignment with LUMEN 2.0 evaluation

The official specification assigns **30 points to SaaS/Solution Quality, 25 to Innovation & Creativity, 20 to Future Relevance, 15 to Technical Understanding & Defense, and 10 to Problem Significance** (100 total). A successful five-minute pitch should demonstrate the full paid-access flow, explain why scientific reports improve value, and clearly distinguish the simulation from future authorized robotic service. The prototype must actually work; visual polish alone is not sufficient. [S1]

## 3. Project Scope

### 3.1 Scope boundaries and delivery status

| Business capability | Scope | Current status for this BRD |
|---|---|---|
| Landing page, login, authenticated dashboard | In scope | Existing, team-reported functional |
| Prepaid time purchase and Stripe Checkout test flow | In scope | Existing, team-reported functional |
| Server-authoritative exploration timer and access expiry | In scope | Existing, team-reported functional |
| Mars first-person 3D navigation | In scope | Existing, team-reported functional |
| Moon map, destination selection, separate planet balances | In scope | **LUNARA 2.0 upgrade requirement; deployment not verified** |
| Mars $10/min and Moon $7/min prices | In scope | Approved upgrade requirement; live website state not inspected |
| Mini-map and location/resource markers | In scope | Upgrade requirement |
| Telemetry (heading, time, coordinates, speed, environment) | In scope | Upgrade requirement; physical values labeled simulated |
| Geological points of interest and E-to-scan interaction | In scope | Upgrade requirement; synthetic observations |
| End-of-session reports and discovery archive | In scope | Upgrade requirement |
| Real spacecraft, real Moon/Mars rover teleoperation, real science data | Out of current scope | Future concept only; no current access |
| Mission objectives, quests, achievements, phone rover controller | Excluded | Explicitly not part of LUNARA 2.0 |
| More playable planetary locations | Excluded | Only Mars and Moon in 2.0 |
| Live card charging, institutional subscriptions | Out of current demo scope | Future commercial options subject to approval |

### 3.2 Business rules defining the scope

- A destination is selected **before** buying or starting time-based exploration; a purchased minute is tied to **one destination**.
- The approved list price is **Mars $10/min** and **Moon $7/min** in USD. Displayed amounts and charged test prices must agree with a server-controlled price catalogue.
- The user's current planet-specific balance is reduced during an active session even if the camera stays still; the **server** determines authoritative consumption.
- Users cannot transfer cheaper Moon minutes to Mars, borrow time, or access another user's mission reports.
- Previously purchased legitimate time and historical test records must be preserved across any migration. Old balances need a documented allocation policy, proposed initially as Mars-specific after entitlement review.
- Reports are generated from saved scans and session records; a zero-scan session correctly reports **zero** discoveries. Simulation labels remain visible and prominent.
- Report access continues after exploration time expires; purchasing additional time is not required to read a report.

### 3.3 Out-of-scope distinction and future phases

LUNARA does **not** currently sell access to spacecraft or claim permission to issue rover commands. The next defensible steps are education pilots and authorized access to genuine datasets or **scheduled** remote observations. True physical resource sampling, autonomous navigation, rover ownership, communications relay procurement and spacecraft launches are not assumptions of the present SaaS product.

## 4. Stakeholders

No stakeholder identities, formal partnerships, investments or operator agreements have been supplied. Roles below are proposed or derived from the team structure.

| Stakeholder | Type | Interest / benefit | Role or responsibility | Influence / concern |
|---|---|---|---|---|
| Five-person LUNARA team | Internal | Demonstrable product, hackathon outcome, commercial learning | Product, engineering, design, billing/testing, integration | High; limited build time |
| Product owner / business lead | Internal | Clear value proposition, pricing, coherent scope | Prioritize requirements, accept demonstrations | High; over-scoping risk |
| Technical/integration lead | Internal | Secure, stable integrated app | Preserve architecture and delivery quality | High; payment/data errors |
| Space enthusiasts | External customers | Authentic-feeling access and satisfying discoveries | Pilot testing and feedback | Medium; price sensitivity |
| Schools / museum educators | External customers | Engaging structured science activity | Evaluate usability, age fit, class budgets | High potential; teaching fit |
| Universities / researchers | External customers | Traceable observations and eventual verified datasets | Critique scientific validity and data provenance | High future influence; synthetic-data limitation |
| Robotic mission / instrument operators | Future partners | Controlled access to spare approved capacity, outreach | Authorize access, own command safety, set usage and data rights | Critical future dependency |
| Stripe | Vendor | Safe transaction processing | Test checkout now; potential live payments later | High for payment workflow |
| Supabase / hosting providers | Vendors | Platform delivery | Authentication, database and hosting infrastructure | High operational dependency |
| LUMEN 2.0 judges and organizers | Program stakeholders | Honest working demo and strong problem framing | Evaluation and compliance | High near-term; 5-minute pitch |
| Regulators / space authorities / legal counsel | Future enablers | Treaty compliance, customer protection, privacy, liability | Advice, applicable authorization and oversight | Critical if physical operations occur |

**Governance:** project owner approves commercial promises; technical lead approves the access-control and billing release; an assigned reviewer validates simulation disclaimers; a future legal/mission operator contact must approve any claim of real instrumentation access.

## 5. SWOT Analysis

| **Strengths — internal** | **Weaknesses — internal** |
|---|---|
| Concrete prepaid SaaS customer journey; two destination prices; shareable report outputs; reusable web interface; differentiated story connecting exploration with observation | No real robotic access or validated scientific measurements; unproven willingness to pay at $10/$7 per minute; limited proof of educational value; small team, narrow environments; simulated experience may look like a premium game |

| **Opportunities — external** | **Threats — external** |
|---|---|
| More space exploration and commercial activity could produce data-access partnerships; classroom discovery tools; science outreach; future robotic scheduling and verified reporting | Free NASA data and high-quality simulations; future provider capacity may not be saleable; mission safety/insurance/regulatory restrictions; communication delay; IP/data rights; weak repeat demand; unfavorable minute-level operator costs |

**Interpretation.** The near-term strength is an end-to-end product demonstration, not exclusive control over space infrastructure. LUNARA should first test whether **structured discovery and report outputs** are valuable to educators and enthusiasts. It should then seek verified datasets or remote-instrument partnerships and demand evidence before claiming a scientific-services business. Free public mission archives are both a threat to an undifferentiated pay-to-view product and a potential inspiration for legitimately sourced educational experiences. NASA's Planetary Data System is publicly accessible. [S3]

**Critical external feasibility issue.** Current Mars vehicles are not joystick-driven in real time from Earth: communication delays make immediate command/response impractical. A future Mars product would need queued observation requests, delayed feedback or operator-approved autonomous execution—not the instantaneous movement depicted in the simulation. NASA explains typical one-way command delays on the order of **3–22 minutes**, depending on planetary geometry. [S4] A Moon-based service has smaller, but still nonzero, propagation delay; safety and operator permissions remain decisive.

## 6. Financial Statements

**Financial disclaimer.** The figures in this section are **illustrative USD business-planning scenarios, not financial statements of an operating company, market forecasts or evidence of revenue**. The existing Stripe test checkout does not move real money. Real robotic capacity and customer acquisition costs remain unquoted. Taxes, VAT/sales tax, FX, financing, refunds, depreciation and regulatory fees are excluded unless noted.

### 6.1 Revenue model and pricing catalogue

The proposed commercial model is **destination-specific prepaid access**, billed by minutes. Package prices are the user-approved list amounts, not market-tested prices.

| Duration | Mars ($10/min) | Moon ($7/min) |
|---|---:|---:|
| 1 minute | $10 | $7 |
| 5 minutes | $50 | $35 |
| 10 minutes | $100 | $70 |

**Formula for gross billings:** `Mars minutes purchased × $10 + Moon minutes purchased × $7`.

**Accounting distinction:** customer cash collected from advance purchases may initially be a service obligation/deferred revenue; it is not necessarily recognized as earned until exploration access is provided according to applicable accounting rules. The numerical scenarios below assume **all purchased minutes are consumed within the same forecast month**, with no unredeemed balance, taxes, discounts, payment disputes or refunds. This simplifying assumption must be revisited with live customer cohorts. For the prototype: **real billings = $0; real sales from Stripe test mode = $0**.

### 6.2 Three hypothetical monthly demand scenarios

Assume every customer purchases the listed minutes per month, with no churn within each scenario's monthly snapshot. Prices are fixed at their approved levels. "Customers" here are **hypothetical live paying customers**, not actual LUNARA users.

| Assumption / output | Conservative | Base case | Growth case |
|---|---:|---:|---:|
| Paying customers / month | 80 | 300 | 1,000 |
| Mars minutes / customer / month | 1 | 2 | 3 |
| Moon minutes / customer / month | 2 | 3 | 5 |
| Total Mars minutes | 80 | 600 | 3,000 |
| Total Moon minutes | 160 | 900 | 5,000 |
| **Gross monthly billings / earned sales, if fully consumed** | **$1,920** | **$12,300** | **$65,000** |
| **Illustrative annual equivalent (×12, constant)** | **$23,040** | **$147,600** | **$780,000** |

Example: base case = `300 × (2 × $10 + 3 × $7) = $12,300/month`. The growth case is a **sensitivity illustration**, not a claim that this demand is reachable.

### 6.3 Expense categories and funding

| Current software-demo expense | Basis / status | Future genuine remote-exploration expense | Basis / status |
|---|---|---|---|
| Web hosting and data storage | Vendor-tier dependent; not verified | Operator access/capacity fee | Unknown; negotiate with provider |
| Authentication, database, monitoring | May use limited free tiers during demo | Instrument scheduling and mission operations | Unknown; safety-led |
| Development time | Five-member team effort; unpaid/paid not specified | Mission data rights, processing, provenance | Contract dependent |
| 3D terrain/model license | Verify actual asset license | Communications and relay/service fees | Unknown and mission dependent |
| Testing, domain, support | Budget not supplied | Insurance, regulatory/legal, specialist support | Jurisdiction and activity dependent |
| Stripe test checkout | No real charges or commercial settlement | Live payment processing and refunds | Actual merchant contract dependent |

**Funding approach:** current prototype is assumed team-built, with actual funding **undisclosed**. A later commercial pilot might be funded through founder capital, a grant, incubator support or customer-sponsored research/education pilots; none is claimed secured. Do not commit to real operator costs before obtaining provider quotations and access authorization.

### 6.4 Unit economics — explicitly hypothetical future service

For a **worked financial sensitivity example only**, assume variable access/service costs of **$4 per Mars minute** and **$3 per Moon minute**. These amounts are **invented modeling assumptions**, **not quotes or estimates verified against any spacecraft operator**. Also assume monthly fixed operating expenses of $4,500 conservative, $6,000 base and $13,000 growth. The changing fixed cost reflects assumed support/operating scale, not actual vendor pricing.

| Monthly financial result | Conservative | Base case | Growth case |
|---|---:|---:|---:|
| Sales / recognized revenue under full-consumption assumption | $1,920 | $12,300 | $65,000 |
| Hypothetical Mars variable cost | $320 | $2,400 | $12,000 |
| Hypothetical Moon variable cost | $480 | $2,700 | $15,000 |
| **Contribution** | **$1,120** | **$7,200** | **$38,000** |
| Hypothetical monthly fixed costs | $4,500 | $6,000 | $13,000 |
| **Illustrative operating profit/(loss)** | **−$3,380** | **+$1,200** | **+$25,000** |
| Contribution margin | 58.3% | 58.5% | 58.5% |

**Base-case mechanics:** 600 Mars minutes + 900 Moon minutes = 1,500 minutes. Average selling price = `$12,300 / 1,500 = $8.20/min`. Average assumed variable cost = `$5,100 / 1,500 = $3.40/min`. Average contribution = **$4.80 per consumed minute**. This excludes payment fees and other transaction-level costs unless they are allocated into the assumed variable amounts; it is not a real gross margin estimate.

### 6.5 Illustrative income statement and cash-flow snapshot — base case

| Base case (assumes 12 identical months) | Illustrative Year 1 |
|---|---:|
| Gross recognized sales, all minutes consumed | $147,600 |
| Assumed variable service costs | −$61,200 |
| Contribution | $86,400 |
| Assumed fixed operating costs | −$72,000 |
| **Operating surplus before tax / financing** | **$14,400** |
| Separate hypothetical initial development/pilot investment | $36,000 |
| **Simplified year-one operating cash contribution minus initial investment** | **−$21,600** |

This is **not** an audited or GAAP/IFRS-compliant income statement or cash-flow statement. It assumes billed purchases are collected and redeemed immediately, and excludes changes in deferred revenue, receivables, payable balances, taxes, financing, asset depreciation and working capital. The $36,000 investment is a **hypothetical pilot setup amount** and may not describe actual hackathon spending.

### 6.6 Unit economics required for launch decisions

Actual future financial statements cannot be completed responsibly until the team knows: contracted provider cost per observation minute, scheduling/safety overhead, platform costs, expected utilization, acquisition costs, payment fees by customer geography, refund policies, session cancellation terms, and accounting treatment of unused prepaid minutes. Record each as **TBD**, not as zero.

## 7. Functional Requirements

These are **business capabilities and observable acceptance conditions**, not source-code or database prescriptions. **Must** denotes essential service behavior; **Should** indicates added value or launch hardening; **Could** indicates a low-risk enhancement if the approved scope permits. Status indicates existing team-reported functionality vs LUNARA 2.0 upgrade; it does not certify code deployment.

| ID | Business requirement | Business objective | Stakeholder | Priority | Acceptance criterion | Status |
|---|---|---|---|---|---|---|
| BR-001 | Visitors can learn what LUNARA offers and that the current service is simulated | Trust and comprehension | Visitor | Must | Simulation notice and value proposition visible before purchase | Existing + transparency requirement |
| BR-002 | Customers can register, log in and access their own account | Access management | Customer | Must | Logged-out user cannot access protected balance/session | Existing |
| BR-003 | Customers can view/select Mars and Moon before purchase | Clear product choice | Customer | Must | Selected planet appears in checkout and mission | Upgrade |
| BR-004 | Customer sees correct Mars $10/min and Moon $7/min prices and package totals | Pricing transparency | Customer | Must | Price is consistent across catalogue, checkout and purchase record | Upgrade |
| BR-005 | Customer can complete a Stripe **test** purchase | Demonstrate transaction workflow | Customer, jury | Must | Successful test checkout acknowledged; canceled checkout credits nothing | Existing + upgrade |
| BR-006 | Verified purchase credits only the purchased planet | Fair billing | Customer | Must | 5 purchased Moon minutes yield +5 Moon, +0 Mars | Upgrade |
| BR-007 | A repeated payment notification must never duplicate minutes | Financial integrity | Customer, team | Must | Replay of same verified event credits once | Existing rule preserved |
| BR-008 | Customers can view per-planet balances and purchase history | Balance transparency | Customer | Must | Balances persist across re-login | Upgrade |
| BR-009 | Customers can only begin a mission with valid paid time for selected planet | Entitlement control | Customer, owner | Must | Insufficient balance blocks session | Existing + upgrade |
| BR-010 | Purchased time is consumed while a session is active, including when stationary | Fair time accounting | Customer, owner | Must | Server-controlled elapsed time decrements correctly | Existing |
| BR-011 | Time cannot be multiplied by refresh or parallel sessions | Revenue protection | Owner | Must | No double-use or negative balance across multi-tab tests | Existing rule preserved |
| BR-012 | Access ends when the selected planet's paid time expires | Honest access policy | Customer, owner | Must | Movement/session denied after expiration | Existing + upgrade |
| BR-013 | Selected planet terrain loads and responds to first-person keyboard/mouse navigation | Usable exploration | Customer | Must | Mars and Moon launch with working controls | Existing Mars; Moon upgrade |
| BR-014 | Compact mini-map shows player position, heading and resource sites | Orientation | Customer | Should | Marker moves with camera; scanned sites change marker state | Upgrade |
| BR-015 | Telemetry shows time, position, orientation, speed, distance and simulated temperature | Situational awareness | Customer | Should | Labels identify derived/simulated values correctly | Upgrade |
| BR-016 | Users can discover nearby configured geological sites | Discovery experience | Customer | Must | Site proximity triggers scan affordance | Upgrade |
| BR-017 | Users can scan a site and save its predefined simulated observation once per mission | Observation record | Customer | Must | Recorded entry has planet, time, site and data provenance | Upgrade |
| BR-018 | Mission termination generates a report from saved events and metrics | Tangible deliverable | Customer | Must | One completed session produces correct report, including zero scans | Upgrade |
| BR-019 | Users can access prior missions and reports after session expiry | Customer retention | Customer | Must | Reports persist and are retrievable by their owner | Upgrade |
| BR-020 | User cannot access or change another person's purchases, observations or reports | Privacy and trust | Customer | Must | Authorization tests prevent cross-user access | Existing principle + upgrade |
| BR-021 | Historical purchased minutes remain valid through 2.0 migration | Customer trust | Existing customer | Must | Migration reconciles pre-upgrade and post-upgrade balances | Upgrade |
| BR-022 | No in-app claim treats synthetic geological observations as certified science | Scientific integrity | Educator, researcher, jury | Must | Explicit source label appears on scans/reports | Upgrade |
| BR-023 | Errors, load failure and interrupted sessions have a clear user message | Service usability | Customer | Should | User sees recovery path and truthful balance | Both |
| BR-024 | Customers may export or print a mission report | Shareability | Educator | Could | Export reproduces recorded findings and disclaimer | Optional |

**Explicitly excluded:** missions/objectives/quests, achievements, cellphone rover controller, visible physical rover, extra planets, live physical science claims and actual teleoperation in this prototype. No new requirement may override payment integrity, access control or truthfulness.

### 7.1 Business acceptance journey

`Understand simulation → Sign in → Select planet → See price → Test checkout → Planet-specific balance → Authorized mission → Simulated exploration & scans → Session closes → Report → Discovery archive → Optional repeat purchase`

Business acceptance requires all three tests: (a) Mars purchase and correct Mars report, (b) Moon purchase and correct Moon report, and (c) a Moon balance **cannot** fund a Mars mission. A mission with no scans still gets a truthful zero-observation report. Historical balances cannot be lost during upgrade.

## 8. Schedule and Deadlines

### 8.1 Hackathon milestones and confirmed context

The LUMEN 2.0 specification states the **pitch is scheduled for 25 October at 09:00**, with **five minutes of presentation including the demo plus five minutes of Q&A**. The team worked under a **nine-hour build constraint**. The initial application has been **reported completed and functional by the team**; the present BRD does not independently audit that claim. Moon/scanning/report additions are documented as **upgrade requirements**, not certified deployed functionality. [S1]

| Phase | Relative milestone / time constraint | Deliverable | Gate | Status |
|---|---|---|---|---|
| Original concept / MVP | Nine-hour hackathon build | Functional account, test purchase, Mars exploration and timer | End-to-end demo | **Team-reported complete** |
| LUNARA 2.0 baseline | Before modifying working code | Working version preserved and smoke-tested | No regression | Required verification |
| Destination / pricing expansion | Upgrade phase 1 | Moon terrain, planet selector, secure separate balances | Both purchases and access tested | Planned/unverified |
| Discovery interface | Upgrade phase 2 | Mini-map, telemetry, configured geological sites, scanning | Observations linked to proper mission | Planned/unverified |
| Research output | Upgrade phase 3 | Saved mission report and personal archive | Empty and multi-scan reports correct | Planned/unverified |
| Release / pitch stabilization | Before any presentation | Regression tests, fallback footage, demo account and honest disclaimers | Rehearsed full path | Pending verification |

**No new calendar implementation deadline is asserted.** The developer team must set any additional release dates based on verified work remaining, not derive them from the document date.

### 8.2 Commercial validation roadmap (proposed, not committed)

| Proposed phase | Relative window | Business milestone | Decision gate / dependency |
|---|---|---|---|
| Customer discovery | Months 0–2 after pilot kickoff | ≥30 interviews, classroom usability feedback, paid-value hypothesis | Is anyone willing to pay? |
| Simulation-based pilot | Months 2–3 | Test educational/consumer engagement and report usefulness | Is there repeat demand beyond novelty? |
| Feasibility / rights | Months 3–6 | Identify data partners, model licensed authentic data and operator restrictions | Can genuinely authorized observations be offered? |
| Institutional pilot planning | Months 6–9 | Design scoped school/research offer, pricing and policies | Are economics and provenance acceptable? |
| Remote instrument integration feasibility | Timing TBD | Provider-approved observation scheduling or dataset delivery | Contracts, safety, regulatory and technical approval |

Later phases are explicitly **conditional** on evidence and partners. No partnership, live launch or commercial date is guaranteed.

### 8.3 Risk and time-buffer rule

Before the pitch or other delivery cutoff, freeze scope, test the complete purchase-to-report path, keep one known-working release, verify a test account and assets, and prepare screenshots/video strictly labeled as a fallback—not as a live interaction. If the schedule slips, prioritize account, price correctness, one playable map, timer safety and report truthfulness over optional export and cosmetic refinement.

## 9. Cost–Benefit Analysis

### 9.1 Types of value and costs

**Tangible potential benefit:** prepaid minute sales, future institutional capacity packages and repeat purchases. **Intangible benefit:** education engagement, interest in planetary science, visibility for future providers and useful structured session history. Intangible benefits are **not counted as cash profit**.

**Relevant costs:** initial development, asset rights, ongoing web operations, payment processing, support, customer acquisition, refunds and, crucially, potential operator costs for genuine physical exploration. The greatest unknown is whether a real operator would supply usable capacity at costs below willingness-to-pay prices.

### 9.2 Break-even calculation — base-model assumptions

With the **illustrative** mix of 40% Mars minutes and 60% Moon minutes, and variable costs of $4/Mars min and $3/Moon min:

- Weighted selling price = `0.40 × $10 + 0.60 × $7 = $8.20/min`.
- Weighted variable cost = `0.40 × $4 + 0.60 × $3 = $3.40/min`.
- **Contribution per minute = $4.80/min**.
- Assumed monthly fixed costs = **$6,000**.
- **Monthly break-even consumption = $6,000 / $4.80 = 1,250 minutes**.
- If a hypothetical average buyer purchases 2 Mars and 3 Moon minutes monthly, contribution/buyer = `2×$6 + 3×$4 = $24`, giving **250 paying customers/month** to cover $6,000 fixed costs.

The assumed **base case** is 300 customers buying 1,500 total minutes/month, yielding a hypothetical **$1,200/month** operating surplus. This is only arithmetic under the model assumptions and excludes costs not allocated to the model.

### 9.3 Payback and discounted cash flow

Assume a one-time **hypothetical $36,000** pilot investment and a stable base-case **$14,400/year operating cash contribution** with no growth, tax, reinvestment or working-capital changes:

- **Simple payback = $36,000 / $14,400 = 2.5 years (30 months).**
- **Simple annual operating surplus / initial investment = 40%.** This ratio is **not** a fully risk-adjusted investment return.
- At a hypothetical **10% annual discount rate**, three-year net present value is `−$36,000 + Σ($14,400 / 1.10^t), t=1..3 ≈ −$189`.

The almost-zero three-year NPV is fragile: lower demand, slow collection, additional operator expenses or delays could turn it significantly negative. These are not investor-grade forecasts.

### 9.4 Sensitivity to unknown operator costs — 300-customer base case

Hold revenue **$12,300/month**, Mars minutes **600**, Moon minutes **900**, fixed costs **$6,000/month**.

| Hypothetical cost per minute (Mars / Moon) | Monthly variable cost | Contribution | Monthly operating result |
|---|---:|---:|---:|
| Low: $2.00 / $1.50 | $2,550 | $9,750 | **+$3,750** |
| Working model: $4.00 / $3.00 | $5,100 | $7,200 | **+$1,200** |
| High: $8.00 / $6.00 | $10,200 | $2,100 | **−$3,900** |

Even strong sales cannot rescue a product whose true cost/minute exceeds available gross margin. Conversely, simulation-based educational experiences may have a very different cost structure from scarce physical observation capacity, **so they must be modeled as separate businesses rather than conflated**.

### 9.5 Critical business assumptions and decision tests

| Hypothesis | Evidence today | Key missing evidence | Proposed test | Failure consequence |
|---|---|---|---|---|
| People will pay $10/Mars min and $7/Moon min | Prices are defined in the product; test checkout is functional by team report | Real conversion and customer willingness to pay | Pricing interviews, ethical landing-page experiment, limited live pilot once authorized | Re-price or change offer |
| Reports make exploration worth paying for | Structured simulated reports specified | User usefulness, repeat behavior | Educator task study and repeat-intent experiment | Reports may be decorative rather than a value driver |
| Institutions will buy repeated access | Plausible use cases only | Budgets, procurement, learning outcomes | Interviews and classroom pilot | Remain hobbyist/consumer experience |
| Real operators can provide saleable capacity | No provider agreement | Availability, data rights, safety, price, service levels | Obtain provider feasibility assessments and indicative terms | Cannot progress to authentic remote exploration |
| Future Mars sessions can be sold as live joystick control | **Contradicted by light-time limitations** | Acceptable delayed/queued service design | Prototype scheduling and delayed feedback; operator review | Must change service promise |
| Per-minute margins cover operating costs | Scenario math only | Real all-in direct costs | Partner quotes and live operational modeling | Unsustainable unit economics |
| Access/data use can be legally provided | Treaty framework exists; no permission evidenced | Jurisdiction, space-operator authority, licenses and contracts | Specialist legal and operator review | Commercial offering cannot launch |

### 9.6 Preliminary commercial assessment

LUNARA has a **clear proposed monetization unit**—authorized exploration minutes—with a straightforward upgrade path from interactive simulation to licensed observations. That is stronger commercially than a generic immersive 3D world alone. However, the demonstration does not prove demand for genuine robot access, authority to sell it or positive unit economics. **Recommendation:** pursue a staged educational pilot and partner feasibility process, with explicit stop/go criteria, rather than raising the appearance of commercial readiness beyond the evidence.

---

## 10. Business Model Canvas

| Block | Current prototype / validated specification | Future commercial hypothesis |
|---|---|---|
| **Customer segments** | Space enthusiasts, classroom demonstration users | Schools, museums, researchers, outreach providers, approved corporate buyers |
| **Value proposition** | Interactive time-based Mars/Moon exploration with simulated observations and reports | Controlled, attributable access to licensed data, scheduled observations and possibly approved robotic capacity |
| **Channels** | LUNARA web application and pitch demonstrations | Direct web acquisition, educator partnerships, institution sales, operator co-marketing |
| **Customer relationships** | Self-service registration, prepaid sessions, history | Account support, institutional onboarding, partner SLAs |
| **Revenue streams** | **None confirmed in test mode**; conceptual $10/$7 per-minute price | Live prepaid minutes; possible institutional bundles after separate validation |
| **Key resources** | Source code, licensed 3D assets, cloud services, five-person team | Operator rights, mission integration, genuine datasets, scientific QA, business licenses |
| **Key activities** | Maintain app, sessions, scanning model and reports | Validate users, enforce access rules, schedule permitted tasks, protect provenance and data |
| **Key partners** | Platform vendors (technical dependencies, not commercial partnerships) | Mission operators, educational institutions, data licensors, research collaborators |
| **Cost structure** | Team development, hosting, database, asset license | Above plus customer acquisition, partner capacity, operations, legal, compliance and support |

**Core economic distinction:** *selling simulation engagement* and *selling scarce robotic observation capacity* have different buyers, permissions, liabilities and unit costs. The same software may support both, but the BRD does not treat their commercial feasibility as interchangeable.

## 11. Competitive Differentiation

| Alternative | What users already get | Why LUNARA would need to be different |
|---|---|---|
| Public planetary imagery and archives | Often free, genuine mission datasets; NASA PDS is a major public archive [S3] | Customer-directed experience, selection/analysis workflow and narrative reports, not artificial scarcity of free images |
| Educational simulations and virtual tourism | Immersive exploration, often at little or no cost | Structured scans, provenance, repeatable learning and eventually licensable genuine data |
| Remote-access scientific instruments | Scheduled measurement capability where an operator permits it | Space-specific capacity brokerage, trusted scheduling, compliance and reporting |
| Public mission livestreams or highlights | Real mission observations when made public | Approved, differentiated tasking/access—not claiming exclusivity to public data |

**Differentiation statement:** *LUNARA aims to package planetary exploration as a managed, time-bounded, auditable discovery session, producing a permanent record of observations.* In the present simulation, the main value is **experience and education**. Future **research-grade** value depends on real verified sources, calibration, independent quality standards and data rights. Until that transition, it is not credible to market synthetic resource scans as discoveries of actual extraterrestrial deposits.

## 12. Business Risks and Validation Plan

### 12.1 Prioritized risk register

| Risk | Severity | Evidence-based mitigation | Business owner / gate |
|---|---|---|---|
| No paying demand at current minute prices | High | 30 interviews, pricing comprehension and real purchase-intent experiments | Product owner; before live launch |
| Pay-to-walk game perception | High | Test educational outcomes, observation value and report reuse | Product/UX; before targeting schools |
| Mars cannot be piloted in real time | Critical | Future queued commands, delayed observations, clear UX disclosure; NASA mission-operation evidence [S4] | Mission partner; prerequisite for authentic Mars offer |
| No permission/availability from robot operators | Critical | Negotiated provider contracts and command safety rules | Partnerships/legal; no launch until signed |
| Thin or negative minute contribution | Critical | Provider quotes, sensitivity analysis and cost floors | Finance; no live pricing commitment |
| Synthetic data mistaken for real science | High | Persistent disclosure and provenance fields in report/export | Product/science reviewer |
| Purchased-time accounting or duplicate credits | High | Atomic server ledger, tested webhooks, independent audit | Engineering; release blocker |
| Personal data and report privacy | High | Permissions, limited retention, privacy notices, testing | Security/product |
| Space activities regulatory/data rights issues | Critical future | Expert legal review and operator-authorized activities; applicable treaty obligations [S5] | Legal and operator |
| Dependence on licensed 3D asset rights | Medium | Verify allowed embedding, redistribution and attribution | Product/integration |

### 12.2 Validation sequence with stop/go gates

**Gate A — customer desirability:** show a real need beyond novelty; obtain evidence from users and educators that a mission report is worth creating, and measure how they react to the $10/$7 prices. **Gate B — educational usefulness:** teachers can map the simulation to actual curriculum concepts while understanding the difference from authentic datasets. **Gate C — supply legality and feasibility:** at least one responsible partner confirms potentially saleable capacity, command safety rules, licensing, data use and operating model. **Gate D — commercial economics:** total price per service minute exceeds verified all-in cost at realistic utilization, after payment, support and partner charges. **Gate E — regulated production:** required permissions, privacy/commercial terms, scientific provenance and reliability conditions are met.

A failed gate should prompt an explicit **pivot** (e.g., simulation-based education rather than real teleoperation), not unsupported claims that robotic access exists.

## 13. Executive Business Verdict

**What LUNARA demonstrates today:** the team reports a working planetary-exploration SaaS prototype with user accounts, a Mars exploration experience, prepaid-time access rules and Stripe test checkout. LUNARA 2.0 specifies Moon access, differentiated $10/$7 pricing, synthetic resource scanning, telemetry and mission reports; implementation of those upgrades has **not** been independently verified for this document.

**What could become a business:** self-service educational exploration now, and—if infrastructure suppliers, permissions, validated customer demand and favorable economics emerge—a platform selling approved observation capacity and attributable scientific data products. The attractive aspect is a clear transaction unit with a persistent deliverable, not the implication that a rover can be driven instantly on Mars.

**What remains unproven:** real demand at current prices, researcher acceptance of the eventual offering, licensing rights to actual data and instruments, robot-provider capacity, time-delay-compatible operations and profitable cost/minute. Consequently, the commercially responsible route is **validate the user need, prove educational value, secure permissible supply, then price against verified operating costs**. LUNARA's relevance to exploration beyond Earth is a plausible future service layer, not a claim that extraterrestrial commercial teleoperation is available now.

---

## Glossary

| Term | Meaning in this BRD |
|---|---|
| BRD | Business Requirements Document: business rationale, outcomes, scope, stakeholders, costs and business-level behavior |
| Planetary Exploration as a Service | Proposed service providing destination-specific, managed exploration access without customer hardware ownership |
| Test checkout | Simulated payment integration in Stripe testing environment, **not a real sale** |
| Purchased-time balance | Prepaid access entitlement allocated to one planet |
| Mission / session | One bounded period of authorized exploration activity |
| Observation | In-demo synthetic record associated with a predefined simulated site; **not authentic field data** |
| Contribution margin | Revenue less attributed variable costs; excludes fixed expenses |
| Deferred revenue | Customer prepayment for a service not yet delivered, when required by the applicable accounting treatment |
| SLA | Service-level agreement defining availability and performance commitments |
| Remote tasking | Provider-approved scheduling and execution of observation instructions, potentially delayed or autonomous |

## Evidence register and sources

**Project-supplied context (not independent external verification):** current LUNARA build reported functional; latest LUNARA 2.0 product requirements and prices supplied by the project team. This BRD is created **as a new standalone document** and does not change existing repository documentation or website code.

- **[S1] LUMEN 2.0 Specification Book**, official project-provided PDF, Parts II–V, including working software expectations, judging weights, and 25 October 09:00 pitch format. Source provided in this conversation; no public URL assumed.
- **[S2] NASA — Moon to Mars Architecture**: https://www.nasa.gov/MoonToMarsArchitecture/ (accessed 25 October 2026). Establishes real agency exploration planning; does **not** imply LUNARA has a NASA agreement.
- **[S3] NASA Planetary Data System (PDS)**: https://data.nasa.gov/dataset/planetary-data-system-pds (accessed 25 October 2026). Public scientific data archive; highlights the competition from free authentic data.
- **[S4] NASA — Speaking Percy's Language: How to Talk so Perseverance Will Listen**: https://science.nasa.gov/blog/speaking-percys-language-how-to-talk-so-perseverance-will-listen/ (accessed 25 October 2026). Describes multi-minute Mars communication delay and non-real-time mission commands.
- **[S5] United Nations Office for Outer Space Affairs — Outer Space Treaty, Article VI**: https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/outerspacetreaty.html (accessed 25 October 2026). International framework; not a substitute for a jurisdiction-specific legal opinion.
- **[S6] Stripe API documentation — Test mode**: https://docs.stripe.com/api (accessed 25 October 2026). Test requests do not interact with live banking networks; real revenue must not be inferred from test transactions.

**No externally reported market size, robot capacity tariffs, current LUNARA revenue, signed partners or customer conversion statistics have been verified or asserted.** Financial numerical inputs beyond user-approved planet prices are explicitly illustrative.
