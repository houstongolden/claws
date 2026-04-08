# HEARTBEAT.md — DevOS Proactive Checklist

Runs every 30 minutes. Rotate through these — don't run all checks every time. Batch what makes sense, skip what you already checked recently.

## Priority Alerts (Every heartbeat — fast checks)
- [ ] **Failing CI** — Any GitHub Actions runs failing on main or active PRs? Alert immediately.
- [ ] **Urgent mentions** — Any @mentions in PRs/issues that need a response?
- [ ] Do NOT send unless something is actually broken or time-sensitive.

## PR & Issue Review (2-3x daily)
- [ ] **Open PRs** — List PRs waiting for review. Flag any >24h old.
- [ ] **Stale PRs** — Any draft PRs that haven't been touched in 48h? Nudge {{USERNAME}}.
- [ ] **New issues** — Check for newly filed bugs or feature requests
- [ ] **Assigned issues** — Any issues assigned to {{USERNAME}} that are stuck?
- [ ] Draft a PR status summary if there's more than 3 open PRs

## CI & Deployment Health (3x daily)
- [ ] Check GitHub Actions — any failed workflows on watched repos?
- [ ] Check for flaky tests (runs that fail intermittently)
- [ ] Note deployment status: did the last deploy succeed?
- [ ] If CI is red → alert immediately with the failing job name and link
- [ ] Log to `memory/YYYY-MM-DD.md`: CI health summary

## Dependency & Security Updates (Daily)
- [ ] Check for Dependabot alerts on watched repos
- [ ] Note any critical security advisories (CVE level)
- [ ] Flag dependency updates that have been pending >7 days
- [ ] Do NOT auto-merge — surface to {{USERNAME}} for approval

## Branch Hygiene (2x weekly — Mon/Thu)
- [ ] List branches merged to main but not deleted
- [ ] Identify stale branches (no commits in 14+ days, not merged)
- [ ] List draft PRs that haven't moved in 5+ days
- [ ] Surface a cleanup list — {{USERNAME}} approves before any deletion

## Bug Tracking (Daily)
- [ ] New bugs filed since last check
- [ ] Bugs labelled `p0` or `critical` — always surface these
- [ ] Any regressions in recent releases?
- [ ] Log bug summary in `memory/YYYY-MM-DD.md`

## Weekly Dev Summary (Friday 5pm)
- [ ] PRs merged this week
- [ ] Issues closed this week
- [ ] Remaining open issues/PRs
- [ ] CI health trend (stable/improving/degrading)
- [ ] Post summary to {{USERNAME}}

## When to Alert
- CI failing on main
- `p0` or `critical` bug filed
- PR waiting review for >24h (once only)
- Dependency with CVE severity ≥ HIGH
- Deploy failed

## When to Stay Quiet (reply HEARTBEAT_OK)
- Everything is green
- Already sent an update in the last hour
- No new activity on watched repos
- Late night (23:00–08:00) unless CI is on fire

---

Track state in `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "ci": null,
    "prs": null,
    "issues": null,
    "deps": null,
    "branches": null
  },
  "alertedPRs": [],
  "alertedCI": []
}
```

Populate `USER.md` with watched repos so these checks know where to look.
