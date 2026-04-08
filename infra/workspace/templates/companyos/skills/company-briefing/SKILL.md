---
name: company-briefing
version: "1.0.0"
tier: template
category: company-os
description: "Full company status briefing — goal progress, agent activity, budget utilization, and decisions needed"
metadata:
  openclaw:
    triggers:
      - "company brief"
      - "company status"
      - "status report"
      - "how's the company doing"
      - "what's the company working on"
      - "brief me"
    outputs:
      - chat_response
      - memory_file
    try_me: 'Say: "Company brief"'
---

# Company Briefing

Your Chief of Staff's primary report. Delivers a complete picture of company status in one structured brief.

## Try It Now

Say: **"Company brief"**

## What It Does

Produces a structured company status report covering:
- Current goal and OKR progress
- Agent activity summary (what each agent is working on)
- Budget utilization (spend vs. allocation)
- Pending decisions or approvals waiting on the user
- Competitive intel highlights (if available)
- One recommended action for today

## How It Works

When the user asks for a company brief:

1. **Read USER.md** — extract company mission, active OKRs, team structure
2. **Read knowledge/goals.md** — get current objective status and project progress
3. **Read knowledge/org-chart.md** — understand active agents and their roles
4. **Read memory/YYYY-MM-DD.md** (today + yesterday) — recent agent activity and decisions
5. **Read MEMORY.md** — key context from long-term memory
6. **Read memory/budget.md** — current spend and burn rate
7. **Read memory/audit-log.md** — recent significant actions
8. **Synthesize** — produce a structured brief in this format:

```
## Company Brief — [Day, Month Date]

### Goal Progress
| Objective | Status | Owner | % Complete |
|-----------|--------|-------|------------|
| [Objective 1] | On Track / At Risk / Behind | [Owner] | [%] |

### Agent Activity
- **[Agent Name]:** [What they worked on / completed / are stuck on]
- **[Agent Name]:** [Status]

### Budget
- Monthly allocation: $[amount]
- Spent to date: $[amount] ([%] of budget)
- Burn rate: [on track / above target / below target]

### Pending Decisions
These need your input:
1. [Decision or approval waiting — context]
2. [If none: "Nothing pending — clean slate."]

### Market Intel
- [Any notable competitor or market update from learnings/competitive-intel.md]
- [Or skip if nothing new]

### Recommended Action
> [One specific, concrete action the CEO/user should prioritize today]
```

9. **Save to memory** — append brief summary to `memory/YYYY-MM-DD.md`

## Output

- Chat response with formatted company brief
- Brief summary appended to today's daily memory file

## Configuration

No configuration needed. Works immediately after completing Company OS onboarding.

To make it better:
- Keep `USER.md` OKRs updated with current quarter goals
- Keep `knowledge/goals.md` updated with project status
- Run it daily — the agent improves as more context accumulates
- Connect GitHub, Linear, or Notion integrations for richer agent activity data
