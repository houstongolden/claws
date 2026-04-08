---
name: meeting-notes
version: "1.0.0"
tier: universal
category: productivity
description: "Paste a meeting transcript and get structured notes with decisions, action items, and follow-ups"
metadata:
  openclaw:
    triggers:
      - "meeting notes"
      - "summarize this meeting"
      - "action items from"
      - "meeting summary"
      - "process this transcript"
    outputs:
      - chat_response
      - memory_file
    try_me: 'Paste any transcript and say "meeting notes"'
---

# Meeting Notes

Turn raw meeting transcripts into structured, actionable notes.

## Try It Now

Paste any meeting transcript (or even rough notes) and say: **"meeting notes"**

## What It Does

Takes a meeting transcript or rough notes and produces:
- One-line summary
- Key decisions made
- Action items table (who, what, by when)
- Open questions / unresolved items
- Key quotes worth remembering
- Saves to `memory/meetings/` for future reference

## How It Works

When the user provides a transcript and asks for meeting notes:

1. **Parse the transcript** — identify speakers, topics, and key moments
2. **Extract decisions** — any firm commitments or choices made
3. **Build action items table** — assign owner, describe task, note deadline if mentioned
4. **Flag open questions** — anything unresolved or needing follow-up
5. **Pull key quotes** — memorable or important statements
6. **Format output** as:

```
## Meeting Notes — [Date] — [Topic/Title]

### Summary
[One sentence describing what this meeting was about]

### Decisions
- [Decision 1]
- [Decision 2]

### Action Items
| Owner | Action | Deadline |
|-------|--------|----------|
| [Name] | [Task] | [Date or TBD] |

### Open Questions
- [Question needing follow-up]

### Key Quotes
> "[Notable quote]" — [Speaker]
```

7. **Save to memory** — write full notes to `memory/meetings/YYYY-MM-DD-[slug].md`
8. **Update daily memory** — append a one-line reference to `memory/YYYY-MM-DD.md`

## Outputs

- Chat response with formatted meeting notes
- Saved file in `memory/meetings/` directory
- Reference added to daily memory

## Configuration

No configuration needed. Just paste a transcript and ask for notes.

Tips:
- Works with raw transcripts from Zoom, Google Meet, Otter.ai, or even hand-typed notes
- Include speaker names in the transcript for better action item attribution
- Say "meeting notes for [project name]" to help with filing
