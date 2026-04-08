# USER.md — {{USERNAME}} (Dev OS)

- **Name:** {{USERNAME}}
- **Workspace:** {{SUBDOMAIN}}
- **Hub ID:** {{HUB_ID}}
- **Timezone:** (set during onboarding — update this)

---

## Dev Profile

- **Primary language:** [TypeScript / Python / Go / Rust / other]
- **Main framework:** [Next.js / FastAPI / Express / other]
- **GitHub:** [https://github.com/yourusername]
- **Package manager:** [npm / pnpm / bun / pip / cargo]
- **Code editor:** [Cursor / VSCode / Neovim]

## Active Repositories

*(Add repos your agent should watch for PRs, issues, and CI)*

| Repo | Purpose | Branch strategy |
|------|---------|----------------|
| [org/repo-1] | [main product] | `main` protected, PRs required |
| [org/repo-2] | [api / backend] | [describe] |
| [org/repo-3] | [other] | [describe] |

## Coding Preferences

- **Style/linting:** [Prettier + ESLint / Black / gofmt / etc.]
- **Testing framework:** [Jest / Vitest / pytest / Go testing]
- **Commit message style:** [Conventional Commits / other]
- **Documentation style:** [JSDoc / docstrings / inline comments]
- **PR size preference:** [small atomic PRs / larger feature PRs]

## Tech Stack

*(The more specific, the better — your agent uses this to understand your codebase)*

- **Frontend:** [Next.js 14, React, Tailwind, shadcn/ui]
- **Backend:** [Node.js / FastAPI / Go]
- **Database:** [Postgres / Supabase / PlanetScale / MongoDB]
- **Auth:** [NextAuth / Clerk / Auth0]
- **Infra:** [Fly.io / Vercel / Railway / AWS]
- **Observability:** [Sentry / Datadog / Posthog]

## CI/CD Setup

- **CI provider:** [GitHub Actions / CircleCI / other]
- **Deploy pipeline:** [Vercel preview + main / custom]
- **Environments:** [dev / staging / production]
- **Deploy frequency:** [on merge to main / manual / scheduled]

## My Workflow

- **PR reviews:** I want them thorough but efficient. Call out bugs, not style nits.
- **Branch naming:** `feature/`, `fix/`, `chore/` prefixes
- **Issue tracking:** [GitHub Issues / Linear / Jira / Notion]
- **Sprints:** [1-week / 2-week / continuous / none]

## Focus & Interruption Rules

- **Deep work hours:** [e.g., 9am–1pm — don't interrupt]
- **Review windows:** [e.g., afternoons are okay for PR reviews]
- **Alert me immediately for:** failing CI on main, p0 bugs, security alerts
- **Batch and send:** everything else

## Rules (Non-Negotiable)

- **Never push to main.** PRs only. Always.
- **Never force push** without explicit approval.
- **Never merge** without tests passing.
- **Never delete branches** without my say-so.
- **Draft all external comms.** I approve before anything leaves.

## Integrations Connected

| Integration | Status | Notes |
|-------------|--------|-------|
| GitHub | pending | PRs, issues, CI |
| Telegram | pending | Alerts and updates |

*(Update during onboarding)*

---

*Update this as your stack evolves. Your Dev OS reads it every session to understand your codebase and workflow.*
