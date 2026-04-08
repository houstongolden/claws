import { banner, fmt, cmd, blank, hr, hint } from "../ui.mjs";

const COMMANDS = {
  "Chat": {
    "(default)": "Interactive REPL — just run 'claws'",
    '"prompt"': "One-shot prompt — claws \"build a landing page\"",
    "chat <message>": "Send a message (alias for one-shot)",
  },
  "Operate": {
    "status, st": "Quick runtime summary",
    "doctor, doc": "Comprehensive health check",
    "tui": "Full-screen operator dashboard",
  },
  "Services": {
    "gateway, gw": "Start the gateway server",
    "dashboard, dash": "Open the browser dashboard",
  },
  "Setup": {
    "setup": "Initialize home directory and config",
    "onboard, ob": "Guided onboarding wizard",
  },
};

const SUBHELP = {
  setup: {
    desc: "Initialize the Claws home directory (~/.claws/) and write default config.",
    usage: "claws setup [--force]",
    flags: [["--force", "Reinitialize even if config exists"]],
    see: ["claws onboard", "claws doctor"],
  },
  onboard: {
    desc: "Walk through guided onboarding: identity, workspace, AI provider, integrations.",
    usage: "claws onboard [options]",
    flags: [
      ["--yes, -y", "Accept all defaults (non-interactive)"],
      ["--force", "Re-run even if already onboarded"],
      ["--install-daemon", "Install a launchd/systemd service for the gateway"],
      ["--name <name>", 'Your name (default: "Builder")'],
      ["--workspace <name>", 'Workspace name (default: "Life OS")'],
      ["--model <model>", 'Default AI model (default: "openai/gpt-5.4")'],
    ],
    see: ["claws doctor", "claws gateway"],
  },
  doctor: {
    desc: "Comprehensive health check: config, filesystem, runtime, services, environment, execution, integrations. Shows a health score and targeted fix suggestions.",
    usage: "claws doctor [--verbose]",
    flags: [["--verbose, -v", "Show extra path and config details"]],
    see: ["claws status", "claws tui"],
  },
  status: {
    desc: "Quick operator summary: services, runtime counts, AI config, proactive jobs.",
    usage: "claws status",
    flags: [],
    see: ["claws tui", "claws doctor"],
  },
  gateway: {
    desc: "Start the Claws gateway server. Reads config for port, workspace, and runtime paths.",
    usage: "claws gateway [--port <port>]",
    flags: [["--port <port>", "Override the gateway port"]],
    see: ["claws status", "claws dashboard"],
  },
  dashboard: {
    desc: "Start or open the browser dashboard. Auto-detects if already running.",
    usage: "claws dashboard [--open]",
    flags: [["--open", "Just open the URL without starting the server"]],
    see: ["claws tui", "claws gateway"],
  },
  chat: {
    desc: "Send a chat message. With no message, opens interactive REPL. With a message, runs one-shot and drops into REPL.",
    usage: 'claws chat "your message"',
    flags: [],
    see: ["claws tui", "claws gateway"],
  },
  tui: {
    desc: "Full-screen terminal UI for operating Claws. Shows sessions, approvals, tasks, traces, and workflows in a keyboard-navigable layout. Requires a running gateway.",
    usage: "claws tui",
    flags: [],
    shortcuts: [
      ["Tab / Shift+Tab", "Cycle between panes"],
      ["j / k / ↑ / ↓", "Scroll within a pane"],
      ["Enter", "Inspect session or trace"],
      ["s a t c w l", "Jump to a pane directly"],
      ["y / n", "Approve / deny (in Approvals pane)"],
      ["r", "Refresh data"],
      ["q / Ctrl+C", "Quit"],
    ],
    see: ["claws status", "claws doctor"],
  },
};

export function printHelp(subcommand) {
  if (subcommand && SUBHELP[subcommand]) {
    printSubHelp(subcommand);
    return;
  }

  banner();

  console.log(`  ${fmt.bold("Usage")}`);
  console.log(`    ${fmt.cyan("claws")}                          ${fmt.dim("Interactive REPL")}`);
  console.log(`    ${fmt.cyan("claws")} ${fmt.dim('"build me a page"')}       ${fmt.dim("One-shot prompt")}`);
  console.log(`    ${fmt.cyan("claws")} ${fmt.dim("<command>")} [options]     ${fmt.dim("Subcommand")}`);
  blank();

  for (const [group, cmds] of Object.entries(COMMANDS)) {
    console.log(`  ${fmt.bold(group)}`);
    for (const [name, desc] of Object.entries(cmds)) {
      cmd(name, desc);
    }
    blank();
  }

  console.log(`  ${fmt.bold("REPL Commands")}`);
  cmd("/help", "Show commands");
  cmd("/status", "Runtime summary");
  cmd("/tools", "List available tools");
  cmd("/model", "Show current model");
  cmd("/clear", "Clear conversation");
  cmd("/quit", "Exit");
  blank();

  console.log(`  ${fmt.bold("Options")}`);
  cmd("--help, -h", "Show help (use claws <cmd> --help for details)");
  cmd("--version, -v", "Print version");
  blank();

  console.log(`  ${fmt.bold("Quick Start")}`);
  hint("  claws onboard → claws gateway → claws");
  blank();
}

function printSubHelp(name) {
  const info = SUBHELP[name];
  banner(name);

  console.log(`  ${info.desc}`);
  blank();
  console.log(`  ${fmt.bold("Usage")}`);
  console.log(`    ${fmt.cyan(info.usage)}`);

  if (info.flags?.length > 0) {
    blank();
    console.log(`  ${fmt.bold("Options")}`);
    for (const [flag, desc] of info.flags) {
      cmd(flag, desc);
    }
  }

  if (info.shortcuts?.length > 0) {
    blank();
    console.log(`  ${fmt.bold("Keyboard")}`);
    for (const [key, desc] of info.shortcuts) {
      cmd(key, desc);
    }
  }

  if (info.see?.length > 0) {
    blank();
    console.log(`  ${fmt.bold("See also")}`);
    hint(`  ${info.see.map((c) => fmt.cyan(c)).join("  ")}`);
  }

  blank();
}

export function printVersion() {
  console.log(`${fmt.cyan("🦞")} claws ${fmt.dim("0.1.0")}`);
}
