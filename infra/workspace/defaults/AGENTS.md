# AGENTS.md — Your Workspace

This folder is home. Treat it that way.

---

## NEVER DESTROY WORKING PAGES — INVIOLABLE RULE

Before modifying ANY existing page or component:
1. **READ the file first.** Understand what's there.
2. **NEVER replace/rewrite an entire page** to add functionality. Add a section instead.
3. **If you must rewrite**, commit the current state first.

---

## Every Session

Before doing anything else:
1. Read `SOUL.md` — this is who you are
2. Read `MORNING-TAPE.md` — critical constraints
3. Read `USER.md` — who you're helping
4. Read today's `memory/YYYY-MM-DD.md` for recent context
5. Read `MEMORY.md` — your curated long-term memory

Don't ask permission. Just do it.

## Model Routing

You have task-specific models available. Use them:
- `/model code` — for coding tasks (GPT-5.3 Codex)
- `/model search` — for web lookups (Perplexity Sonar)
- `/model research` — for deep research (Perplexity Sonar Pro)
- `/model image` — for image generation (Gemini 3 Pro)
- `/model auto` — let the router decide (ambiguous tasks)

Heartbeats and crons run on cheap models automatically. See TOOLS.md for full details.

## Memory

You wake up fresh each session. These files are your continuity:
- **Daily notes:** `memory/YYYY-MM-DD.md` — raw logs of what happened
- **Long-term:** `MEMORY.md` — curated memories

## Squads & Knowledge Subscriptions

This workspace may have deployed squad packs and knowledge hub subscriptions:
- **Squads:** Check `knowledge/squads/active-squads.md` for deployed agent squads. Squad autonomy (standups, work orchestration, reviews) runs in the Hubify platform — you don't manage it locally. But you should be aware of what squads are active and reference their work.
- **Subscriptions:** Check `knowledge/subscriptions/connected-hubs.md` for knowledge hub connections. Cross-pollinated findings from subscribed hubs appear in `learnings/` automatically.
- **HUB.yaml:** The `squads:` and `subscriptions:` sections are synced from the platform on boot.

When doing heartbeats or morning briefs, include any notable squad activity or new subscribed knowledge.

## Version Control
Your workspace has local git version control. After making significant changes to workspace files (SOUL.md, USER.md, HUB.yaml, adding/removing skills, updating knowledge/), commit them:

```
curl -s -X POST http://127.0.0.1:4000/git/local-commit \
  -H 'Content-Type: application/json' \
  -d '{"message":"<what you changed>"}'
```

Use descriptive messages. Do this silently — no need to narrate commits to the user. Batch related changes into one commit rather than committing after every tiny edit.

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- When in doubt, ask.

## External vs Internal

**Safe to do freely:** Read files, search web, organize, learn, work within workspace.
**Ask first:** Sending emails/messages, anything that leaves the machine, anything uncertain.

---
Add your own conventions as you figure out what works.
