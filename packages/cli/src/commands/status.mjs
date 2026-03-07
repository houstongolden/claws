import { banner, section, success, fail, warn, kv, blank, hr, hint, fmt, spinner } from "../ui.mjs";
import { loadConfig } from "../config.mjs";
import { getAllPaths } from "../paths.mjs";
import { fetchGateway, resolveGatewayUrl, resolveDashboardUrl } from "../probe.mjs";
import { rand, CHECK, DONE } from "../messages.mjs";
import { timeSince, approvalCountLabel, SECTION_NAMES } from "../vocab.mjs";

export async function runStatus(args = []) {
  banner("status");

  const config = await loadConfig();
  const paths = getAllPaths();

  if (!config) {
    fail("No config found.");
    hint(`  Run ${fmt.cyan("claws setup")} to initialize.`);
    blank();
    return;
  }

  const gatewayUrl = resolveGatewayUrl(config);
  const dashboardUrl = resolveDashboardUrl(config);

  // ─── Local config ──────────────────────────────────────────

  section(SECTION_NAMES.config);
  blank();
  kv("Workspace", config.workspace || paths.workspace);
  kv("Model", config.ai?.model || fmt.dim("not set"));
  kv("View", config.onboarding?.primaryView || fmt.dim("not set"));
  kv("Approvals", config.onboarding?.approvalMode || fmt.dim("not set"));
  kv("Onboarded", config.onboarding?.completed ? fmt.green("yes") : fmt.yellow("not yet"));

  blank();

  // ─── Probe everything in parallel ─────────────────────────

  const s = spinner(rand(CHECK));
  const [health, statusRes, dashProbe, proactiveJobs, proactiveDecisions] =
    await Promise.all([
      fetchGateway(gatewayUrl, "/health", 3000),
      fetchGateway(gatewayUrl, "/api/status", 3000),
      fetchGateway(dashboardUrl, "/", 3000),
      fetchGateway(gatewayUrl, "/api/proactive/jobs", 3000),
      fetchGateway(gatewayUrl, "/api/proactive/decisions?limit=5", 3000),
    ]);
  s.stop();

  // ─── Services ──────────────────────────────────────────────

  section(SECTION_NAMES.services);
  blank();

  const gwPort = config?.gateway?.port || 4317;
  const dbPort = config?.dashboard?.port || 4318;

  if (health.ok) {
    success(`Gateway running ${fmt.dim(`:${gwPort}`)}`);
  } else {
    fail(`Gateway not running ${fmt.dim(`:${gwPort}`)}`);
  }

  if (dashProbe.ok) {
    success(`Dashboard running ${fmt.dim(`:${dbPort}`)}`);
  } else {
    fail(`Dashboard not running ${fmt.dim(`:${dbPort}`)}`);
  }

  if (!health.ok) {
    blank();
    hint(`  Start with ${fmt.cyan("claws gateway")} and ${fmt.cyan("claws dashboard")}`);
    blank();
    return;
  }

  // ─── Runtime (from gateway) ────────────────────────────────

  const st = statusRes.ok ? (statusRes.data?.status ?? statusRes.data) : null;

  if (st) {
    blank();
    section(SECTION_NAMES.runtime);
    blank();

    kv("Mode", st.mode || "local-first");

    if (st.ai) {
      const provLabel = st.ai.provider === "gateway"
        ? `AI Gateway → ${st.ai.model || "?"}`
        : `${st.ai.provider || "?"} → ${st.ai.model || "?"}`;
      kv("AI", st.ai.enabled ? fmt.green(provLabel) : fmt.dim("disabled"));
    }

    if (st.execution?.browser) {
      kv("Browser", st.execution.browser.provider || "playwright");
    }
    if (st.execution?.sandbox) {
      kv("Sandbox", st.execution.sandbox.enabled ? fmt.green("enabled") : fmt.dim("disabled"));
    }

    // Activity
    blank();
    section(SECTION_NAMES.activity);
    blank();

    if (st.workflows) {
      kv("Workflows", String(st.workflows.count ?? 0));
    }
    if (st.approvals) {
      const pending = st.approvals.pending ?? 0;
      kv("Approvals", pending > 0 ? fmt.yellow(approvalCountLabel(pending)) : fmt.dim(approvalCountLabel(0)));
    }
    if (st.traces) {
      kv("Traces", String(st.traces.count ?? 0));
    }
    if (st.tenants) {
      kv("Tenants", String(st.tenants.count ?? 0));
    }

    if (st.agents?.length > 0) {
      kv("Agents", st.agents.map((a) => fmt.cyan(a.id)).join(", "));
    }

    if (st.registeredTools?.length > 0) {
      kv("Tools", `${st.registeredTools.length} registered`);
    }
  }

  // ─── Proactive Jobs ────────────────────────────────────────

  if (proactiveJobs.ok) {
    const jobs = proactiveJobs.data?.jobs ?? [];
    if (jobs.length > 0) {
      blank();
      section(SECTION_NAMES.proactive);
      blank();
      const active = jobs.filter((j) => j.status === "active").length;
      const paused = jobs.filter((j) => j.status === "paused").length;
      kv("Jobs", `${active} active${paused > 0 ? fmt.dim(` / ${paused} paused`) : ""}`);

      if (proactiveDecisions.ok) {
        const decs = proactiveDecisions.data?.decisions ?? [];
        if (decs.length > 0) {
          const recent = decs[0];
          kv("Last decision", `${recent.outcome} ${fmt.dim(`— ${timeSince(recent.decided_at)}`)}`);
        }
      }
    }
  }

  // ─── Verdict ───────────────────────────────────────────────

  blank();
  hr();
  blank();
  console.log(`  ${fmt.green("ᐳᐸ")} ${rand(DONE)}`);
  hint(`  Full view: ${fmt.cyan("claws tui")}  Deep check: ${fmt.cyan("claws doctor")}`);
  blank();
}
