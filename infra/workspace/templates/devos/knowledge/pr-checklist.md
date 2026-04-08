# PR Review Checklist

<!-- Your agent applies this checklist when reviewing any PR. -->
<!-- Customize for your stack — remove items that don't apply. -->

---

## Pre-Review (Every PR)

- [ ] PR has a clear description explaining what and why (not just what)
- [ ] PR is linked to an issue or ticket
- [ ] PR is reasonably sized (<400 lines, ideally <200)
- [ ] Branch name follows convention (`feat/`, `fix/`, `chore/`)

---

## Correctness

- [ ] Logic is correct for the stated problem
- [ ] Edge cases are handled (null, empty, concurrent, large input)
- [ ] No obvious off-by-one errors or boundary conditions missed
- [ ] Error paths are handled — not just happy path
- [ ] No silent failures (errors caught but not logged or surfaced)

---

## Tests

- [ ] New functionality has tests
- [ ] Tests actually test behavior, not just implementation
- [ ] Tests would catch a regression if this code broke
- [ ] No tests removed without clear justification
- [ ] Test coverage hasn't significantly dropped

---

## Security

- [ ] No secrets, tokens, or credentials in code or comments
- [ ] User input is validated before use (no raw SQL, XSS vectors, etc.)
- [ ] Auth/authorization checks are present on new endpoints
- [ ] No new attack surface introduced without review
- [ ] Dependencies added are from reputable sources, pinned versions

---

## Performance

- [ ] No N+1 database queries introduced
- [ ] No unnecessary re-renders (React) or redundant computations
- [ ] Large data operations are paginated or streamed
- [ ] No blocking operations in hot paths
- [ ] Caching strategy considered for expensive operations

---

## Code Quality

- [ ] No duplicated logic that should be extracted
- [ ] Names (variables, functions, files) are clear and consistent
- [ ] No TODO/FIXME left without a linked issue
- [ ] Dead code removed
- [ ] Complex logic has explanatory comments

---

## Documentation

- [ ] Public APIs have JSDoc/docstrings
- [ ] README updated if behavior or setup changed
- [ ] Migration steps documented if required (schema changes, env vars)
- [ ] Breaking changes called out explicitly in PR description

---

## Breaking Changes

- [ ] Backward compatibility maintained OR breaking change is intentional + documented
- [ ] Database migrations are reversible (or clearly irreversible with justification)
- [ ] API contract changes are versioned or backward-compatible
- [ ] Dependent services/consumers notified if interface changed

---

## Stack-Specific Checks

<!-- Customize for your stack -->

### TypeScript / Next.js
- [ ] No `any` types added without justification
- [ ] Server/client component boundary is intentional
- [ ] `use client` only where genuinely needed
- [ ] API routes validate input schema (Zod/similar)

### Database
- [ ] Indexes added for new query patterns
- [ ] Migrations are idempotent
- [ ] No raw queries without parameterization

---

## Review Output Format

When your agent reviews a PR, use this format:

```
### PR Review: #[number] — [title]

**Summary:** [one sentence on what this PR does]

**Verdict:** ✅ LGTM | ⚠️ Minor concerns | ❌ Needs changes

**Issues:**
- 🔴 [BLOCKING]: [description + file:line]
- 🟡 [SUGGESTION]: [description]
- 🟢 [NITPICK]: [description — can ignore]

**Tests:** [passing / missing / insufficient]
**Security:** [clean / flagged: description]
```
