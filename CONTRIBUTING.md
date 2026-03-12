# Contributing to Claws

Claws is an open-source, Vercel-powered, local-first agent OS. Contributions are welcome.

## Running the repo

```bash
pnpm install
pnpm typecheck   # type check all packages
pnpm test        # run harness (smoke + security); gateway should be running for full pass
pnpm dev         # start gateway (4317), dashboard (4318), worker
```

- **Dashboard:** [http://localhost:4318](http://localhost:4318)
- **Gateway:** [http://localhost:4317](http://localhost:4317)

See [README.md](README.md) for install paths, env vars, and CLI usage.

## Where planning lives

All product and feature planning lives under `project-context/`:

- **prd.md** — canonical product specification
- **feature-ledger.md** — canonical list of features with status (complete / partial / placeholder / missing) and evidence
- **tasks.md** — build queue (task IDs, status, dependencies)
- **next-pass.md** — current sprint and next high-value tasks
- **current-state.md** — snapshot of what exists and what’s missing
- **prompts/prompt-ledger.md** — development prompts and their outcomes
- **prompts/prompt-ledger-dump2.md** — raw prompt history and reference (not the task list)
- **human-tasks.md** — tasks that require human input (API keys, decisions)

Coding agents use **AGENT.md** and the feature ledger. Before implementing a feature, read the PRD and update the feature ledger and task list when done.

## Adding a feature

1. Implement the feature following the PRD and stack conventions in AGENT.md.
2. Update **feature-ledger.md**: set status (complete/partial/placeholder/missing) and add evidence (files, routes, UI, runtime).
3. Update **tasks.md** and/or **next-pass.md** as needed; append to **tasks.jsonl** for meaningful events.
4. If the work came from a prompt, add or update an entry in **prompts/prompt-ledger.md**.

Do not commit secrets; record required keys or decisions in **human-tasks.md**.

## Code of conduct

Be respectful and constructive. This project follows a local-first, Vercel-native, chat-first philosophy; keep changes aligned with the PRD and existing architecture.
