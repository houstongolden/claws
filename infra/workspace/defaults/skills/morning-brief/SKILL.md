---
name: morning-brief
version: "1.0.0"
tier: universal
category: productivity
description: "Daily orientation brief — priorities, calendar, weather, and what matters today"
metadata:
  openclaw:
    triggers:
      - "morning brief"
      - "what's on today"
      - "start my day"
      - "daily brief"
      - "what should I focus on"
    outputs:
      - chat_response
      - memory_file
    try_me: 'Say: "Give me my morning brief"'
---

# Morning Brief

Start each day with a clear picture of what matters. This skill reads your context and delivers a structured daily orientation.

## Try It Now

Say: **"Give me my morning brief"**

## What It Does

Delivers a concise daily brief covering:
- Today's priorities (from USER.md)
- Yesterday's key activity (from memory/)
- Upcoming deadlines or follow-ups
- Weather and calendar (if weather/gog skills are installed)
- One actionable suggestion for the day

## How It Works

When the user asks for a morning brief:

1. **Read USER.md** — extract active projects, priorities, and deadlines
2. **Read today's memory** — check `memory/YYYY-MM-DD.md` for any existing notes
3. **Read yesterday's memory** — check `memory/YYYY-MM-DD.md` (yesterday) for context
4. **Read MEMORY.md** — check for pinned priorities or recurring items
5. **Check integrations** — if weather skill is installed, include weather. If gog (Google Calendar) is installed, include today's calendar events.
6. **Synthesize** — produce a structured brief in this format:

```
## Morning Brief — [Day, Month Date]

### Priorities
1. [Top priority from USER.md]
2. [Second priority]
3. [Third priority]

### Yesterday's Recap
- [Key items from yesterday's memory]

### Today's Calendar
- [Events if gog is connected, otherwise skip]

### Weather
- [If weather skill is connected, otherwise skip]

### Suggested Focus
> [One actionable recommendation based on priorities and context]
```

7. **Save to memory** — append brief summary to `memory/YYYY-MM-DD.md`

## Outputs

- Chat response with the formatted brief
- Appends summary to today's daily memory file

## Configuration

No configuration needed. Works immediately with your USER.md and memory files.

To enhance:
- Install the `weather` skill for weather in your brief
- Install the `gog` skill for Google Calendar integration
- Keep USER.md updated with your active projects and priorities
