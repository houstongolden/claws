#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function printHelp() {
  console.log(`Claws CLI

Usage:
  claws start
  claws chat <message>
  claws init [target-dir] [--name <name>] [--workspace <workspace-name>] [--yes]
    [--approval-mode <off|smart|strict>] [--primary-view <mode>] [--overlays <csv>]
    [--visibility <background|record-on-complete|watch-live|hybrid>]
    [--enable-telegram <yes|no>] [--enable-sandbox <yes|no>]
  claws doctor
`);
}

async function callGatewayChat(message) {
  const baseUrl = process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || "http://localhost:4317";
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway request failed (${res.status}): ${text}`);
  }

  return res.json();
}

function runStart() {
  const child = spawn("pnpm", ["dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function runDoctor() {
  const gatewayUrl = process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || process.env.CLAWS_GATEWAY_URL || "http://localhost:4317";
  const dashboardPort = Number(process.env.DASHBOARD_PORT || 4318);
  const dashboardUrl = `http://localhost:${dashboardPort}`;
  const templateRoot = path.join(repoRoot, "templates", "base", "workspace");

  const checks = [
    { name: "package.json", ok: existsSync(path.join(repoRoot, "package.json")) },
    { name: "project-context/prd.md", ok: existsSync(path.join(repoRoot, "project-context", "prd.md")) },
    { name: ".env.example", ok: existsSync(path.join(repoRoot, ".env.example")) },
    { name: "template workspace root", ok: existsSync(templateRoot) },
    { name: "template prompt/CONFIG.json", ok: existsSync(path.join(templateRoot, "prompt", "CONFIG.json")) },
    { name: "template identity/you.md", ok: existsSync(path.join(templateRoot, "identity", "you.md")) }
  ];

  try {
    const res = await fetch(`${gatewayUrl}/health`);
    checks.push({ name: `gateway /health (${gatewayUrl})`, ok: res.ok });
  } catch {
    checks.push({ name: `gateway /health (${gatewayUrl})`, ok: false });
  }

  try {
    const res = await fetch(`${dashboardUrl}`);
    checks.push({ name: `dashboard / (${dashboardUrl})`, ok: res.ok });
  } catch {
    checks.push({ name: `dashboard / (${dashboardUrl})`, ok: false });
  }

  let hasFailure = false;
  const guidance = [];
  for (const check of checks) {
    const icon = check.ok ? "OK" : "FAIL";
    console.log(`${icon} ${check.name}`);
    if (!check.ok) {
      hasFailure = true;
      if (check.name.startsWith("gateway /health")) {
        guidance.push("- Start runtime stack: pnpm dev");
      } else if (check.name.startsWith("dashboard /")) {
        guidance.push("- Ensure dashboard is running on DASHBOARD_PORT (default 4318): pnpm dev");
      } else if (check.name.includes("template")) {
        guidance.push("- Restore template scaffold under templates/base/workspace");
      } else if (check.name === ".env.example") {
        guidance.push("- Recreate .env.example from repository defaults");
      } else if (check.name === "project-context/prd.md") {
        guidance.push("- Restore canonical planning docs under project-context/");
      }
    }
  }

  if (guidance.length > 0) {
    console.log("\nActionable fixes:");
    for (const item of [...new Set(guidance)]) {
      console.log(item);
    }
  }

  process.exit(hasFailure ? 1 : 0);
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
    const textExtensions = new Set([".md", ".json", ".txt", ".yaml", ".yml"]);
    if (!textExtensions.has(ext)) continue;

    const raw = await readFile(fullPath, "utf8");
    const replaced = raw
      .replaceAll("{{USER_NAME}}", vars.userName)
      .replaceAll("{{WORKSPACE_NAME}}", vars.workspaceName)
      .replaceAll("{{DATE}}", vars.date);

    await writeFile(fullPath, replaced, "utf8");
  }
}

function parseFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function normalizeBool(value, fallback = false) {
  if (!value) return fallback;
  const text = String(value).trim().toLowerCase();
  if (["y", "yes", "true", "1", "on"].includes(text)) return true;
  if (["n", "no", "false", "0", "off"].includes(text)) return false;
  return fallback;
}

function normalizeApprovalMode(input, fallback = "smart") {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "off" || value === "smart" || value === "strict") return value;
  return fallback;
}

function normalizePrimaryView(input, fallback = "founder") {
  const value = String(input ?? "").trim().toLowerCase();
  const allowed = new Set(["founder", "agency", "developer", "creator", "personal", "fitness"]);
  return allowed.has(value) ? value : fallback;
}

function normalizeVisibility(input, fallback = "background") {
  const value = String(input ?? "").trim().toLowerCase();
  const allowed = new Set(["background", "record-on-complete", "watch-live", "hybrid"]);
  return allowed.has(value) ? value : fallback;
}

