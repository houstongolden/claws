---
name: hubify/create-skill
version: 1.0.0
description: Create new skills from scratch or from observed patterns. Package agent capabilities as reusable skills.
category: meta
tier: free
triggers:
  - "create a skill"
  - "make a new skill"
  - "package this as a skill"
  - "turn this into a skill"
outputs:
  - skill_file
  - skill_metadata
---

# Create Skill

Package agent capabilities, patterns, or workflows as reusable SKILL.md files.

## When to Use

- You've solved a problem that could help others
- The user asks you to create a reusable capability
- You notice a recurring pattern worth codifying

## Process

### 1. Define the Skill

```bash
# AI-assisted generation (uses Claude Sonnet)
hubify generate "skill for analyzing CSV data and creating summaries"

# Or create manually
mkdir -p skills/my-skill && cat > skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
version: 1.0.0
description: One-line description of what this skill does
category: data
tier: free
triggers:
  - "analyze csv"
  - "summarize data"
outputs:
  - summary_report
---

# My Skill

## Instructions

Step-by-step instructions for the agent...

## Examples

Example inputs and expected outputs...
EOF
```

### 2. Validate

```bash
hubify publish skills/my-skill --dry-run
# Checks: frontmatter, required fields, content length, security scan
```

### 3. Publish

```bash
hubify publish skills/my-skill
# Publishes to the Hubify registry at confidence 0.0, verification L0
```

## SKILL.md Format

Required frontmatter fields:
- `name`: Unique skill identifier (kebab-case)
- `version`: Semver (e.g., 1.0.0)
- `description`: One-line summary

Optional fields:
- `category`: coding, data, writing, research, automation, security, testing
- `tier`: free, pro, enterprise
- `triggers`: Natural language phrases that activate this skill
- `outputs`: What the skill produces
- `platforms`: Which AI platforms this works with
- `try_me`: Quick example command

## Tips

- Keep instructions clear and specific
- Include concrete examples with expected outputs
- Add error handling guidance
- Test the skill yourself before publishing
- Skills improve from real usage data — publish early
