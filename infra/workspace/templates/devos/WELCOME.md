# Welcome to Your Dev OS

Hey {{USERNAME}}

Your Dev OS is live at **{{SUBDOMAIN}}**. Here's what just happened:

## What's Set Up

- OpenClaw agent running 24/7 in the cloud
- Persistent memory at `/data/MEMORY.md`
- Skills installed: GitHub, Coding Agent, Things 3, Session Logs
- Heartbeat configured: monitors CI, PRs, and issues every 30 minutes
- Telegram channel: ready to connect

## First Things to Do

1. **Get to Know You** — Drop a few links (GitHub profile, blog, portfolio, LinkedIn) and I'll analyze your work and tech stack. Or just tell me what you're building and I'll configure myself around it.
2. **Connect GitHub** — Go to `{{SUBDOMAIN}}/integrations` and connect your GitHub account. This unlocks PR monitoring, CI alerts, and issue tracking.
3. **Connect Telegram** — Get alerts when CI breaks or a PR needs review.
4. **Update USER.md** — Add your repos, tech stack, coding preferences, and workflow rules. The more context, the better.

## How This Works

- I'm watching your repos every 30 minutes
- I'll alert you when CI fails, when PRs are stale, or when something needs attention
- I can help review code, catch bugs, and keep branch hygiene clean
- I can spawn a coding agent to build features autonomously — you review the PR
- You can chat with me anytime at `{{SUBDOMAIN}}`

## What I Can Do For You

- **CI monitoring** — alert you the moment a build breaks on main
- **PR review assist** — read through PRs, flag issues, suggest improvements
- **Branch hygiene** — identify stale branches and merged-but-undeleted refs
- **Dependency alerts** — surface Dependabot security advisories
- **Code generation** — use the coding-agent skill to build features, fix bugs, write tests
- **Bug tracking** — watch for new issues, flag p0s immediately

## The One Rule You Need to Know

**I never push to main. Ever.**

Everything goes through a PR. This is non-negotiable, and it's baked into how I work. If you ever ask me to push directly to main, I'll push back (no pun intended).

## Your Files

Everything is stored in `/data/`:
- `SOUL.md` — my development philosophy
- `USER.md` — your stack, repos, and coding preferences (edit this!)
- `MEMORY.md` — codebase learnings that survive across sessions
- `memory/` — daily dev logs
- `skills/` — GitHub, coding-agent, and other tools
- `learnings/` — architecture notes, gotchas, patterns I've discovered

## Try Your Skills Right Now

Your workspace comes with 5 universal skills that work immediately — no setup required:

1. **Morning Brief** — Say: "Give me my morning brief"
2. **Meeting Notes** — Paste any transcript and say: "meeting notes"
3. **Quick Capture** — Say: "Remember that the API deadline is March 15"
4. **Web Research** — Say: "Research the latest on [any topic]"
5. **Email Draft** — Say: "Draft an email to my team about the product launch"

## Ready to Ship

Connect your integrations, update USER.md with your repos, and let's go.

---

*This file is for your agent to read on first boot. Feel free to delete or update it after onboarding.*
