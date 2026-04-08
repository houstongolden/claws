#!/usr/bin/env node

/**
 * @claws-so/create — Bootstrap a new Claws workspace.
 *
 * Usage:
 *   npx @claws-so/create
 *   npx @claws-so/create --yes --name "Builder" --workspace "Life OS"
 */

import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Colors ──────────────────────────────────────────────────────

const R = "\x1b[0m";
const B = "\x1b[1m";
const D = "\x1b[2m";
const I = "\x1b[3m";
const G = "\x1b[32m";
const C = "\x1b[36m";
const Y = "\x1b[33m";
const E = "\x1b[31m";
const GR = "\x1b[90m";

const tty = process.stdout.isTTY !== false && process.env.NO_COLOR === undefined;
const f = (code, t) => (tty ? `${code}${t}${R}` : t);

// ─── Messages ────────────────────────────────────────────────────

const WELCOME = [
  "Hey. I'm Claws.",
  "Claws here. Let's get set up.",
  "Hello from the seafloor.",
  "Claws, reporting for duty.",
];

const DONE = [
  "Shell secured. Systems nominal.",
  "Claws are sharp. Ready when you are.",
  "Tide looks good. Let's build.",
  "The tide is in. You're good to go.",
  "I'm awake. Let's make something useful.",
];

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Helpers ─────────────────────────────────────────────────────

function getClawsHome() {
  return process.env.CLAWS_HOME || path.join(homedir(), ".claws");
}

function getTemplateRoot() {
  const monorepoPath = path.resolve(__dirname, "..", "..", "..", "templates", "base", "workspace");
  if (existsSync(monorepoPath)) return monorepoPath;
  const bundledPath = path.resolve(__dirname, "..", "templates", "workspace");
  if (existsSync(bundledPath)) return bundledPath;
  return null;
}

async function replaceTokensInDir(root, vars) {
  const entries = await readdir(root);
  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      await replaceTokensInDir(fullPath, vars);
      continue;
    }
    const ext = path.extname(fullPath).toLowerCase();
    if (![".md", ".json", ".txt", ".yaml", ".yml"].includes(ext)) continue;
    const raw = await readFile(fullPath, "utf8");
    const replaced = raw
      .replaceAll("{{USER_NAME}}", vars.userName)
      .replaceAll("{{WORKSPACE_NAME}}", vars.workspaceName)
      .replaceAll("{{DATE}}", vars.date);
    await writeFile(fullPath, replaced, "utf8");
  }
}

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

// ─── Spinner ─────────────────────────────────────────────────────

const FRAMES = ["◐", "◓", "◑", "◒"];

