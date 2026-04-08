# Runbooks

<!-- Operational playbooks for deployments, incidents, and common tasks. -->
<!-- Keep these current — your agent uses them when things go wrong. -->

---

## Deploy: Production Release

**When:** Merging a feature branch to main triggers auto-deploy. For manual releases, follow this.

```bash
# 1. Verify CI is green on your branch
gh run list --branch [your-branch] --limit 5

# 2. Create a PR to main
gh pr create --title "feat: [feature name]" --body "[description]"

# 3. Get review, then merge via GitHub UI (squash merge preferred)

# 4. Monitor deploy
gh run list --branch main --limit 5
# Watch for: 'completed' + 'success'

# 5. Verify production
curl -s https://[your-domain]/api/health
```

**Rollback:** `gh run list` → find last green build → trigger re-deploy OR revert commit.

---

## Incident: Production Down

**Severity levels:**
- P0: Full outage — drop everything
- P1: Major feature broken — fix within 1 hour
- P2: Degraded performance — fix within 4 hours

```bash
# Step 1: Check recent deploys
gh run list --branch main --limit 10

# Step 2: Check error rates (Sentry / Datadog / your tool)
# [Add your observability URL here]

# Step 3: Identify last known good commit
git log --oneline main | head -20

# Step 4: Revert if needed
git revert [commit-hash]
gh pr create --title "revert: [description]" --body "Reverting due to incident"

# Step 5: Notify stakeholders
# [Add notification runbook here]
```

**Post-incident:** Write a brief post-mortem in `memory/YYYY-MM-DD.md` — what happened, why, how to prevent.

---

## Incident: CI Broken on Main

```bash
# 1. Find the failing workflow
gh run list --branch main --limit 10 --json conclusion,name,url,headCommit

# 2. Get failure details
gh run view [run-id] --log-failed

# 3. Identify the commit that broke it
git log --oneline main | head -10

# 4. Options:
#    a) Fix forward: create a PR with the fix
#    b) Revert: git revert [breaking-commit]
#    c) Skip CI (ONLY if genuinely not related): gh pr create with [skip ci] — requires approval
```

---

## Database Migration

```bash
# 1. Write migration — keep it reversible
# [Add your migration tool here: Prisma / Flyway / goose / etc.]

# 2. Test on staging first
# [Your staging environment command]

# 3. Back up production before running
# [Your backup procedure]

# 4. Run migration
# [Your migration command]

# 5. Verify — check key queries still work
# [Add verification steps]

# Rollback: run down migration
# [Your rollback command]
```

---

## Environment: Add a New Secret

```bash
# 1. Add to .env.example with a description (never the real value)

# 2. Add to your secrets manager
# Vercel: vercel env add [KEY]
# Fly.io: fly secrets set KEY=value
# GitHub Actions: gh secret set KEY

# 3. Document in USER.md → Infra section what the key is for

# 4. Verify in staging before production
```

---

## Common Fixes

### "npm install" fails in CI
```bash
# Clear cache and retry
# In GitHub Actions: add cache-busting step
# Locally: rm -rf node_modules && npm install
```

### TypeScript errors in CI but not locally
```bash
# Likely strict mode or version mismatch
tsc --noEmit  # run locally with strict settings
# Check tsconfig.json → "strict": true
```

### Database connection timeouts
```bash
# Check connection pool size vs. server limits
# Check for long-running queries
# Verify env vars are set correctly in the environment
```

---

*Add runbooks as you encounter new scenarios. These are your playbooks — keep them real and specific.*
