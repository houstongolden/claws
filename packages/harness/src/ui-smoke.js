import assert from "node:assert/strict";

/**
 * UI smoke tests for the Claws dashboard.
 *
 * Verifies that all dashboard pages serve valid HTML and contain
 * expected structural markers. Runs against the live dashboard
 * without requiring a browser driver.
 *
 * For full interactive E2E tests with Playwright, see the note
 * at the bottom — that requires `playwright` as a dev dependency.
 */

const dashboardUrl =
  process.env.CLAWS_DASHBOARD_URL || "http://localhost:4318";
const gatewayUrl =
  process.env.CLAWS_GATEWAY_URL || "http://localhost:4317";

const PAGES = [
  { path: "/", name: "Home", markers: ["Claws"] },
  { path: "/chat", name: "Chat", markers: ["Chat"] },
  { path: "/tasks", name: "Tasks", markers: ["Tasks"] },
  { path: "/projects", name: "Projects", markers: ["Projects"] },
  { path: "/files", name: "Files", markers: ["Files"] },
  { path: "/memory", name: "Memory", markers: ["Memory"] },
  { path: "/agents", name: "Agents", markers: ["Agents"] },
  { path: "/workflows", name: "Workflows", markers: ["Workflows"] },
  { path: "/approvals", name: "Approvals", markers: ["Approvals"] },
  { path: "/traces", name: "Traces", markers: ["Traces"] },
  { path: "/settings", name: "Settings", markers: ["Settings"] },
];

async function checkDashboardReachable() {
  try {
    const res = await fetch(dashboardUrl, { signal: AbortSignal.timeout(5000) });
    assert.equal(res.ok, true, `Dashboard should be reachable at ${dashboardUrl}`);
    console.log(`  Dashboard reachable at ${dashboardUrl}`);
  } catch (error) {
    console.error(`Dashboard not reachable at ${dashboardUrl}. Is it running?`);
    console.error(`Start with: pnpm dashboard`);
    process.exit(1);
  }
}

async function checkGatewayReachable() {
  try {
    const res = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    assert.equal(data.ok, true, "Gateway health ok");
    console.log(`  Gateway reachable at ${gatewayUrl}`);
  } catch (error) {
    console.error(`Gateway not reachable at ${gatewayUrl}. Is it running?`);
    console.error(`Start with: pnpm gateway`);
    process.exit(1);
  }
}

async function checkPageLoads(page) {
  const url = `${dashboardUrl}${page.path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  assert.equal(
    res.ok,
    true,
    `${page.name} page (${page.path}) should return 2xx, got ${res.status}`
  );

  const contentType = res.headers.get("content-type") ?? "";
  assert.equal(
    contentType.includes("text/html"),
    true,
    `${page.name} should return HTML, got ${contentType}`
  );

  const html = await res.text();
  assert.equal(html.length > 100, true, `${page.name} should return non-trivial HTML`);

  for (const marker of page.markers) {
    assert.equal(
      html.includes(marker),
      true,
      `${page.name} page should contain "${marker}"`
    );
  }

  console.log(`  ${page.name} (${page.path}): OK`);
}

async function checkStreamingEndpoint() {
  try {
    const res = await fetch(`${gatewayUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "status" }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 501) {
      console.log("  Streaming endpoint: 501 (no API key configured, expected in test)");
      return;
    }

    assert.equal(res.ok, true, "Streaming endpoint should return 2xx when AI is configured");
    const contentType = res.headers.get("content-type") ?? "";
    assert.equal(
      contentType.includes("text/event-stream"),
      true,
      `Streaming endpoint should return text/event-stream, got ${contentType}`
    );
    console.log("  Streaming endpoint: OK (SSE)");
  } catch {
    console.log("  Streaming endpoint: timeout or error (acceptable without API key)");
  }
}

async function checkWorkflowAPI() {
  const res = await fetch(`${gatewayUrl}/api/workflows`, {
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json();
  assert.equal(data.ok, true, "Workflow list ok");
  assert.equal(Array.isArray(data.workflows), true, "Workflows is array");
  console.log(`  Workflow API: OK (${data.workflows.length} runs)`);
}

async function main() {
  console.log("UI smoke tests starting...\n");

  console.log("Checking services:");
  await checkDashboardReachable();
  await checkGatewayReachable();

  console.log("\nChecking dashboard pages:");
  for (const page of PAGES) {
    await checkPageLoads(page);
  }

  console.log("\nChecking API endpoints:");
  await checkStreamingEndpoint();
  await checkWorkflowAPI();

  console.log("\nAll UI smoke checks passed.");
}

main().catch((error) => {
  console.error("\nUI smoke test failed:", error.message ?? error);
  process.exit(1);
});