function normalizeOverlays(input, primary) {
  const allowed = new Set(["founder", "agency", "developer", "creator", "personal", "fitness"]);
  const list = String(input ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .filter((value) => allowed.has(value) && value !== primary);
  return [...new Set(list)];
}

function deterministicCopyVariant(seedText) {
  const variants = [
    "Nice. Your new AI OS is on its feet.",
    "Workspace bootstrapped. You are ready to run.",
    "Scaffold complete. Your local-first setup is ready."
  ];
  let hash = 0;
  for (const ch of seedText) hash = (hash * 31 + ch.charCodeAt(0)) % 2147483647;
  return variants[Math.abs(hash) % variants.length];
}

async function applyOnboardingConfig(targetDir, config) {
  const configPath = path.join(targetDir, "prompt", "CONFIG.json");
  if (existsSync(configPath)) {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    parsed.tools = parsed.tools ?? {};
    parsed.tools.approvals = parsed.tools.approvals ?? {};
    parsed.tools.approvals.mode = config.approvalMode;
    parsed.views = parsed.views ?? {};
    parsed.views.primary = config.primaryView;
    parsed.views.overlays = config.overlays;
    parsed.execution = parsed.execution ?? {};
    parsed.execution.visibility = config.visibility;
    parsed.integrations = parsed.integrations ?? {};
    parsed.integrations.telegramEnabled = config.enableTelegram;
    parsed.integrations.sandboxEnabled = config.enableSandbox;
    await writeFile(configPath, JSON.stringify(parsed, null, 2), "utf8");
  }

  const userPath = path.join(targetDir, "prompt", "USER.md");
  if (existsSync(userPath)) {
    const raw = await readFile(userPath, "utf8");
    const extra = [
      `- default approval mode: ${config.approvalMode}`,
      `- default visibility mode: ${config.visibility}`,
      `- default primary view: ${config.primaryView}`
    ].join("\n");
    const merged = raw.includes("- default approval mode:") ? raw : `${raw.trim()}\n${extra}\n`;
    await writeFile(userPath, merged, "utf8");
  }

  const onboardingSummaryPath = path.join(targetDir, "prompt", "ONBOARDING.md");
  const onboardingSummary = `# ONBOARDING.md

## Initial Choices
- user: ${config.userName}
- workspace: ${config.workspaceName}
- approval mode: ${config.approvalMode}
- primary view: ${config.primaryView}
- overlays: ${config.overlays.join(", ") || "none"}
- visibility: ${config.visibility}
- telegram enabled: ${config.enableTelegram ? "yes" : "no"}
- sandbox enabled: ${config.enableSandbox ? "yes" : "no"}
`;
  await writeFile(onboardingSummaryPath, onboardingSummary, "utf8");
}

async function runInit(rawArgs) {
  const targetDirArg = rawArgs.find((x) => !x.startsWith("-")) || "claws-workspace";
  const targetDir = path.resolve(process.cwd(), targetDirArg);
  const yes = rawArgs.includes("--yes");
  const date = new Date().toISOString().slice(0, 10);

  let userName = parseFlag(rawArgs, "--name");
  let workspaceName = parseFlag(rawArgs, "--workspace");
  let approvalMode = normalizeApprovalMode(parseFlag(rawArgs, "--approval-mode"), "smart");
  let primaryView = normalizePrimaryView(parseFlag(rawArgs, "--primary-view"), "founder");
  let overlayInput = parseFlag(rawArgs, "--overlays");
  let visibility = normalizeVisibility(parseFlag(rawArgs, "--visibility"), "background");
  let enableTelegram = normalizeBool(parseFlag(rawArgs, "--enable-telegram"), false);
  let enableSandbox = normalizeBool(parseFlag(rawArgs, "--enable-sandbox"), false);
  let overlays = normalizeOverlays(overlayInput, primaryView);

  if (!yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!userName) userName = (await rl.question("What should I call you? ")).trim() || "Builder";
    if (!workspaceName) workspaceName = (await rl.question("Workspace name? ")).trim() || "Life OS";

    const approvalModeInput = (await rl.question("Default approval mode (off|smart|strict) [smart]: ")).trim();
    approvalMode = normalizeApprovalMode(approvalModeInput || approvalMode, approvalMode);

    const primaryViewInput = (await rl.question("Primary view (founder|agency|developer|creator|personal|fitness) [founder]: ")).trim();
    primaryView = normalizePrimaryView(primaryViewInput || primaryView, primaryView);

    const overlaysInput = (await rl.question("Overlay views (comma list, optional) [developer]: ")).trim();
    overlayInput = overlaysInput || "developer";
    overlays = normalizeOverlays(overlayInput, primaryView);

    const visibilityInput = (await rl.question("Visibility mode (background|record-on-complete|watch-live|hybrid) [background]: ")).trim();
    visibility = normalizeVisibility(visibilityInput || visibility, visibility);

    const telegramInput = (await rl.question("Enable Telegram integration now? (yes/no) [no]: ")).trim();
    enableTelegram = normalizeBool(telegramInput || String(enableTelegram), enableTelegram);

    const sandboxInput = (await rl.question("Enable sandbox by default? (yes/no) [no]: ")).trim();
    enableSandbox = normalizeBool(sandboxInput || String(enableSandbox), enableSandbox);

    await rl.close();
  }

  userName = userName || "Builder";
  workspaceName = workspaceName || "Life OS";

  const templateRoot = path.join(repoRoot, "templates", "base", "workspace");
  if (!existsSync(templateRoot)) {
    throw new Error(`Missing template scaffold at ${templateRoot}`);
  }

  await mkdir(targetDir, { recursive: true });
  await cp(templateRoot, targetDir, { recursive: true });
  await replaceTokensInDir(targetDir, { userName, workspaceName, date });
  await applyOnboardingConfig(targetDir, {
    userName,
    workspaceName,
    approvalMode,
    primaryView,
    overlays,
    visibility,
    enableTelegram,
    enableSandbox
  });

  console.log(deterministicCopyVariant(`${userName}:${workspaceName}:${targetDirArg}`));
  console.log(`Workspace: ${targetDir}`);
  console.log(`Profile: ${primaryView} (overlays: ${overlays.join(", ") || "none"})`);
  console.log(`Approvals: ${approvalMode} | Visibility: ${visibility}`);
  console.log("Next steps:");
  console.log("- Run: claws start");
  console.log("- Open: http://localhost:4318");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "start") {
    runStart();
    return;
  }

  if (command === "chat") {
    const message = rest.join(" ").trim();
    if (!message) throw new Error("Usage: claws chat <message>");
    const data = await callGatewayChat(message);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "init" || command === "create") {
    await runInit(rest);
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
