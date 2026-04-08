# QA: Chat & agent regression

Run before releases or after gateway/dashboard/tooling changes.

## Prerequisites

| Check | Command / action |
|-------|------------------|
| Gateway up | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4317/health` → `200` |
| AI enabled | At least one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY` in `.env.local` (gateway reads on start) |
| Playwright (browser tools) | `pnpm playwright:install` once per machine; `CLAWS_BROWSER_PROVIDER=playwright` in `.env.local` |
| Tavily (optional web search) | `TAVILY_API_KEY` for `research.webSearch` |

## 1. Automated SSE smoke

Run **one command per line**. In terminal A:

```bash
pnpm dev
```

After gateway is listening, in terminal B:

```bash
pnpm qa:chat-stream
```

(Pasting `pnpm dev # terminal A` and `pnpm qa…` on one paste block can pass junk args into `pnpm dev` and break Turbo.)

**Pass:** prints `qa-chat-stream: OK — SSE contains complete`.

**Skip (no AI):** HTTP 501 — script exits 0 with a hint unless `CLAWS_QA_STRICT=1`.

**Strict CI (fail if no AI):**

```bash
CLAWS_QA_STRICT=1 pnpm qa:chat-stream
```

## 2. Playwright + browser tools

1. Browsers install automatically after **`pnpm install`** / **`pnpm dev`** (see [BOOTSTRAP.md](../BOOTSTRAP.md)). Or one-time:

   ```bash
   pnpm playwright:install
   ```

2. `.env.local`:

   ```env
   CLAWS_BROWSER_PROVIDER=playwright
   ```

3. Restart gateway, then in Session chat:

   - *“Use browser.extract on https://example.com — return the h1 text.”*
   - Expect: tool run succeeds, answer mentions “Example Domain” or similar.

4. Screenshot:

   - *“browser.screenshot https://example.com”* (or ask naturally).
   - Expect: base64 screenshot or demo path in result.

If Playwright is missing, tools return a clear *“Run: pnpm add … playwright install”* style message — run `pnpm playwright:install` from repo root.

## 3. Approvals (high-risk gating)

High-risk tools **do not run** until approved or a **grant** covers the session/tool/agent.

| Tool | Risk | Notes |
|------|------|--------|
| `fs.write`, `fs.append` | high | Any file write |
| `sandbox.exec` | high | Arbitrary execution |
| `tasks.createTask`, `tasks.updateTask`, `tasks.moveTask`, `tasks.completeTask` | high | Task mutations |

Medium/low (e.g. `browser.extract`, `research.fetchUrl`, `fs.read`) run without that gate unless you change `TOOL_RISK_MAP` in `@claws/tools`.

**Manual check**

1. New session, no prior grants.
2. Ask: *“Write a one-line file at drafts/qa-touch.txt with content hello”*.
3. Expect: **Approval required** in stream/UI; Approvals page shows pending.
4. Approve (or grant session scope), retry or continue — write succeeds.

**Tightening policy (code)**

- Raise risk in `packages/tools/src/index.ts` (`TOOL_RISK_MAP`) for tools you want gated (e.g. `research.fetchUrl` → `high`).
- Redeploy gateway after changes.

## 4. Vibe coding (Lovable/v0 style)

- [ ] Empty state → **Vibe code a landing page** (or equivalent).
- [ ] Live canvas opens; **fs.write** (or stream tool card) appears.
- [ ] Right rail **Preview** shows HTML for `.html` artifact.
- [ ] No raw multi-KB paste in chat — short confirmation only.

## 5. Research (Manus/Perplexity style)

- [ ] **research.fetchUrl** — e.g. fetch a public docs URL; answer cites URL.
- [ ] **research.webSearch** — with `TAVILY_API_KEY`; answer + links.
- [ ] **memory.flush** — optional persistence after research.

## 6. Non-stream fallback

- [ ] Temporarily break stream (or use client path to `POST /api/chat` only) — still get a normal reply when AI is configured.

## 7. Dashboard sanity

- [ ] Session send/receive, no stuck “Thinking…” without completion.
- [ ] **Canvas** header control opens rail; dismiss works.
- [ ] Gateway offline banner when port down.

---

**Owner:** run `pnpm qa:chat-stream` in CI when secrets allow; otherwise run locally before tag.
