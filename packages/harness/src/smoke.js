import assert from "node:assert/strict";

const base = process.env.CLAWS_GATEWAY_URL || "http://localhost:4317";

async function json(url, init) {
  const res = await fetch(url, init);
  assert.equal(res.ok, true, `${url} expected 2xx`);
  return res.json();
}

async function main() {
  const health = await json(`${base}/health`);
  assert.equal(health.ok, true, "health ok");

  const chat = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "status" })
  });
  assert.equal(chat.ok, true, "chat ok");

  await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "approve-test" })
  });

  const approvals = await json(`${base}/api/approvals`);
  assert.equal(Array.isArray(approvals.approvals), true, "approvals array");

  const projectName = `smoke-${Date.now().toString().slice(-6)}`;
  await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `create project ${projectName}` })
  });

  const traces = await json(`${base}/api/traces`);
  assert.equal(Array.isArray(traces.traces), true, "traces array");
  assert.equal(
    traces.traces.some((trace) => trace?.type === "project-create" || trace?.type === "approval-required"),
    true,
    "project create should emit project-create or approval-required trace"
  );

  const taskEvents = await json(`${base}/api/tasks/events`);
  assert.equal(Array.isArray(taskEvents.events), true, "task events array");
  assert.equal(
    taskEvents.events.some((event) => event?.event === "workspace.project.created"),
    true,
    "workspace.project.created event should be present"
  );

  await json(`${base}/api/view-state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ primary: "developer", overlays: ["founder"] })
  });
  const viewState = await json(`${base}/api/view-state`);
  assert.equal(viewState.ok, true, "view-state ok");

  console.log("Harness smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
