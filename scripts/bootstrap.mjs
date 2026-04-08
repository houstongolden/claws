#!/usr/bin/env node
/**
 * Claws monorepo bootstrap — run before `pnpm dev` and after `pnpm install` (postinstall).
 *
 * - Ensures workspace dependencies are installed (`pnpm install`).
 * - Installs Playwright Chromium for gateway browser tools (browser.extract, screenshots).
 *
 * Skip flags (CI / Docker / offline):
 *   CLAWS_SKIP_BOOTSTRAP=1     — no-op
 *   CLAWS_SKIP_INSTALL=1       — skip pnpm install
 *   CLAWS_SKIP_PLAYWRIGHT=1    — skip playwright install
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 — same as skip playwright (standard Playwright env)
 *
 * Modes:
 *   node scripts/bootstrap.mjs           — full (install + playwright); used by `pnpm dev`
 *   node scripts/bootstrap.mjs --postinstall — playwright only (pnpm install already ran)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STAMP_DIR = path.join(ROOT, ".claws");
const STAMP_FILE = path.join(STAMP_DIR, "bootstrap-playwright.txt");

function log(...args) {
  console.log("[bootstrap]", ...args);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.silent ? "pipe" : "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...opts.env },
  });
  return r.status === 0;
}

const postinstallOnly = process.argv.includes("--postinstall");

if (process.env.CLAWS_SKIP_BOOTSTRAP === "1") {
  log("CLAWS_SKIP_BOOTSTRAP=1 — skipping");
  process.exit(0);
}

const skipInstall = process.env.CLAWS_SKIP_INSTALL === "1";
const skipPlaywright =
  process.env.CLAWS_SKIP_PLAYWRIGHT === "1" ||
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1";

if (!postinstallOnly && !skipInstall) {
  log("pnpm install …");
  const ok = run("pnpm", ["install", "--no-frozen-lockfile"], { silent: false });
  if (!ok) {
    log("pnpm install failed");
    process.exit(1);
  }
}

if (skipPlaywright) {
  log("Playwright browser install skipped (CLAWS_SKIP_PLAYWRIGHT or PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD)");
  process.exit(0);
}

// Idempotent: only run playwright install if lockfile changed or no stamp
let lockHash = "";
try {
  lockHash = readFileSync(path.join(ROOT, "pnpm-lock.yaml"), "utf8").slice(0, 12000);
} catch {
  lockHash = String(Date.now());
}
const shortHash = String(lockHash.length) + ":" + simpleHash(lockHash);

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 50000); i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

let needPlaywright = true;
if (existsSync(STAMP_FILE)) {
  try {
    const prev = readFileSync(STAMP_FILE, "utf8").trim();
    if (prev === shortHash) needPlaywright = false;
  } catch {}
}

if (!needPlaywright) {
  log("Playwright Chromium already installed for this lockfile (stamp match)");
  process.exit(0);
}

log("Playwright install chromium (browser tools) …");
// Playwright lives on @claws/gateway — root `pnpm exec playwright` often fails
const playwrightOk = run("pnpm", [
  "--filter",
  "@claws/gateway",
  "exec",
  "playwright",
  "install",
  "chromium",
], { silent: false });

if (!playwrightOk) {
  log("playwright install failed — set CLAWS_SKIP_PLAYWRIGHT=1 to skip, or run: pnpm playwright:install");
  process.exit(postinstallOnly ? 0 : 1);
}

try {
  mkdirSync(STAMP_DIR, { recursive: true });
  writeFileSync(STAMP_FILE, shortHash, "utf8");
} catch {}

log("done");
process.exit(0);
