# HEARTBEAT.md — MyOS Proactive Checklist

Runs every 30 minutes. Rotate through these checks — don't do all of them every time. Batch 2-4 per heartbeat to keep token usage reasonable.

## Morning Brief (8am–10am)
Run this block once per morning:
- [ ] **Weather** — Check today's weather, flag anything notable (rain, heat, events)
- [ ] **Calendar** — What's on today? Any prep needed for meetings?
- [ ] **Inbox** — Scan Gmail for urgent unread messages
- [ ] **Fitness** — Was yesterday's workout logged in Strava? If not, nudge {{USERNAME}}
- [ ] **Top 3** — Read USER.md and surface the 3 most important things for today

Send a morning brief message if anything is notable. Stay quiet if it's clean.

## Email & Calendar (2-3x daily)
- [ ] Urgent unread emails (from known contacts or with urgent keywords)
- [ ] Calendar events in next 2 hours — send a heads-up if needed
- [ ] Draft replies to any flagged threads (don't send — draft only)

## Fitness Accountability (7pm PT check)
- [ ] Check Strava for today's activity via the strava skill
- [ ] If no activity and it's past 7pm → send a nudge (Goggins mode if 3+ days inactive)
- [ ] Log yesterday's activity summary in `memory/YYYY-MM-DD.md`
- [ ] Weekly: Sunday evening recap — weekly distance/time vs goal

## Project Status (1x daily)
- [ ] Check `memory/YYYY-MM-DD.md` for open tasks and decisions from yesterday
- [ ] Read USER.md for active projects — anything stuck or stale?
- [ ] Surface any tasks in Apple Reminders that are overdue
- [ ] Update `memory/YYYY-MM-DD.md` with today's status

## Content Ideas (2-3x weekly)
- [ ] Scan recent Strava activities for shareable fitness milestones
- [ ] Note any interesting builds or learnings worth posting
- [ ] Draft 1-2 content angles for {{USERNAME}} to review
- [ ] Log to `learnings/content-ideas.md`

## Memory Maintenance (Every few days)
- [ ] Review recent `memory/` files
- [ ] Distill key learnings into `MEMORY.md`
- [ ] Clear stale tasks from reminders

## When to Reach Out
- Important email from a known contact
- Calendar event <2h away with no prep done
- 3+ days of Strava inactivity
- Something genuinely interesting or useful
- It's been >8h since last check-in

## When to Stay Quiet (reply HEARTBEAT_OK)
- Late night (23:00–08:00) unless urgent
- Already sent a message in the last 2 hours
- Nothing new since last check
- Just casual background noise

---

Track last check times in `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "email": null,
    "calendar": null,
    "strava": null,
    "projects": null,
    "content": null
  }
}
```

Edit this file to match your real rhythm. Keep it lean.
