# Claws Brand — BRAND.md

**Status:** BINDING. Every piece of user-facing copy, marketing, README, tweet, or help text MUST match the voice below.
**Last updated:** 2026-04-08

> Agent instruction: when writing any user-facing copy in the Claws project — landing pages, READMEs, CLI help text, tweet drafts, commit messages, docs — read this file first and match the voice rules. Never hedge, never marketing-speak, never emoji spam. The Claws voice is a senior engineer who ships.

---

## What Claws is (the 3 sentences)

**1-sentence pitch:**
> Claws is the front-end framework for OpenClaw UIs, plus an experimental agent OS for Vercelians.

**3-sentence pitch:**
> Claws gives you `@claws/sdk`, a visual Studio, and an AIOS template marketplace for building custom dashboards and mission-control UIs on top of OpenClaw. No more rolling your own React+WebSocket layer every time you want a GUI for your agent stack. It also ships an experimental local-first agent OS in the same turborepo — use it as a playground, a reference implementation, or a second backend target.

**The one-liner for a headline:**
> The front-end framework for OpenClaw UIs.

**The subtitle:**
> Plus an experimental agent OS for Vercelians 👽🦞

---

## Who it's for

### Primary: OpenClaw users who want a GUI
- They're already running OpenClaw locally or in a VPS.
- They've outgrown `ttyd`/terminal and want a real dashboard.
- They don't want to spend a week building the React+WebSocket layer themselves.
- They care about customization, local-first data, and BYOK.

### Secondary: Vercel developers exploring agent systems
- They know Next.js, Tailwind, and the Vercel AI SDK.
- They're curious about agent runtimes but don't want to learn Rust or Python.
- They want a functioning local reference implementation to poke at.

### Not for
- Enterprise buyers looking for a "platform."
- People who just want a chat interface (they should use Claude.ai or ChatGPT).
- Teams that need SOC2, SSO, and RBAC on day one.
- Anyone expecting hand-holding or a polished onboarding wizard.

---

## Voice

**The Claws voice is a senior engineer who ships.** Specifically: direct, terse, technically literate, dry. Names file paths and function names. Admits tradeoffs. Doesn't hype. Doesn't apologize. Knows what a `.jsonl` file is and expects you do too.

### Voice checklist

- [ ] Lead with what it does, not how excited we are about it
- [ ] Use concrete nouns: `@claws/sdk`, `GatewayProvider`, `localhost:4317` — not "our powerful integration layer"
- [ ] Admit the current state honestly — "salvage state," "experimental," "not yet wired"
- [ ] Prefer "you" over "users" — you're talking to one engineer at a time
- [ ] One claim per sentence
- [ ] No corporate register: "leverage," "synergy," "solution," "empower," "unlock"
- [ ] No AI-ese: "delve," "crucial," "robust," "comprehensive," "nuanced," "multifaceted"
- [ ] No banned phrases: "here's the kicker," "plot twist," "bottom line," "make no mistake"
- [ ] No em dashes. Use commas, periods, or "..." instead.
- [ ] Dry humor is OK. Marketing enthusiasm is not.

### Voice examples

**Bad (marketing speak):**
> Claws empowers developers to build beautiful, performant, enterprise-grade AI dashboards with our comprehensive suite of production-ready React hooks.

**Good (Claws voice):**
> `@claws/sdk` is 17 React hooks and a WebSocket client for OpenClaw Gateway v3. 21 KB gzipped. Typed end-to-end. Ship a dashboard this weekend.

**Bad:**
> Our intuitive visual Studio seamlessly integrates with OpenClaw to deliver a delightful template-building experience.

**Good:**
> Studio is a visual template builder that runs at `localhost:4319` and talks to OpenClaw over the gateway protocol. Design a dashboard, configure SOUL.md, deploy to Fly.io. One click.

**Bad:**
> We're excited to announce the launch of Claws, a revolutionary new platform...

**Good:**
> Claws is a front-end framework for OpenClaw UIs. It works today. `npm install @claws/sdk`.

**Bad:**
> Harness the power of multi-agent orchestration with Claws, the cutting-edge agent OS that...

**Good:**
> Claws is an experimental agent OS. It runs locally. It's in salvage state from a broader pivot. Here's what works: chat, tool calling, streaming, traces, approvals. Here's what doesn't: async loops, full replay, template editor. Roadmap in `project-context/`.

---

## Positioning against competitors

**Never disparage. Always describe.**

| vs | How to describe the difference |
|----|-------------------------------|
| **Claude Code** | "Claude Code is CLI-only. Claws ships a GUI that talks to OpenClaw (or its own experimental backend)." |
| **Cursor** | "Cursor is an editor. Claws is a dashboard framework for agent runtimes." |
| **Lovable / v0** | "Lovable is hosted vibe coding. Claws is a self-hostable framework for building dashboards on top of your own agent stack." |
| **OpenClaw** | "Claws is complementary to OpenClaw — it's the front-end framework OpenClaw doesn't ship." |
| **Plain Next.js + WebSockets** | "That's what we used to do. `@claws/sdk` packages it up with typed protocol schemas, reconnect logic, and 17 React hooks." |

