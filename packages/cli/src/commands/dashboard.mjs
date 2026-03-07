import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { banner, step, success, fail, warn, hint, blank, kv, fmt } from "../ui.mjs";
import { loadConfig } from "../config.mjs";
import { isPortInUse, fetchGateway, resolveDashboardUrl } from "../probe.mjs";
import { rand, WORKING } from "../messages.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runDashboard(args = []) {
  banner("dashboard");

  const config = await loadConfig();
  const port = config?.dashboard?.port || 4318;
  const url = resolveDashboardUrl(config);

  kv("URL", fmt.cyan(url));
  blank();

  // --open: just open in browser
  if (args.includes("--open")) {
    step("Opening in browser…");
    openBrowser(url);
    blank();
    return;
  }

  // Check if already running
  const { fetchGateway: probe } = await import("../probe.mjs");
  const dashProbe = await probe(url, "/", 2000);
  if (dashProbe.ok) {
    success("Dashboard already running");
    step("Opening in browser…");
    openBrowser(url);
    hint(`  Terminal alternative: ${fmt.cyan("claws tui")}`);
    blank();
    return;
  }

  // Check for port conflict from another process
  const portUsed = await isPortInUse(port);
  if (portUsed) {
    fail(`Port ${port} is already in use by another process`);
    hint(`  Change dashboard.port in ~/.claws/claws.json`);
    hint(`  Or stop the process using port ${port}`);
    blank();
    process.exitCode = 1;
    return;
  }

  // Try to start from monorepo
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const dashboardDir = path.join(repoRoot, "apps", "dashboard");

  if (!existsSync(path.join(dashboardDir, "package.json"))) {
    fail("Dashboard app not found in this installation");
    hint(`  From the Claws monorepo: ${fmt.cyan("pnpm dashboard")}`);
    hint(`  Or open ${fmt.cyan(url)} if running elsewhere`);
    blank();
    process.exitCode = 1;
    return;
  }

  step(rand(WORKING));
  blank();

  const child = spawn("pnpm", ["dev"], {
    cwd: dashboardDir,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  setTimeout(() => {
    success(`Opening ${fmt.cyan(url)}`);
    openBrowser(url);
  }, 3000);

  child.on("exit", (code) => process.exit(code ?? 0));
}

function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${url}"`, { stdio: "ignore" });
    else if (platform === "linux") execSync(`xdg-open "${url}"`, { stdio: "ignore" });
    else if (platform === "win32") execSync(`start "${url}"`, { stdio: "ignore" });
  } catch {}
}
