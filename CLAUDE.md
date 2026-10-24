# CLAUDE.md: SaaS Hackathon Project

## About me
- Beginner coder on Windows, using PyCharm. Project folder: C:\Workspace\Saas-hackathon
- Preparing for a SaaS hackathon where AI use is allowed. Team of 3.
- Explain things in simple words and ask before anything risky (installs, deleting files, git push).

## Next.js notes
@AGENTS.md

## Goal
Build a beautiful, working SaaS demo: one clear user, one painful problem, one core feature done really well. Polish matters more than the number of features.

## Tech stack
- Next.js + Tailwind CSS + shadcn/ui (front end, must look like a polished startup)
- Supabase (login + database, no custom backend)
- Stripe in TEST MODE (Free vs Pro plans, "Upgrade to Pro" checkout)
- Vercel (live link, deployed from GitHub)
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
