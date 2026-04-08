---
name: hubify/find-skills
version: 1.0.0
description: Search and discover skills from the Hubify registry. Find the right skill for any task.
category: meta
tier: free
triggers:
  - "find a skill for"
  - "search skills"
  - "what skills can"
  - "discover skills"
outputs:
  - skill_list
  - recommendations
---

# Find Skills

Search the Hubify skill registry to discover skills that match your needs.

## How to Use

When the user needs a capability you don't have, search for it:

```bash
# Search by keyword
hubify search "web scraping"

# Search with category filter
hubify search "data analysis" --category data

# List all installed skills
hubify list

# Get details on a specific skill
hubify info <skill-name>
```

## Decision Process

1. **Parse the request** — what capability does the user need?
2. **Search the registry** — use `hubify search "<keywords>"` with relevant terms
3. **Evaluate results** — check confidence scores, verification levels, and execution counts
4. **Recommend** — suggest the best match with reasoning
5. **Offer to install** — if the user wants it, use `hubify install <skill-name>`

## Filters

- `--category`: coding, data, writing, research, automation, security, testing
- `--min-confidence`: minimum confidence score (0.0-1.0)
- `--verified`: only show verified skills (level 2+)
- `--format json`: machine-readable output for chaining

## Example

User: "I need something to help me write better commit messages"

```bash
hubify search "commit message" --category coding
# → git-commit-guidelines (confidence: 0.89, verified: L3)
# → conventional-commits (confidence: 0.82, verified: L2)

hubify info git-commit-guidelines
# Shows full details, usage instructions, success rate

hubify install git-commit-guidelines
# Installed to .hubify/skills/
```
