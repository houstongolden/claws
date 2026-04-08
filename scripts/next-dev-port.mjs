#!/usr/bin/env node
/**
 * Start Next dev on DASHBOARD_PORT (default 4318).
 * Frees the port first (stale Next/node) so the dashboard always starts — fixes blank pages
 * when an old process still holds 4318 while turbo reports EADDRINUSE.
 *
 * CLAWS_DONT_KILL_PORT=1 — skip freeing (use findPort fallback only)
 */
import { createServer } from "node:net";
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDir = join(__dirname, "..", "apps", "dashboard");
const preferred = parseInt(process.env.DASHBOARD_PORT || "4318", 10);
const skipKill = process.env.CLAWS_DONT_KILL_PORT === "1";

async function freePort(port) {
  if (skipKill || process.platform === "win32") return;
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!out) return;
    const pids = [...new Set(out.split(/\s+/).filter(Boolean))];
    console.warn(
      `[claws/dashboard] Port ${port} in use — stopping ${pids.length} process(es) so dev can bind (set CLAWS_DONT_KILL_PORT=1 to skip)`
    );
    for (const pid of pids) {
      try {
        process.kill(parseInt(pid, 10), "SIGTERM");
      } catch {}
    }
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      try {
        const still = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (!still) break;
      } catch {
        break;
      }
      await sleep(80);
    }
    try {
      const still = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (still) {
        for (const pid of still.split(/\s+/).filter(Boolean)) {
          try {
            process.kill(parseInt(pid, 10), "SIGKILL");
          } catch {}
        }
      }
    } catch {}
  } catch {
    /* no lsof or nothing listening */
  }
}

function canListen(port) {
  return new Promise((resolve) => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "0.0.0.0", () => {
      s.close(() => resolve(true));
    });
  });
}

async function findPort(start, maxTry = 16) {
  for (let i = 0; i < maxTry; i++) {
    const port = start + i;
    if (await canListen(port)) return port;
  }
  throw new Error(`No free port in range ${start}–${start + maxTry - 1}`);
}

await freePort(preferred);
let port = preferred;
if (!(await canListen(preferred))) {
  port = await findPort(preferred + 1);
  console.warn(
    `[claws/dashboard] Port ${preferred} still busy — starting on http://localhost:${port}`
  );
} else {
  console.log(`[claws/dashboard] http://localhost:${port}`);
}

const child = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], {
  cwd: dashboardDir,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DASHBOARD_PORT: String(port) },
});

child.on("exit", (code) => process.exit(code ?? 1));
