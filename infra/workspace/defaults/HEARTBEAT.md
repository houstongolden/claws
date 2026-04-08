# HEARTBEAT.md — Proactive Check System

Heartbeats run every 30 minutes on the **cheapest available model** (Haiku or Gemini Flash). This is intentional — at 48 checks/day, using Sonnet/Opus costs ~$0.24/day vs ~$0.005/day on a cheap model.

**Rule: All heartbeat logic runs on the cheapest model. If a check finds something requiring real action, surface it as a message — don't try to handle it inline.**

---

## Check Cadences

### Tasks & Projects — Every 30 minutes
Rotate through 2-3 of these per heartbeat:
- [ ] Read `memory/YYYY-MM-DD.md` — anything open from earlier?
- [ ] Check USER.md active projects — anything stuck or overdue?
- [ ] Surface any reminders or deadlines within the next 2 hours
- [ ] If something needs action, send a brief message

### Git & Files — Once daily (morning)
- [ ] `git status` on /data — uncommitted changes?
- [ ] Any files modified but not committed in 24h+?
- [ ] Disk usage check — flag if approaching limits

### System Health — Once daily (3am)
- [ ] Memory file count — prune if >200 daily files
- [ ] Session file sizes — flag if growing too large
- [ ] Verify all skills are loadable
- [ ] Check for workspace updates (SmartSync)

### Morning Brief — Once daily (8am-10am)
- [ ] Summarize yesterday's key events from memory
- [ ] List today's priorities from USER.md
- [ ] Flag any unread messages or pending items
- [ ] Send brief if anything notable; stay quiet if clean

---

## When to Surface vs Stay Quiet

**Surface (send a message):**
- Deadline within 2 hours
- Something broke or errored
- User hasn't checked in for 8+ hours and there's pending work
- Notable external event (email, PR, etc.)

**Stay quiet (reply HEARTBEAT_OK):**
- Late night (23:00-08:00) unless urgent
- Already sent a message in the last 2 hours
- Nothing new since last check
- Routine status with no action needed

---

## Model Routing for Heartbeats

This file runs via cron with `--session isolated` to guarantee the cheap model is used (workaround for issue #14279 where heartbeat.model overrides are sometimes ignored).

- **Routine checks:** Haiku 4.5 (~$0.0001/check)
- **System health:** Gemini 2.5 Flash (~$0.00005/check)
- **If escalation needed:** Surface it, let the user's session handle it on Sonnet/Opus

Never switch to an expensive model during a heartbeat. Surface and defer.

---

Track state in `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "tasks": null,
    "git": null,
    "system": null,
    "morning": null
  },
  "lastMessageSent": null
}
```
