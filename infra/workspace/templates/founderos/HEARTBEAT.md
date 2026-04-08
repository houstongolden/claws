# HEARTBEAT.md — FounderOS Operational Heartbeat

Runs every 30 minutes. Rotate checks — don't run all of them every cycle. Revenue and relationships first, content second.

---

## Morning Brief (8am–10am local) — Run Once

```
1. Read USER.md → identify today's top pipeline deals and content due
2. Check knowledge/pipeline.md → any follow-ups due today?
3. Scan knowledge/content-calendar.md → anything to post this week?
4. Surface the Top 3 priorities for {{USERNAME}} today
```

**Send a brief message in this format:**

```
📋 Morning Brief — [DATE]

🔥 Pipeline: [X deals active | X follow-ups due today | hottest deal: NAME]
📝 Content: [what's due this week — or "nothing due"]
🎯 Top 3:
  1. [highest-leverage action]
  2. [second priority]
  3. [third priority]

⚡ Flag: [anything urgent or time-sensitive]
```

Stay quiet if nothing is actionable.

---

## Sales Pipeline (3x daily — 9am, 2pm, 6pm)

```bash
# Read pipeline state
cat knowledge/pipeline.md

# Check for deals with no activity in 5+ days
grep -A5 "last_contact:" knowledge/pipeline.md | grep -B3 "$(date -d '5 days ago' +%Y-%m-%d)" 2>/dev/null || true
```

- Flag any deal with no activity in 5+ days → draft a follow-up for {{USERNAME}} to approve
- Flag any deal marked "Proposal" or "Demo" with no next step
- Log deal updates to `memory/YYYY-MM-DD.md`
- **NEVER send outreach directly** — draft only

---

## LinkedIn Monitoring (2x daily — 10am, 4pm)

```
Use web-search skill:
  → Search: site:linkedin.com/in/{{USERNAME}} — check for new activity
  → Search: "[{{COMPANY}}]" site:linkedin.com — mentions, reposts
  → ICP check: search for new posts from target personas in knowledge/icp.md
```

- Draft replies to any new comments on {{USERNAME}}'s posts
- Flag notable connection requests (ICP match or warm intro)
- Note what content is getting traction → log to `learnings/content-queue.md`

---

## Competitor & Market Intel (Mon/Wed/Fri)

```
Use web-search skill:
  → "[Competitor 1] announcement OR launch OR funding" — last 7 days
  → "[Your market] news" — last 7 days
  → ICP target company news (see knowledge/icp.md for target segments)
```

Log findings to `learnings/competitive-intel.md`. Surface anything actionable.

---

## Content Calendar (Daily)

```bash
cat knowledge/content-calendar.md
cat learnings/content-queue.md 2>/dev/null || echo "empty"
```

- Check what's due this week
- If a post slot is due in <48h and not drafted → draft it
- Identify 1 shareable moment from last 24h (win, insight, milestone)
- Draft in {{USERNAME}}'s voice (see USER.md → Content Voice)

---

## When to Reach Out

- Hot lead has gone cold (5+ days, no contact)
- A deal has advanced to Proposal stage
- Content post is due today and not drafted
- Competitor made a notable move
- Something urgent in email/DMs from a known contact

## When to Stay Quiet (reply HEARTBEAT_OK)

- 23:00–08:00 local unless truly urgent
- Already messaged in the last 2 hours
- Pipeline is clean, content is scheduled, no alerts
- Content ideas can wait — batch them

---

## Safety Rules

- NEVER send emails, DMs, or LinkedIn messages without {{USERNAME}} approval
- DRAFT everything — {{USERNAME}} reviews and sends
- Never make pricing commitments or promises
- Never burn a warm relationship

---

Track state in `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "pipeline": null,
    "linkedin": null,
    "content": null,
    "competitors": null
  },
  "stalePipelineAlerted": [],
  "draftedContent": []
}
```
