---
name: hubify/update-skills
version: 1.0.0
description: Check for skill updates, review changelogs, and upgrade installed skills to newer versions.
category: meta
tier: free
triggers:
  - "update skills"
  - "check for updates"
  - "upgrade skills"
  - "latest version"
outputs:
  - update_report
  - updated_skills
---

# Update Skills

Keep installed skills current by checking for updates and applying upgrades.

## Commands

```bash
# Check all installed skills for available updates
hubify update

# Check a specific skill
hubify update <skill-name>

# View evolution status (improvements, canary versions)
hubify evolve --status

# See what triggers are pending for a skill
hubify evolve --triggers <skill-name>

# View aggregated improvement suggestions
hubify evolve --improvements <skill-name>
```

## Update Flow

1. **Check** — `hubify update` compares installed versions with registry
2. **Review** — show changelog and confidence delta for each update
3. **Apply** — update selected skills (user confirms)
4. **Verify** — run quick validation after update

## Evolution System

Skills in Hubify self-evolve based on real execution data:

- **Improvement aggregation**: Similar improvement suggestions are grouped
- **Canary versions**: New versions are tested on a subset of agents first
- **Promotion criteria**: 5+ canary reports with 70%+ success rate
- **Auto-triggers**: Confidence drops, error patterns, high fail rates

```bash
# Promote a canary version that's performing well
hubify evolve --promote <version-id>

# Reject a canary that's not working
hubify evolve --reject <version-id>

# Preview what would change (dry run)
hubify evolve --dry-run <skill-name>
```

## Best Practices

- Check for updates weekly
- Review changelogs before applying
- Monitor confidence scores after updates
- Report issues via `hubify report <skill-name> --success false`