---

## The 🦞 mascot

- **The lobster is the mark.** It goes next to the word "Claws" in the logo lockup and in the CLI banner.
- **Keep it playful but not childish.** Claws > emoji spam.
- **Acceptable uses:** logo lockups, CLI banner, loading state placeholders, social card avatars, favicons.
- **Unacceptable uses:** inline in body text (except when quoting a CLI banner), as a decorative element in feature cards, as a bullet-point marker, in H1 headings of docs (it belongs next to the word "Claws", not replacing it).

**Inline convention:** `🦞 Claws` — emoji first, wordmark second, no separator.

**Tagline convention:** When you write the tagline "plus an experimental agent OS for Vercelians," `👽🦞` goes at the end — alien first, lobster second, no space. That's the visual identifier of Pillar 2 specifically.

---

## Naming conventions

### The product
- **Product name:** Claws (capital C, lowercase rest)
- **Formal name:** Claws
- **Never:** CLAWS, claws.so in body text, "the Claws project," "Claws.so platform"
- **URL:** `claws.so` (lowercase)
- **GitHub:** `github.com/houstongolden/claws`

### Pillar 1 components
- `@claws/sdk` (package name)
- Claws SDK (prose name)
- Claws Studio (prose name, capital S)
- AIOS Templates (product category name; all caps AIOS is intentional)
- Template Marketplace (the destination, not "template gallery")

### Pillar 2 components
- Claws (experimental) agent OS — full name in copy
- Claws gateway (lowercase g, when referring to the runtime)
- Claws dashboard (lowercase d)
- `claws` CLI (lowercase, fixed width)

### File / code names
- Always use `@claws/*` for scoped packages
- Always lowercase hyphenated repo slugs (`claws-landing`, not `ClawsLanding`)
- CLI commands are lowercase, hyphenated

---

## Taglines and headlines (approved)

These are production-tested taglines. Use them when in doubt.

**Main hero (current):**
> The front-end framework for OpenClaw UIs.
> Plus an experimental agent OS for Vercelians 👽🦞

**Hero alternates:**
> React hooks for OpenClaw. Finally.
> Ship the OpenClaw dashboard you've been meaning to build.
> 17 hooks. One WebSocket. Your dashboard, tomorrow.

**SDK-specific:**
> `@claws/sdk` — 17 React hooks for OpenClaw Gateway v3.

**Studio-specific:**
> Studio — a visual template builder for AIOS workspaces.

**Experimental OS-specific:**
> An experimental agent OS for Vercelians. Local-first, BYOK, no cloud.

---

## CTAs (approved)

- `Install @claws/sdk` (primary on landing)
- `View on GitHub`
- `Open Studio`
- `Read the docs`
- `Try the experimental OS`

**Never:**
- "Get started for free" (nothing here isn't free)
- "Book a demo" (not that kind of product)
- "Sign up" (no signup)
- "Start your free trial"
- "Learn more" (too vague)

---

## Status language

**When describing state, be honest:**

- `production-ready` — only when used in production by a non-founder user
- `working` — verified end-to-end, has tests, survived a smoke run
- `salvage state` — copied from hubify, builds, not yet wired
- `experimental` — functionally works but architecture may change
- `deferred` — intentionally not built yet, waiting on something
- `broken` — known to not work, should say so plainly

**Never:**
- "coming soon" without a concrete next step
- "in beta" (meaningless, pick a more specific word)
- "launching now" (you either shipped or you didn't)

---

## Commit message voice

- Imperative mood: "add", not "added" or "adds"
- Reference the phase if applicable: `feat: Phase E2 — live studio panel`
- Body explains WHY, not just WHAT
- Attribution line is required: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- No marketing in commit messages

---

## README + docs voice

- Lead with the install command in a code block
- Second paragraph: what it does in one sentence
- Third paragraph: the two pillars
- Then sections: quickstart, reference, roadmap, contributing
- Code examples are required for anything the user might install
- Admit unfinished state explicitly in a "Status" section at the top

---

## Social / external voice

When tweeting, posting to HN, or sharing externally:

- Lead with the demo, not the pitch
- Link to a specific file path or commit when relevant
- Include the actual current state, not aspirational
- Never use announcement emojis (🎉 🚀 ✨)
- 🦞 is acceptable as a sign-off or avatar

**Approved tweet template:**
> `@claws/sdk v0.1 ships today. 17 React hooks for OpenClaw Gateway v3. Ship a dashboard this weekend. `
>
> `npm install @claws/sdk`
>
> `https://github.com/houstongolden/claws`

---

## Voice enforcement

This doc is binding. If you find copy in the project that violates these rules, fix it. If you find yourself about to write "empower," "leverage," "nuanced," "comprehensive," or an em dash, stop and rewrite. If something feels marketing-y, it probably is.

Agents reading this: you're the last line of defense against generic AI startup voice. Keep Claws sounding like an engineer wrote it.
