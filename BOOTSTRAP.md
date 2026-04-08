# Bootstrap (automatic on startup)

Claws runs a small **bootstrap** step so a fresh clone gets dependencies and **Playwright Chromium** without extra manual steps.

## What runs automatically

| When | What |
|------|------|
| **`pnpm install`** (any time) | `postinstall` → bootstrap **`--postinstall`** → installs **Playwright Chromium** (if not skipped). |
| **`pnpm dev`** | Full bootstrap → **`pnpm install`** → **Playwright Chromium** (if needed), then Turbo starts gateway + dashboard + worker. |

Playwright is required for reliable **`browser.extract`**, **screenshots**, and **`CLAWS_BROWSER_PROVIDER=playwright`**.

## One-time / manual

Run **one command per line** (don’t paste multi-line “terminal A / B” notes into the shell — extra words become args and break Turbo).

```bash
pnpm install
pnpm dev
```

Playwright browsers (if you skipped postinstall):

```bash
pnpm playwright:install
```

## Skip flags (CI, Docker, offline)

| Env | Effect |
|-----|--------|
| `CLAWS_SKIP_BOOTSTRAP=1` | Entire bootstrap no-op |
| `CLAWS_SKIP_INSTALL=1` | Skip `pnpm install` (dev only) |
| `CLAWS_SKIP_PLAYWRIGHT=1` | Skip Playwright browser download |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` | Standard Playwright skip |

Example CI:

```yaml
env:
  CLAWS_SKIP_PLAYWRIGHT: "1"
  # or install browsers in a prior step: pnpm exec playwright install chromium
```

## Stamp file

After a successful Playwright install, bootstrap writes **`.claws/bootstrap-playwright.txt`** with a fingerprint of `pnpm-lock.yaml`. If the lockfile hasn’t changed, the next run **skips** `playwright install` (fast restarts).

Delete `.claws/bootstrap-playwright.txt` to force a reinstall.

## Source

- Script: **`scripts/bootstrap.mjs`**
- Wired in root **`package.json`**: `postinstall`, and `dev` runs bootstrap before Turbo.

## Still required manually

- **`.env.local`** — lives next to `package.json` (repo root). Gateway loads **`.env.local` then `.env`** on startup. Same variables as `.env.example`: e.g. `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, `AI_MODEL`. **Restart `pnpm dev`** after edits.
- **Approvals** — high-risk tools need approval unless granted (see `docs/QA-CHAT.md`).
