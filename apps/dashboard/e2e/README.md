# Dashboard E2E

```bash
# Terminal 1: gateway (optional for /api/chat test)
pnpm --filter @claws/gateway dev

# Terminal 2: dashboard
cd apps/dashboard && pnpm dev

# Terminal 3
pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL=http://127.0.0.1:4318` if dev already running (skip webServer).
