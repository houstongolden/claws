import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

import {
  bigBanner, banner, section, step, success, warn, fail,
  kv, blank, hr, hint, fmt, spinner, stepProgress,
} from "../ui.mjs";
import { getAllPaths, getWorkspaceDir, getRuntimeDir } from "../paths.mjs";
import { loadConfig, saveConfig, createDefaultConfig, ensureClawsHome } from "../config.mjs";
import { rand, pick, BOOT, SETUP, CHECK, WORKING, DONE, WELCOME } from "../messages.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Template helpers ────────────────────────────────────────────

function getTemplateRoot() {
  const monorepoPath = path.resolve(__dirname, "..", "..", "..", "..", "templates", "base", "workspace");
  if (existsSync(monorepoPath)) return monorepoPath;
  const bundledPath = path.resolve(__dirname, "..", "..", "templates", "workspace");
  if (existsSync(bundledPath)) return bundledPath;
  return null;
}

function normalizeBool(value, fallback = false) {
  if (!value) return fallback;
  const text = String(value).trim().toLowerCase();
  if (["y", "yes", "true", "1", "on"].includes(text)) return true;
  if (["n", "no", "false", "0", "off"].includes(text)) return false;
  return fallback;
}

function normalizeChoice(input, allowed, fallback) {
  const value = String(input ?? "").trim().toLowerCase();
  return allowed.has(value) ? value : fallback;
}

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
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
      `- default primary view: ${config.primaryView}`,
    ].join("\n");
    const merged = raw.includes("- default approval mode:") ? raw : `${raw.trim()}\n${extra}\n`;
    await writeFile(userPath, merged, "utf8");
  }

  const onboardPath = path.join(targetDir, "prompt", "ONBOARDING.md");
  const summary = `# ONBOARDING.md

## Initial Choices
- user: ${config.userName}
- workspace: ${config.workspaceName}
- approval mode: ${config.approvalMode}
- primary view: ${config.primaryView}
- overlays: ${config.overlays.join(", ") || "none"}
- visibility: ${config.visibility}
- telegram enabled: ${config.enableTelegram ? "yes" : "no"}
- sandbox enabled: ${config.enableSandbox ? "yes" : "no"}
- onboarded at: ${new Date().toISOString()}
`;
  await writeFile(onboardPath, summary, "utf8");
}

// ─── Wizard ──────────────────────────────────────────────────────

async function ask(rl, prompt, fallback) {
  const answer = (await rl.question(`    ${fmt.cyan("?")} ${prompt}`)).trim();
  return answer || fallback;
}

