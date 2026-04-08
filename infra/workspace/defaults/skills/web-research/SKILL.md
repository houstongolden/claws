---
name: web-research
version: "1.0.0"
tier: universal
category: research
description: "Search the web and summarize findings — quick lookups or deep research saved to learnings"
metadata:
  openclaw:
    triggers:
      - "research"
      - "look up"
      - "search for"
      - "what is"
      - "who is"
      - "find out about"
      - "investigate"
    outputs:
      - chat_response
      - learnings_file
    try_me: 'Say: "Research the latest on [any topic]"'
---

# Web Research

Search the web and deliver summarized, actionable findings.

## Try It Now

Say: **"Research the latest on [any topic]"**

## What It Does

Two modes based on the request:
- **Quick lookup** — fast answer to a factual question (uses search model)
- **Deep dive** — thorough research with sources, saved to learnings/ (uses research model)

## How It Works

When the user asks to research something:

1. **Determine depth** — quick lookup vs deep dive:
   - Quick: "what is X", "who founded Y", factual questions
   - Deep: "research X", "investigate Y", "give me a report on Z"

2. **Search the web** — use available search tools to find relevant, recent information

3. **For quick lookups:**
   - Provide a concise answer with the source
   - Format: direct answer + source link

4. **For deep dives:**
   - Search multiple angles of the topic
   - Cross-reference sources for accuracy
   - Produce a structured research brief:

```
## Research: [Topic]

### Summary
[2-3 sentence overview]

### Key Findings
1. [Finding with source]
2. [Finding with source]
3. [Finding with source]

### Analysis
[What this means, trends, implications]

### Sources
- [Source 1 with link]
- [Source 2 with link]
- [Source 3 with link]

### Open Questions
- [What we still don't know]
```

5. **Save substantial research** — for deep dives, save to `learnings/research-[topic-slug].md`
6. **Reference in memory** — add a one-line note to today's daily memory

## Outputs

- Chat response with findings
- For deep dives: saved file in `learnings/` directory
- Reference in daily memory

## Configuration

No configuration needed. Uses the agent's built-in web search capabilities.

Tips:
- Be specific: "Research YC W26 batch companies in AI" is better than "research AI startups"
- Ask for comparisons: "Research Stripe vs Paddle for SaaS billing"
- Request recency: "Research the latest React 20 features" signals you want current info
