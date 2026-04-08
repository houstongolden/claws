#!/usr/bin/env node

/**
 * Claws AI OS CLI
 *
 * Entry point for both @claws-so/cli and @claws-so/create.
 *
 * Usage:
 *   claws                        — interactive REPL (default)
 *   claws "your prompt"          — one-shot prompt
 *   claws <command> [options]    — subcommand
 *
 * Install:
 *   npx @claws-so/create           — bootstrap
 *   npm install -g @claws-so/cli   — global CLI
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const binName = path.basename(process.argv[1] || "claws");

const isCreateMode =
  binName === "create-claws" ||
  binName === "create" ||
  process.env.CLAWS_CREATE_MODE === "1";

// Known subcommands + aliases
const ALIASES = {
  st: "status",
  gw: "gateway",
  db: "dashboard",
  dash: "dashboard",
  doc: "doctor",
  ob: "onboard",
  prompt: "chat",
};

const ROUTABLE = new Set([
  "setup", "onboard", "doctor", "status",
  "dashboard", "gateway", "chat", "tui", "init", "create",
]);

async function main() {
  if (isCreateMode) {
    const { runOnboard } = await import("../src/commands/onboard.mjs");
    await runOnboard(process.argv.slice(2));
    return;
  }

  const rawArgs = process.argv.slice(2);
  let [command, ...rest] = rawArgs;

  // Resolve aliases
  if (command && ALIASES[command]) {
    command = ALIASES[command];
  }

  // No args + TTY → interactive REPL
  if (!command && process.stdin.isTTY) {
    const { runRepl } = await import("../src/commands/repl.mjs");
    await runRepl();
    return;
  }

  // No args + piped stdin → read stdin as prompt
  if (!command && !process.stdin.isTTY) {
    const { printHelp } = await import("../src/commands/help.mjs");
    printHelp();
    return;
  }

  // Help flags
  if (command === "--help" || command === "-h" || command === "help") {
    const { printHelp } = await import("../src/commands/help.mjs");
    printHelp();
    return;
  }

  // Version
  if (command === "--version" || command === "-v" || command === "version") {
    const { printVersion } = await import("../src/commands/help.mjs");
    printVersion();
    return;
  }

  // Per-command --help
  if (ROUTABLE.has(command) && (rest.includes("--help") || rest.includes("-h"))) {
    const { printHelp } = await import("../src/commands/help.mjs");
    printHelp(command);
    return;
  }

  // If command is not a known subcommand, treat the entire input as a one-shot prompt
  // e.g. `claws "build me a landing page"` or `claws what tasks are open`
  if (command && !ROUTABLE.has(command) && !command.startsWith("-")) {
    const { runRepl } = await import("../src/commands/repl.mjs");
    const prompt = rawArgs.join(" ");
    await runRepl(prompt);
    return;
  }

  switch (command) {
    case "setup": {
      const { runSetup } = await import("../src/commands/setup.mjs");
      await runSetup(rest);
      break;
    }
    case "onboard": {
      const { runOnboard } = await import("../src/commands/onboard.mjs");
      await runOnboard(rest);
      break;
    }
    case "doctor": {
      const { runDoctor } = await import("../src/commands/doctor.mjs");
      await runDoctor(rest);
      break;
    }
    case "status": {
      const { runStatus } = await import("../src/commands/status.mjs");
      await runStatus(rest);
      break;
    }
    case "dashboard": {
      const { runDashboard } = await import("../src/commands/dashboard.mjs");
      await runDashboard(rest);
      break;
    }
    case "gateway": {
      const { runGateway } = await import("../src/commands/gateway.mjs");
      await runGateway(rest);
      break;
    }
    case "chat": {
      if (rest.length > 0) {
        // claws chat "message" → one-shot
        const { runRepl } = await import("../src/commands/repl.mjs");
        await runRepl(rest.join(" "));
      } else {
        // claws chat → REPL
        const { runRepl } = await import("../src/commands/repl.mjs");
        await runRepl();
      }
      break;
    }
    case "tui": {
      const { runTui } = await import("../src/commands/tui.mjs");
      await runTui();
      break;
    }
    case "init":
    case "create": {
      const { runInit } = await import("../src/commands/init.mjs");
      await runInit(rest);
      break;
    }
    default: {
      // Shouldn't reach here due to one-shot prompt handling above, but just in case
      const { fmt, blank } = await import("../src/ui.mjs");
      blank();
      console.error(`  ${fmt.red("✗")} Unknown command: ${fmt.bold(command)}`);
      console.error(`  Run ${fmt.cyan("claws --help")} for available commands.`);
      blank();
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
