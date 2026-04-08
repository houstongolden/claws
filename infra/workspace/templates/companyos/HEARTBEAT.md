# HEARTBEAT.md — Company OS Operational Heartbeat

Runs every 30 minutes. Rotate checks — don't run all of them every cycle. Batch 2-4 per heartbeat to keep token usage reasonable.

---

## Company Morning Brief (8am–10am local) — Run Once

```
1. Read USER.md → check current quarter objectives and active agent assignments
2. Read knowledge/goals.md → any objectives off-track or at risk?
3. Check memory/heartbeat-state.json → what was last checked?
4. Surface pending approvals: anything waiting on {{USERNAME}} >4h?
```

**Send a brief in this format:**

```
🏢 Company Brief — [DATE]

🎯 OKRs: [X/N on track | X at risk | X blocked]
👥 Agents: [active: N | stalled: N | needs review: LIST]
💰 Budget: [X% of monthly budget used — OK / Watch / Alert]
📋 Pending approvals: [list or "none"]

⚡ Action needed: [specific ask for {{USERNAME}} or "nothing urgent"]
```

Stay quiet if everything is clean.

---

## OKR / Goal Check (1x daily)

```bash
cat knowledge/goals.md
```

- Surface any objective with no recent activity (>72h)
- Update progress percentages in `knowledge/goals.md` based on memory logs
- Flag any key result that is behind pace for the quarter
- Recommend: what should move next to advance the most critical objective?

**Alert threshold:** Any KR tracking >15% behind pace → alert {{USERNAME}}

---

## Agent Status (2–3x daily)

```bash
# Check what agents have been assigned and what they've completed
cat knowledge/org-chart.md
grep -r "assigned\|completed\|blocked" memory/$(date +%Y-%m-%d).md 2>/dev/null || echo "no log today yet"
```

**Delegation pattern:**
1. Read `knowledge/org-chart.md` → who owns what
2. Check today's memory log → did each agent report output in the last 24h?
3. Any agent with active task + no output in 24h → follow up
4. Log agent activity summary to `memory/YYYY-MM-DD.md`

---

## Budget Monitoring (Daily)

```bash
cat knowledge/budget.md
```

**Alert thresholds:**
- ≥ 70% of monthly budget used → send alert to {{USERNAME}}
- Any single agent cost > 2x their typical day → flag
- Any unexpected API cost spike → flag immediately

---

## Competitive & Market Intel (Mon/Wed/Fri)

```
Use web-search skill:
  → "[Competitor 1] product launch OR announcement OR funding" — last 7 days
  → "[Your market] news OR trends" — last 7 days
  → Hiring signals: "[Competitor] jobs site:linkedin.com"
```

Log findings to `learnings/competitive-intel.md`. Surface funding, pivots, new features, pricing changes.

---

## Governance Check (1x weekly — Friday)

```bash
cat memory/audit-log.md 2>/dev/null || echo "no audit log yet"
```

- Review all agent tasks completed this week — do they link to active objectives?
- Prune any orphaned tasks (no parent objective)
- Check: did any agent take an action outside their defined scope?
- Write weekly recap to `memory/weekly-recap.md`

---

## When to Reach Out

- OKR tracking >15% behind pace
- Agent stalled >24h on active task
- Budget ≥70% with significant time remaining
- Competitor made a notable move
- Pending approval waiting >8h

## When to Stay Quiet (reply HEARTBEAT_OK)

- 23:00–08:00 local unless urgent
- Already sent a message in the last 2 hours
- All objectives on track, agents active, budget clean

---

Track last check times in `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "goals": null,
    "agents": null,
    "budget": null,
    "intel": null,
    "governance": null
  },
  "budgetAlertSent": false,
  "stalledAgentsAlerted": []
}
```
