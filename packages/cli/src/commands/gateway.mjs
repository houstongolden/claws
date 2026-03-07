import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { banner, step, success, fail, warn, kv, blank, hint, fmt, spinner } from "../ui.mjs";
import { loadConfig } from "../config.mjs";
import { getWorkspaceDir, getRuntimeDir } from "../paths.mjs";
import { isPortInUse, fetchGateway, resolveGatewayUrl } from "../probe.mjs";
import { rand, BOOT } from "../messages.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || !args[idx + 1]) return undefined;
  return args[idx + 1];
}

export async function runGateway(args = []) {
  banner("gateway");

  const config = await loadConfig();
  const portOverride = parseArg(args, "--port");
  const port = portOverride || config?.gateway?.port || process.env.CLAWS_PORT || 4317;
  const workspaceDir = config?.workspace || getWorkspaceDir();
  const runtimeDir = config?.runtime || getRuntimeDir();
  const gatewayUrl = resolveGatewayUrl(config);

  kv("Port", String(port));
  kv("Workspace", workspaceDir);
  kv("Runtime", runtimeDir);
  blank();

  // Check if already running
  const healthProbe = await fetchGateway(gatewayUrl, "/health", 2000);
  if (healthProbe.ok) {
    success(`Gateway already running at ${fmt.cyan(gatewayUrl)}`);
    hint(`  Use ${fmt.cyan("claws status")} for a summary, or ${fmt.cyan("claws tui")} for the full view`);
    blank();
    return;
  }

  // Check for port conflict
  const portUsed = await isPortInUse(port);
  if (portUsed) {
    fail(`Port ${port} is already in use by another process`);
    hint(`  Change gateway.port in ~/.claws/claws.json`);
    hint(`  Or use ${fmt.cyan(`claws gateway --port ${Number(port) + 1}`)}`);
    blank();
    process.exitCode = 1;
    return;
  }

  // Check workspace exists
  if (!existsSync(workspaceDir)) {
    warn(`Workspace not found at ${workspaceDir}`);
    hint(`  Run ${fmt.cyan("claws onboard")} to create one`);
  }

  // Find gateway app
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const gatewayDir = path.join(repoRoot, "apps", "gateway");

  if (!existsSync(path.join(gatewayDir, "package.json"))) {
    fail("Gateway app not found");
    hint(`  Are you running from the Claws monorepo?`);
    blank();
    process.exitCode = 1;
    return;
  }

  step(rand(BOOT));
  blank();

  const env = {
    ...process.env,
    CLAWS_PORT: String(port),
    CLAWS_WORKSPACE_ROOT: workspaceDir,
    CLAWS_RUNTIME_DIR: runtimeDir,
  };

  if (config?.ai?.model) env.AI_MODEL = config.ai.model;
  if (config?.ai?.gatewayUrl) env.AI_GATEWAY_URL = config.ai.gatewayUrl;

  const child = spawn("pnpm", ["dev"], {
    cwd: gatewayDir,
    stdio: "inherit",
    env,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}
