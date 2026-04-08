import { existsSync } from "node:fs";
import path from "node:path";
import { banner, section, success, fail, warn, kv, blank, hr, hint, fmt, spinner } from "../ui.mjs";
import { getAllPaths, configExists } from "../paths.mjs";
import { loadConfig } from "../config.mjs";
import { fetchGateway, resolveGatewayUrl, resolveDashboardUrl, isPortInUse } from "../probe.mjs";
import { rand, CHECK, DONE, OOPS } from "../messages.mjs";
import { approvalCountLabel, SECTION_NAMES } from "../vocab.mjs";

export async function runDoctor(args = []) {
  const verbose = args.includes("--verbose") || args.includes("-v");

  banner("doctor");

  const s = spinner(rand(CHECK));

  const paths = getAllPaths();
  const config = await loadConfig();
  const gatewayUrl = resolveGatewayUrl(config);
  const dashboardUrl = resolveDashboardUrl(config);

  let totalPass = 0;
  let totalFail = 0;
  let totalWarn = 0;
  const fixes = [];

  function pass(msg) { totalPass++; success(msg); }
  function no(msg, fix) { totalFail++; fail(msg); if (fix) fixes.push(fix); }
  function maybe(msg) { totalWarn++; warn(msg); }

  const [gatewayHealth, gatewayStatus, dashboardProbe, gatewayPortUsed, dashboardPortUsed] =
    await Promise.all([
      fetchGateway(gatewayUrl, "/health", 3000),
      fetchGateway(gatewayUrl, "/api/status", 3000),
      fetchGateway(dashboardUrl, "/", 3000),
      isPortInUse(config?.gateway?.port || 4317),
      isPortInUse(config?.dashboard?.port || 4318),
    ]);

  s.stop();
  blank();

  // ─── Config ────────────────────────────────────────────────

  section(SECTION_NAMES.config);
  blank();

  if (configExists()) {
    pass("Config file found");
    if (config) {
      pass("Config parses correctly");
      if (config.version === 1) {
        pass(`Config version: ${config.version}`);
      } else {
        maybe(`Config version: ${config.version ?? "unknown"}`);
      }
    } else {
      no("Config file exists but failed to parse", "Check ~/.claws/claws.json for JSON errors");
    }
  } else {
    no("Config file not found", "claws setup");
  }

  if (config?.onboarding?.completed) {
    pass("Onboarding completed");
  } else if (config) {
    maybe("Onboarding not completed — run claws onboard");
  }

  if (verbose) {
    blank();
    kv("Config path", paths.config);
    if (config?.workspace) kv("Workspace", config.workspace);
    if (config?.runtime) kv("Runtime", config.runtime);
  }

  // ─── Filesystem ────────────────────────────────────────────

  blank();
  section(SECTION_NAMES.filesystem);
  blank();

  const homeOk = existsSync(paths.home);
  homeOk ? pass("Claws home directory") : no("Claws home directory missing", "claws setup");

  const wsDir = config?.workspace || paths.workspace;
  const wsOk = existsSync(wsDir);
  wsOk ? pass("Workspace directory") : no("Workspace directory missing", "claws onboard");

  existsSync(paths.runtime) ? pass("Runtime directory") : no("Runtime directory missing", "claws setup");
  existsSync(paths.logs) ? pass("Logs directory") : no("Logs directory missing", "claws setup");

  if (wsOk) {
    const wsChecks = [
      ["FOLDER.md", "FOLDER.md"],
      ["PROJECT.md", "PROJECT.md"],
      ["tasks.md", "tasks.md"],
      ["prompt/CONFIG.json", path.join("prompt", "CONFIG.json")],
      ["prompt/USER.md", path.join("prompt", "USER.md")],
      ["prompt/IDENTITY.md", path.join("prompt", "IDENTITY.md")],
      ["identity/you.md", path.join("identity", "you.md")],
      ["agents/", path.join("agents")],
      ["notes/", path.join("notes")],
    ];

    for (const [label, rel] of wsChecks) {
      const full = path.join(wsDir, rel);
      if (existsSync(full)) {
        pass(label);
      } else {
        maybe(`${label} missing`);
      }
    }
  }

  // ─── Runtime ───────────────────────────────────────────────

  blank();
  section(SECTION_NAMES.runtime);
  blank();

  const runtimeDir = config?.runtime || paths.runtime;
  const dbPath = path.join(runtimeDir, "claws-runtime");
  if (existsSync(runtimeDir)) {
    if (existsSync(dbPath)) {
      pass("PGlite database directory found");
    } else {
      maybe("PGlite database not yet initialized — starts on first gateway run");
    }
  } else {
    no("Runtime directory missing", "claws setup");
  }

  if (gatewayStatus.ok) {
    const st = gatewayStatus.data?.status ?? gatewayStatus.data;
    pass("Gateway reports runtime online");
    if (st?.workflows) {
      pass(`Workflows: ${st.workflows.count ?? 0} total ${fmt.dim(`(${st.workflows.persistence || "pglite"})`)}`);
    }
    if (st?.approvals) {
      const pending = st.approvals.pending ?? 0;
      if (pending > 0) {
        maybe(approvalCountLabel(pending));
      } else {
        pass(approvalCountLabel(0));
      }
    }
    if (st?.traces) {
      pass(`Traces: ${st.traces.count ?? 0} recorded`);
    }
  } else if (gatewayHealth.ok) {
    pass("Gateway healthy but /api/status not available");
  }

  // ─── Services ──────────────────────────────────────────────

  blank();
  section(SECTION_NAMES.services);
  blank();

  const gwPort = config?.gateway?.port || 4317;
  const dbPort = config?.dashboard?.port || 4318;

  if (gatewayHealth.ok) {
    pass(`Gateway running ${fmt.dim(`(:${gwPort})`)}`);
  } else if (gatewayPortUsed) {
    maybe(`Port ${gwPort} in use but gateway /health failed — another process?`);
  } else {
    no(`Gateway not running ${fmt.dim(`(:${gwPort})`)}`, "claws gateway");
  }

  if (dashboardProbe.ok) {
    pass(`Dashboard running ${fmt.dim(`(:${dbPort})`)}`);
  } else if (dashboardPortUsed) {
    maybe(`Port ${dbPort} in use but dashboard not responding — another process?`);
  } else {
    no(`Dashboard not running ${fmt.dim(`(:${dbPort})`)}`, "claws dashboard");
  }

  if (gwPort === dbPort) {
    no("Gateway and dashboard configured on the same port", "Change ports in claws.json");
  }

  // ─── Environment ───────────────────────────────────────────

  blank();
  section(SECTION_NAMES.environment);
  blank();

  const aiGateway = !!process.env.AI_GATEWAY_API_KEY;
  const openrouter = !!process.env.OPENROUTER_API_KEY;
  const openai = !!process.env.OPENAI_API_KEY;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasAI = aiGateway || openrouter || openai || anthropic;

  if (hasAI) {
    if (openrouter) {
      pass(`AI provider: OpenRouter ${fmt.dim("(primary)")}`);
      if (aiGateway) pass(`AI Gateway key: present ${fmt.dim("(unused while OpenRouter set)")}`);
      if (openai) pass(`OpenAI key: present ${fmt.dim("(fallback)")}`);
      if (anthropic) pass(`Anthropic key: present ${fmt.dim("(unused)")}`);
    } else if (aiGateway) {
      pass(`AI provider: Vercel AI Gateway ${fmt.dim("(primary)")}`);
      if (openai) pass(`OpenAI key: present ${fmt.dim("(fallback)")}`);
      if (anthropic) pass(`Anthropic key: present ${fmt.dim("(fallback)")}`);
    } else if (openai) {
      pass("AI provider: OpenAI");
      if (anthropic) pass(`Anthropic key: present ${fmt.dim("(fallback)")}`);
    } else {
      pass("AI provider: Anthropic");
    }
  } else {
    no("No AI provider key", "Set OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or AI_GATEWAY_API_KEY in .env");
  }

  const aiModel = process.env.AI_MODEL || config?.ai?.model;
  if (aiModel) {
    pass(`Model: ${aiModel}`);
  }

  if (gatewayStatus.ok) {
    const st = gatewayStatus.data?.status ?? gatewayStatus.data;
    if (st?.ai?.provider && st.ai.provider !== "none") {
      pass(`Gateway routing: ${st.ai.provider}`);
    }
  }

  // ─── Execution ─────────────────────────────────────────────

  blank();
  section(SECTION_NAMES.execution);
  blank();

  const browserProvider = process.env.CLAWS_BROWSER_PROVIDER;
  if (browserProvider) {
    pass(`Browser provider: ${browserProvider}`);
  } else {
    pass(`Browser provider: playwright ${fmt.dim("(default)")}`);
  }

  if (gatewayStatus.ok) {
    const st = gatewayStatus.data?.status ?? gatewayStatus.data;
    if (st?.execution?.sandbox?.enabled) {
      pass("Sandbox: enabled");
    } else {
      maybe("Sandbox: disabled");
    }
  }

  // ─── Integrations ─────────────────────────────────────────

  blank();
  section(SECTION_NAMES.integrations);
  blank();

  if (process.env.TELEGRAM_BOT_TOKEN) {
    pass("Telegram bot token");
  } else {
    maybe(`Telegram: not configured ${fmt.dim("(optional)")}`);
  }

  if (process.env.VERCEL_API_TOKEN) {
    pass("Vercel API token");
  } else {
    maybe(`Vercel: not configured ${fmt.dim("(optional)")}`);
  }

  const slackEnabled = config?.channels?.slack?.enabled;
  if (slackEnabled) {
    pass("Slack: enabled in config");
  }

  // ─── Verdict ───────────────────────────────────────────────

  blank();
  hr();
  blank();

  const total = totalPass + totalFail + totalWarn;
  const score = total > 0 ? Math.round((totalPass / total) * 100) : 0;

  const scoreColor = score >= 80 ? fmt.green : score >= 50 ? fmt.yellow : fmt.red;
  const scoreBar = renderBar(score);

  console.log(`  ${scoreColor("ᐳᐸ")} ${fmt.bold("Health:")} ${scoreColor(`${score}%`)} ${scoreBar}`);
  blank();
  console.log(`    ${fmt.green(`${totalPass} passed`)}  ${totalWarn > 0 ? fmt.yellow(`${totalWarn} warnings`) : ""}  ${totalFail > 0 ? fmt.red(`${totalFail} failed`) : ""}`);

  if (verbose) {
    blank();
    kv("Home", paths.home);
    kv("Config", paths.config);
    kv("Workspace", wsDir);
    kv("Runtime", runtimeDir);
    kv("Gateway", gatewayUrl);
    kv("Dashboard", dashboardUrl);
  }

  if (fixes.length > 0) {
    blank();
    section("Suggested fixes");
    blank();
    const unique = [...new Set(fixes)];
    for (const fix of unique) {
      hint(`  ${fmt.yellow("→")} ${fix}`);
    }
  }

  blank();
  if (totalFail === 0 && totalWarn === 0) {
    hint(`  ${rand(DONE)}`);
  } else if (totalFail === 0) {
    hint(`  Mostly good. Warnings are optional.`);
  }

  hint(`  Interactive view: ${fmt.cyan("claws tui")}  Quick summary: ${fmt.cyan("claws status")}`);
  blank();
  process.exitCode = totalFail > 0 ? 1 : 0;
}

function renderBar(pct) {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const colorFn = pct >= 80 ? fmt.green : pct >= 50 ? fmt.yellow : fmt.red;
  return colorFn("█".repeat(filled)) + fmt.dim("░".repeat(empty));
}
