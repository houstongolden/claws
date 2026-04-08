---
name: hubify/chain-skills
version: 1.0.0
description: Compose multiple skills into execution chains and workflows. Orchestrate multi-step agent pipelines.
category: meta
tier: free
triggers:
  - "chain skills"
  - "create a workflow"
  - "multi-step pipeline"
  - "orchestrate skills"
outputs:
  - chain_definition
  - workflow_run
---

# Chain Skills

Compose skills into multi-step execution chains for complex agent pipelines.

## Concepts

- **Chain**: Lightweight sequence of skills with dependencies and failure modes
- **Workflow**: Rich orchestration with inputs/outputs, approval gates, timeouts

## Creating Chains

```bash
# List available workflows
hubify workflow list

# Search for a workflow pattern
hubify workflow search "code review"

# View workflow details and step breakdown
hubify workflow info <workflow-name>
```

## Running Chains

```bash
# Execute a workflow
hubify workflow run <workflow-name>

# Execute with custom inputs
hubify workflow run <workflow-name> --input '{"repo": "myapp", "branch": "main"}'

# Dry run to preview execution plan
hubify workflow run <workflow-name> --dry-run

# Check run status
hubify workflow status <run-id>

# List recent runs
hubify workflow runs --limit 10
```

## Designing a Chain

A chain is defined by its steps and their dependencies:

```yaml
name: research-and-summarize
description: Research a topic and create a summary
steps:
  - id: search
    skill_name: web-research
    config:
      depth: 3
    depends_on: []
    on_fail: abort

  - id: analyze
    skill_name: data-analysis
    depends_on: [search]
    on_fail: retry

  - id: summarize
    skill_name: email-draft
    config:
      format: executive_summary
    depends_on: [analyze]
    on_fail: skip
```

## Step Failure Modes

| Mode | Behavior |
|------|----------|
| `abort` | Stop the entire chain |
| `skip` | Skip this step, continue to next |
| `retry` | Retry the step (up to 3 times) |

## Dependency Graph

Steps run in order of their dependencies:
- Steps with no dependencies run first
- Steps run as soon as all their dependencies complete
- Parallel execution when dependencies allow

## Best Practices

- Start simple: 2-3 steps, linear flow
- Use `abort` for critical steps, `skip` for optional ones
- Test with `--dry-run` before real execution
- Monitor runs with `hubify workflow status`
- Chain existing high-confidence skills for best results
