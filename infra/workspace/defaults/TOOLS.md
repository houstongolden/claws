# TOOLS.md — Available Tools & Model Routing

## Model Aliases

Switch models on-the-fly with `/model <alias>`:

| Alias | Model | Use For |
|-------|-------|---------|
| `sonnet` | Claude Sonnet 4.6 | General conversation, planning, analysis (default) |
| `opus` | Claude Opus 4.6 | Complex reasoning, difficult tasks, escalation |
| `code` | GPT-5.3 Codex | Code generation, refactoring, debugging |
| `search` | Perplexity Sonar | Quick web search, fact-checking |
| `research` | Perplexity Sonar Pro | Deep research, multi-source analysis |
| `image` | Gemini 3 Pro Image | Image generation and editing |
| `haiku` | Claude Haiku 4.5 | Fast/cheap tasks, background checks |
| `auto` | OpenRouter Auto | Ambiguous tasks — let the router decide |

## When to Switch Models

- **Writing code?** `/model code` — then switch back when done
- **Need to look something up?** `/model search` — faster and web-connected
- **Deep research task?** `/model research` — thorough multi-source
- **Generating images?** `/model image`
- **Simple/repetitive task?** `/model haiku` — saves budget
- **Not sure?** `/model auto` — OpenRouter picks the best fit

## Heartbeat & Cron Models

Background tasks (heartbeats, crons) automatically use cheap models:
- **Heartbeats:** Claude Haiku 4.5 (fallback: Gemini 2.5 Flash)
- **System checks:** Gemini 2.5 Flash

This keeps background costs near zero (~$0.005/day vs ~$0.24/day on premium models).

If a heartbeat discovers something that needs real work, it surfaces it as a message rather than trying to handle it inline on a cheap model.

## Installed Skills

Check `/data/skills/` for installed skills. Each skill has a `SKILL.md` explaining what it does and how to use it.

Install new skills: ask the agent or use the dashboard Skills page.
Browse available skills: [ClawHub](https://clawhub.com)

## File Structure

| Path | Purpose |
|------|---------|
| `SOUL.md` | Agent identity and philosophy |
| `AGENTS.md` | Workspace rules and conventions |
| `USER.md` | Your profile and preferences |
| `MORNING-TAPE.md` | Context anchor (read every session) |
| `HEARTBEAT.md` | Proactive check schedule |
| `MEMORY.md` | Curated long-term memory |
| `TOOLS.md` | This file |
| `memory/` | Daily notes (`YYYY-MM-DD.md`) |
| `skills/` | Installed agent skills |
| `learnings/` | Distilled insights |
| `knowledge/` | Reference documents |
