#!/usr/bin/env node

/**
 * Claws AI OS CLI
 *
 * Entry point for both @claws-so/cli and @claws-so/create.
 *
 * Install paths:
 *   npx @claws-so/create           — bootstrap (recommended)
 *   npm install -g @claws-so/cli   — direct CLI install
 *
 * Then: claws <command>
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const binName = path.basename(process.argv[1] || "claws");

const isCreateMode =
  binName === "create-claws" ||
  binName === "create" ||
  process.env.CLAWS_CREATE_MODE === "1";

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

  const [command, ...rest] = process.argv.slice(2);

  // Global help
  if (!command || command === "--help" || command === "-h" || command === "help") {
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
      const { runChat } = await import("../src/commands/chat.mjs");
      await runChat(rest);
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
