---
name: quick-capture
version: "1.0.0"
tier: universal
category: productivity
description: "Fast note-to-memory — capture tasks, facts, decisions, and deadlines with one message"
metadata:
  openclaw:
    triggers:
      - "remember this"
      - "note to self"
      - "save this"
      - "don't forget"
      - "remind me"
      - "capture this"
      - "jot down"
    outputs:
      - chat_response
      - memory_file
    try_me: 'Say: "Remember that the API deadline is March 15"'
---

# Quick Capture

Fast note-to-memory. Say it, and it's saved.

## Try It Now

Say: **"Remember that the API deadline is March 15"**

## What It Does

Captures notes instantly into your memory system:
- Auto-categorizes: task, fact, decision, deadline, contact, idea
- Appends to today's daily memory file
- Promotes important items to MEMORY.md
- One-line confirmation — no lengthy response

## How It Works

When the user says "remember this" or similar trigger:

1. **Parse the note** — extract the core information
2. **Categorize** — determine type:
   - **Task** — something to do ("remember to send the proposal")
   - **Fact** — information to retain ("the API key expires quarterly")
   - **Decision** — a choice made ("we decided to go with Stripe")
   - **Deadline** — time-bound item ("launch is March 15")
   - **Contact** — person info ("Sarah's email is sarah@example.com")
   - **Idea** — something to explore later ("we should try...")
3. **Format entry** with timestamp and category tag:

```
### [HH:MM] [Category]
[The captured note]
```

4. **Append to daily memory** — add to `memory/YYYY-MM-DD.md`
5. **Promote if important** — if it's a deadline, key decision, or contact, also add to MEMORY.md under the appropriate section
6. **Confirm briefly** — respond with a single line:

```
Saved [category]: [brief summary]
```

## Outputs

- Brief chat confirmation
- Entry in `memory/YYYY-MM-DD.md`
- Optional promotion to `MEMORY.md` for high-importance items

## Configuration

No configuration needed. Works immediately.

Tips:
- Be specific: "Remember that John prefers email over Slack" is better than "Remember John"
- Include dates when relevant: "Remember the board meeting is April 3rd"
- Say "what did I tell you to remember?" to review recent captures