export async function runOnboard(args = []) {
  const yes = args.includes("--yes") || args.includes("-y");
  const force = args.includes("--force");
  const installDaemon = args.includes("--install-daemon");
  const paths = getAllPaths();
  const TOTAL_STEPS = 6;

  const approvalModes = new Set(["off", "smart", "strict"]);
  const viewModes = new Set(["founder", "agency", "developer", "creator", "personal", "fitness"]);
  const visibilityModes = new Set(["background", "record-on-complete", "watch-live", "hybrid"]);

  // ─── Resume / already-onboarded detection ─────────────────────

  const existingConfig = await loadConfig();
  if (existingConfig?.onboarding?.completed && !force && !yes) {
    banner("onboard");
    section("Already onboarded");
    blank();
    kv("User", existingConfig.onboarding?.userName || "Builder");
    kv("Workspace", existingConfig.workspace || paths.workspace);
    kv("View", existingConfig.onboarding?.primaryView || "founder");
    kv("Model", existingConfig.ai?.model || fmt.dim("not set"));
    blank();
    hint(`  Re-run: ${fmt.cyan("claws onboard --force")}`);
    hint(`  Check:  ${fmt.cyan("claws doctor")}`);
    blank();
    return;
  }

  // ─── Welcome ──────────────────────────────────────────────────

  bigBanner();

  if (!yes) {
    if (existingConfig && !existingConfig.onboarding?.completed) {
      console.log(`  ${fmt.yellow("ᐳᐸ")} Looks like onboarding was started but not finished.`);
      console.log(`  ${fmt.dim("Picking up where we left off.")}`);
    } else {
      console.log(`  ${rand(WELCOME)}`);
      console.log(`  ${fmt.dim("Your local-first AI OS. Let's get set up.")}`);
    }
    blank();
    hr();
    blank();
  }

  // ─── Step 1: Identity ─────────────────────────────────────────

  let userName, workspaceName, workspacePath, approvalMode, primaryView, overlays, visibility;
  let enableTelegram = false;
  let enableSandbox = false;
  let aiModel = "gpt-4o-mini";
  let aiProvider = null;

  if (yes) {
    userName = parseArg(args, "--name") || "Builder";
    workspaceName = parseArg(args, "--workspace") || "Life OS";
    workspacePath = parseArg(args, "--workspace-dir") || getWorkspaceDir();
    approvalMode = normalizeChoice(parseArg(args, "--approval-mode"), approvalModes, "smart");
    primaryView = normalizeChoice(parseArg(args, "--primary-view"), viewModes, "founder");
    overlays = (parseArg(args, "--overlays") || "developer").split(",").map((s) => s.trim()).filter(Boolean);
    visibility = normalizeChoice(parseArg(args, "--visibility"), visibilityModes, "background");
    enableTelegram = normalizeBool(parseArg(args, "--enable-telegram"), false);
    enableSandbox = normalizeBool(parseArg(args, "--enable-sandbox"), false);
    aiModel = parseArg(args, "--model") || "gpt-4o-mini";
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    stepProgress(1, TOTAL_STEPS, fmt.bold("Who are you?"));
    blank();
    userName = await ask(rl, `Your name ${fmt.dim("[Builder]")} `, "Builder");
    workspaceName = await ask(rl, `Name this workspace ${fmt.dim("[Life OS]")} `, "Life OS");
    blank();

    stepProgress(2, TOTAL_STEPS, fmt.bold("Where should I live?"));
    blank();
    const defaultWs = getWorkspaceDir();
    workspacePath = await ask(rl, `Workspace path ${fmt.dim(`[${defaultWs}]`)} `, defaultWs);
    blank();

    stepProgress(3, TOTAL_STEPS, fmt.bold("How should I behave?"));
    blank();
    hint(`    Approval modes: ${fmt.cyan("off")} (yolo) · ${fmt.cyan("smart")} (recommended) · ${fmt.cyan("strict")} (ask everything)`);
    approvalMode = normalizeChoice(
      await ask(rl, `Approval mode ${fmt.dim("[smart]")} `, "smart"),
      approvalModes, "smart",
    );
    hint(`    Views: ${fmt.cyan("founder")} · ${fmt.cyan("developer")} · ${fmt.cyan("agency")} · ${fmt.cyan("creator")} · ${fmt.cyan("personal")} · ${fmt.cyan("fitness")}`);
    primaryView = normalizeChoice(
      await ask(rl, `Primary view ${fmt.dim("[founder]")} `, "founder"),
      viewModes, "founder",
    );
    const overlaysInput = await ask(rl, `Overlay views ${fmt.dim("[developer]")} `, "developer");
    overlays = overlaysInput
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((v) => viewModes.has(v) && v !== primaryView);
    hint(`    Visibility: how much do you want to see while agents work?`);
    visibility = normalizeChoice(
      await ask(rl, `Visibility ${fmt.dim("[background]")} `, "background"),
      visibilityModes, "background",
    );
    blank();

    stepProgress(4, TOTAL_STEPS, fmt.bold("AI configuration"));
    blank();
    aiModel = await ask(rl, `Default model ${fmt.dim("[gpt-4o-mini]")} `, "gpt-4o-mini");
    hint(`    Providers: ${fmt.cyan("openai")} · ${fmt.cyan("anthropic")} · ${fmt.cyan("gateway")} (Vercel AI Gateway)`);
    aiProvider = (await ask(rl, `Provider ${fmt.dim("[openai]")} `, "openai")).toLowerCase();
    blank();

    stepProgress(5, TOTAL_STEPS, fmt.bold("Extras"));
    blank();
    enableTelegram = normalizeBool(await ask(rl, `Enable Telegram channel? ${fmt.dim("[no]")} `, "no"), false);
    enableSandbox = normalizeBool(await ask(rl, `Enable code sandbox? ${fmt.dim("[no]")} `, "no"), false);

    rl.close();
    blank();
  }

  // ─── Step 6: Build everything ─────────────────────────────────

  stepProgress(TOTAL_STEPS, TOTAL_STEPS, fmt.bold(rand(SETUP)));
  blank();

  // Home directory
  const s1 = spinner(rand(BOOT));
  await ensureClawsHome();
  await sleep(300);
  s1.stop(fmt.ok("Claws home ready"));

  // Workspace bootstrap
  const templateRoot = getTemplateRoot();
  if (!templateRoot) {
    fail("Could not find workspace templates.");
    hint(`  Run from the Claws repo, or ensure templates are bundled.`);
    process.exit(1);
  }

  const wsPath = path.resolve(workspacePath);
  await mkdir(wsPath, { recursive: true });

  if (existsSync(path.join(wsPath, "FOLDER.md"))) {
    warn("Workspace already has files — keeping existing.");
  } else {
    const s2 = spinner("Pinching workspace files into place…");
    await cp(templateRoot, wsPath, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    await replaceTokensInDir(wsPath, { userName, workspaceName, date });
    await applyOnboardingConfig(wsPath, {
      userName, workspaceName, approvalMode, primaryView,
      overlays, visibility, enableTelegram, enableSandbox,
    });
    await sleep(200);
    s2.stop(fmt.ok("Workspace bootstrapped"));
  }

  // Runtime
  const runtimeDir = getRuntimeDir();
  await mkdir(runtimeDir, { recursive: true });
  success("Runtime directory ready");

  // Save config
  let config = await loadConfig();
  if (!config) config = createDefaultConfig();

  config.workspace = wsPath;
  config.runtime = runtimeDir;
  config.ai.model = aiModel;
  config.ai.provider = aiProvider;
  config.onboarding = {
    completed: true,
    completedAt: new Date().toISOString(),
    approvalMode, primaryView, overlays, visibility,
  };
  config.channels = {
    telegram: { enabled: enableTelegram },
    slack: { enabled: false },
  };
  config.daemon = config.daemon || { installed: false, method: null };
  await saveConfig(config);
  success("Config saved");

  // Environment check
  blank();
  const envChecks = checkEnv();
  for (const check of envChecks) {
    if (check.ok) {
      success(check.msg);
    } else {
      warn(check.msg);
    }
  }

  // Daemon
  if (installDaemon) {
    blank();
    await installDaemonService(config);
  }

  // ─── Summary ──────────────────────────────────────────────────

  blank();
  hr();
  blank();
  console.log(`  ${fmt.green("ᐳᐸ")} ${fmt.bold(pick(DONE, userName))}`);
  blank();

  kv("User", userName);
  kv("Workspace", wsPath);
  kv("View", `${primaryView}${overlays.length ? fmt.dim(` + ${overlays.join(", ")}`) : ""}`);
  kv("Approvals", approvalMode);
  kv("Model", aiModel);
  kv("Config", paths.config);
  blank();

  section("Next steps");
  blank();
  hint(`  ${fmt.cyan("claws gateway")}      Start the runtime`);
  hint(`  ${fmt.cyan("claws tui")}          Full-screen operator view`);
  hint(`  ${fmt.cyan("claws dashboard")}    Open the browser dashboard`);
  hint(`  ${fmt.cyan("claws doctor")}       Check system health`);
  hint(`  ${fmt.cyan("claws status")}       Quick runtime summary`);
  blank();

  const dashUrl = `http://localhost:${config.dashboard?.port || 4318}`;
  hint(`  Dashboard: ${fmt.cyan(dashUrl)}`);
  blank();
}

// ─── Environment detection ───────────────────────────────────────

function checkEnv() {
  const checks = [];

  const hasAI =
    process.env.AI_GATEWAY_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY;

  if (hasAI) {
    checks.push({ ok: true, msg: "AI provider key detected" });
  } else {
    checks.push({ ok: false, msg: `No AI key found ${fmt.dim("— set OPENAI_API_KEY or ANTHROPIC_API_KEY")}` });
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    checks.push({ ok: true, msg: "Telegram bot token found" });
  }

  return checks;
}

// ─── Daemon install ──────────────────────────────────────────────

async function installDaemonService(config) {
  const platform = process.platform;

  if (platform === "darwin") {
    step("Creating launchd service");
    const plistPath = path.join(
      process.env.HOME || "",
      "Library", "LaunchAgents", "so.claws.gateway.plist",
    );
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>so.claws.gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${path.resolve(__dirname, "..", "..", "bin", "claws.mjs")}</string>
    <string>gateway</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${config.runtime || getRuntimeDir()}/../logs/gateway.log</string>
  <key>StandardErrorPath</key><string>${config.runtime || getRuntimeDir()}/../logs/gateway-error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CLAWS_HOME</key><string>${path.dirname(config.runtime || getRuntimeDir())}</string>
  </dict>
</dict>
</plist>`;
    try {
      await mkdir(path.dirname(plistPath), { recursive: true });
      await writeFile(plistPath, plist, "utf8");
      success(`Plist written to ${plistPath}`);
      hint(`  Run: launchctl load ${plistPath}`);
    } catch (err) {
      warn(`Could not write plist: ${err.message}`);
    }
  } else if (platform === "linux") {
    step("Creating systemd user service");
    const servicePath = path.join(
      process.env.HOME || "",
      ".config", "systemd", "user", "claws-gateway.service",
    );
    const service = `[Unit]
Description=Claws Gateway
After=network.target

[Service]
ExecStart=/usr/bin/node ${path.resolve(__dirname, "..", "..", "bin", "claws.mjs")} gateway
Restart=on-failure
Environment=CLAWS_HOME=${path.dirname(config.runtime || getRuntimeDir())}

[Install]
WantedBy=default.target
`;
    try {
      await mkdir(path.dirname(servicePath), { recursive: true });
      await writeFile(servicePath, service, "utf8");
      success(`Service written to ${servicePath}`);
      hint(`  Run: systemctl --user enable claws-gateway && systemctl --user start claws-gateway`);
    } catch (err) {
      warn(`Could not write service: ${err.message}`);
    }
  } else {
    warn("Daemon install not supported on this platform yet.");
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
