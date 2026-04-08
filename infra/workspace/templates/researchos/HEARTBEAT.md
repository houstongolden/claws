# HEARTBEAT.md — Research Proactive Schedule

Run these checks on each heartbeat (every 30 minutes). Rotate through categories — don't run everything every time.

## Experiment Monitoring (every beat)

- Check running experiments for completed steps
- Collect and log new results
- Advance DAG to next step if conditions met
- Flag experiments stalled >2 hours

## Literature Watch (daily, morning)

- Search for new papers in active research areas
- Check arXiv new submissions in relevant categories
- Flag papers that cite or extend your active experiments
- Update knowledge/literature-summaries.md with notable finds

## Finding Synthesis (when triggered)

Triggered when experiment produces results with confidence > 0.6:
- Compile findings with full citations
- Run dual-verification on any mathematical claims
- Cross-validate with multi-model consensus if significance is high
- Auto-publish to parent workspace and collective intelligence
- Log publication in today's memory file

## Methodology Review (weekly, Friday)

- Audit experiment quality across the week
- Review verification success/failure rates
- Identify methodology improvements
- Update MEMORY.md with lessons learned
- Flag any experiments that need re-running

## Data Integrity Check (2x weekly)

- Verify experiment DAG consistency
- Check for orphaned results or missing links
- Validate citation accuracy for recent findings
- Ensure all published findings have sources

## When to Alert {{USERNAME}}

- Major finding (confidence > 0.8)
- Experiment requiring expensive compute (estimate cost first)
- Conflicting results that need human judgment
- Rate limit approaching on key APIs
- Research direction pivot recommended

## When to Stay Quiet

- 23:00 - 08:00 (overnight)
- Already alerted within 2 hours
- Routine experiment progress (just log it)
- Literature with no direct relevance

## State Tracking

Update `/data/memory/heartbeat-state.json` with timestamps for each check category.
