import { existsSync } from "node:fs";
import { banner, section, step, success, warn, kv, blank, hr, hint, fmt, spinner } from "../ui.mjs";
import { getAllPaths, configExists } from "../paths.mjs";
import { loadConfig, saveConfig, createDefaultConfig, ensureClawsHome } from "../config.mjs";
import { rand, BOOT, SETUP, DONE } from "../messages.mjs";

export async function runSetup(args = []) {
  const force = args.includes("--force");

  banner("setup");

  const paths = getAllPaths();
  const existingConfig = await loadConfig();

  // ─── Already configured ─────────────────────────────────────

  if (existingConfig && !force) {
    section("Already configured");
    blank();
    kv("Config", paths.config);
    kv("Workspace", existingConfig.workspace || paths.workspace);
    kv("Model", existingConfig.ai?.model || fmt.dim("not set"));
    kv("Onboarded", existingConfig.onboarding?.completed ? fmt.green("yes") : fmt.yellow("not yet"));
    blank();

    // Detect partial state and give targeted advice
    if (!existingConfig.onboarding?.completed) {
      hint(`  Continue setup: ${fmt.cyan("claws onboard")}`);
    } else {
      hint(`  Check health: ${fmt.cyan("claws doctor")}`);
    }
    hint(`  Reinitialize: ${fmt.cyan("claws setup --force")}`);
    blank();
    return;
  }

  // ─── Run setup ──────────────────────────────────────────────

  const s = spinner(rand(BOOT));
  await ensureClawsHome();
  await sleep(300);
  s.stop();

  blank();
  for (const [label, dir] of Object.entries(paths)) {
    if (label === "config") continue;
    const existed = existsSync(dir);
    success(`${label} ${fmt.dim("→")} ${dir}${existed ? fmt.dim(" (exists)") : ""}`);
  }

  blank();
  step("Writing config");
  const config = existingConfig && force
    ? { ...existingConfig, version: 1 }
    : createDefaultConfig({ workspace: paths.workspace, runtime: paths.runtime });
  await saveConfig(config);
  success(`Config ${fmt.dim("→")} ${paths.config}`);

  // ─── Summary ────────────────────────────────────────────────

  blank();
  hr();
  blank();
  console.log(`  ${fmt.green("ᐳᐸ")} ${fmt.bold("Home initialized.")}`);
  blank();

  if (existingConfig && force) {
    hint(`  Config preserved (force reinit).`);
    blank();
  }

  hint(`  Next: ${fmt.cyan("claws onboard")} — guided workspace setup`);
  hint(`        ${fmt.cyan("claws doctor")}  — check system health`);
  hint(`        ${fmt.cyan("claws tui")}     — full-screen operator view`);
  blank();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