function spin(text) {
  if (!tty) {
    console.log(`  ${text}`);
    return { stop: (ft) => ft && console.log(`  ${ft}`) };
  }
  let i = 0;
  const iv = setInterval(() => {
    process.stdout.write(`\r  ${f(C, FRAMES[i++ % 4])} ${text}`);
  }, 100);
  return {
    stop(finalText) {
      clearInterval(iv);
      process.stdout.write("\r" + " ".repeat(text.length + 10) + "\r");
      if (finalText) console.log(finalText);
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  ${f(C, "ᐳᐸ")} ${f(B, "Create Claws Workspace")}

  ${f(B, "Usage")}
    npx @claws-so/create [options]

  ${f(B, "Options")}
    --yes, -y              Skip prompts
    --name <name>          Your name ${f(D, "[Builder]")}
    --workspace <name>     Workspace name ${f(D, "[Life OS]")}
    --dir <path>           Workspace path ${f(D, "[~/.claws/workspace]")}
    --help, -h             Show this help
`);
    return;
  }

  // Logo
  console.log();
  console.log(`    ${f(C, "   ╱╲")}`);
  console.log(`    ${f(C, "  ╱  ╲")}  ${f(B, "Claws")}`);
  console.log(`    ${f(C, " ╱ ᐳᐸ ╲")} ${f(D, "AI OS")}`);
  console.log(`    ${f(C, "╱──────╲")}`);
  console.log();

  const yes = args.includes("--yes") || args.includes("-y");
  const clawsHome = getClawsHome();

  let userName, workspaceName, workspaceDir;

  if (yes) {
    userName = parseArg(args, "--name") || "Builder";
    workspaceName = parseArg(args, "--workspace") || "Life OS";
    workspaceDir = parseArg(args, "--dir") || path.join(clawsHome, "workspace");
  } else {
    console.log(`  ${pick(WELCOME)}`);
    console.log(`  ${f(D, "Your local-first AI OS. Let's get you set up.")}`);
    console.log();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    userName = (await rl.question(`    ${f(C, "?")} Your name ${f(D, "[Builder]")} `)).trim() || "Builder";
    workspaceName = (await rl.question(`    ${f(C, "?")} Workspace name ${f(D, "[Life OS]")} `)).trim() || "Life OS";
    const defaultDir = path.join(clawsHome, "workspace");
    workspaceDir = (await rl.question(`    ${f(C, "?")} Workspace path ${f(D, `[${defaultDir}]`)} `)).trim() || defaultDir;
    rl.close();
    console.log();
  }

  // Check templates
  const templateRoot = getTemplateRoot();
  if (!templateRoot) {
    console.log(f(E, "  ✗ Could not find workspace templates."));
    console.log(f(D, "    Run from the Claws repo or ensure templates are bundled."));
    process.exit(1);
  }

  // Create directories
  const s1 = spin("Preparing the tidepool…");
  const dirs = [clawsHome, workspaceDir, path.join(clawsHome, "runtime"), path.join(clawsHome, "logs")];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
  await sleep(300);
  s1.stop(f(G, "  ✓ Claws home ready"));

  // Bootstrap workspace
  const wsPath = path.resolve(workspaceDir);
  if (existsSync(path.join(wsPath, "FOLDER.md"))) {
    console.log(f(Y, "  ⚠ Workspace already has files — keeping existing."));
  } else {
    const s2 = spin("Pinching workspace files into place…");
    await cp(templateRoot, wsPath, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    await replaceTokensInDir(wsPath, { userName, workspaceName, date });
    await sleep(200);
    s2.stop(f(G, "  ✓ Workspace bootstrapped"));
  }

  // Write config
  const configPath = path.join(clawsHome, "claws.json");
  if (!existsSync(configPath)) {
    const config = {
      version: 1,
      workspace: wsPath,
      runtime: path.join(clawsHome, "runtime"),
      gateway: { port: 4317, host: "localhost" },
      dashboard: { port: 4318 },
      ai: { model: "gpt-4o-mini", provider: null, gatewayUrl: null },
      onboarding: { completed: false, completedAt: null },
      createdAt: new Date().toISOString(),
    };
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    console.log(f(G, "  ✓ Config created"));
  } else {
    console.log(f(G, "  ✓ Config exists"));
  }

  // Summary
  console.log();
  console.log(f(D, "  " + "─".repeat(48)));
  console.log();
  console.log(`  ${f(G, "ᐳᐸ")} ${f(B, pick(DONE))}`);
  console.log();
  console.log(`    ${f(D, "User:".padEnd(16))} ${userName}`);
  console.log(`    ${f(D, "Workspace:".padEnd(16))} ${wsPath}`);
  console.log(`    ${f(D, "Config:".padEnd(16))} ${configPath}`);
  console.log();
  console.log(`  ${f(B, "Next steps")}`);
  console.log();
  console.log(`  ${f(GR, "  Install the full CLI, then run guided onboarding:")}`);
  console.log();
  console.log(`    ${f(C, "npm install -g @claws-so/cli")}`);
  console.log(`    ${f(C, "claws onboard")}`);
  console.log();
  console.log(`  ${f(GR, "  Or jump straight in:")}`);
  console.log();
  console.log(`    ${f(C, "claws gateway")}      ${f(D, "Start the runtime")}`);
  console.log(`    ${f(C, "claws dashboard")}    ${f(D, "Open the UI")}`);
  console.log(`    ${f(C, "claws doctor")}       ${f(D, "Check health")}`);
  console.log();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
