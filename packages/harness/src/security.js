import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const base = process.env.CLAWS_GATEWAY_URL || "http://localhost:4317";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

async function json(url, init) {
  const res = await fetch(url, init);
  assert.equal(res.ok, true, `${url} expected 2xx`);
  return res.json();
}

async function listApprovals() {
  const payload = await json(`${base}/api/approvals`);
  assert.equal(Array.isArray(payload.approvals), true, "approvals should be an array");
  return payload.approvals;
}

async function resolveApproval(requestId, decision, grant) {
  return json(`${base}/api/approvals/${requestId}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, grant })
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetRuntimeState() {
  const payload = await json(`${base}/api/test/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(payload.ok, true, "runtime reset should return ok");
}

async function runPathGovernanceChecks() {
  const build = spawnSync("pnpm", ["--filter", "@claws/workspace", "build"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (build.status !== 0) {
    throw new Error(`Failed to build workspace package:\n${build.stderr || build.stdout}`);
  }

  const workspaceModulePath = pathToFileURL(path.join(repoRoot, "packages", "workspace", "dist", "workspace-fs.js")).href;
  const { WorkspaceFS } = await import(workspaceModulePath);

  const tempRoot = path.join(repoRoot, ".claws", "tmp-security");
  const ws = new WorkspaceFS(tempRoot);

  await ws.write("drafts/path-governance-ok.md", "ok");
  const ok = await ws.read("drafts/path-governance-ok.md");
  assert.equal(ok, "ok", "allowed writes should succeed");

  let topLevelError = "";
  try {
    await ws.write("tmp/blocked.md", "no");
  } catch (error) {
    topLevelError = error instanceof Error ? error.message : String(error);
  }
  assert.equal(topLevelError.includes('Top-level path "tmp" is not allowed'), true, "forbidden top-level should fail");

  let traversalError = "";
  try {
    await ws.write("drafts/../../outside.md", "no");
  } catch (error) {
    traversalError = error instanceof Error ? error.message : String(error);
  }
  assert.equal(traversalError.includes("Path traversal is not allowed"), true, "traversal should fail");
}

async function main() {
  const health = await json(`${base}/health`);
  assert.equal(health.ok, true, "gateway health should be ok");

  await resetRuntimeState();
  await runPathGovernanceChecks();

  await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "approve-test" })
  });
  const seededApprovals = await listApprovals();
  const synthetic = seededApprovals.find((item) => item?.reason === "Synthetic approval trigger for dashboard testing");
  assert.equal(Boolean(synthetic), true, "synthetic approval should be enqueued");
  await resolveApproval(synthetic.id, "denied");

  const projectName = `security-${Date.now().toString().slice(-6)}`;
  const createAttempt1 = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `create project ${projectName}` })
  });

  assert.equal(createAttempt1.ok, true, "chat envelope should be ok");
  const firstAttemptPaused = createAttempt1.result?.ok === false;
  assert.equal(firstAttemptPaused, true, "project create should pause for approval after reset");

  const approvals1 = await listApprovals();
  const pendingFsApproval = approvals1.find((item) => item?.toolName === "fs.write");
  assert.equal(Boolean(pendingFsApproval), true, "pending fs.write approval should exist");
  await resolveApproval(pendingFsApproval.id, "denied");

  const createAttempt2 = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `create project ${projectName}` })
  });
  assert.equal(createAttempt2.result?.ok, false, "denied write should still require approval on retry");

  const approvals2 = await listApprovals();
  const pendingAfterDeny = approvals2.find((item) => item?.toolName === "fs.write");
  assert.equal(Boolean(pendingAfterDeny), true, "approval should be re-requested after deny");

  await resolveApproval(pendingAfterDeny.id, "approved", {
    scope: { type: "once", toolName: "fs.write" },
    note: "security harness once grant"
  });

  const createAttempt3 = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `create draft ${projectName}-once` })
  });
  assert.equal(createAttempt3.result?.ok, true, "once grant should permit one single-write action");

  const createAttempt4 = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `create draft ${projectName}-once-consumed` })
  });
  assert.equal(createAttempt4.result?.ok, false, "once grant should be consumed after first single-write use");

  const approvals3 = await listApprovals();
  const pendingAfterOnce = approvals3.find((item) => item?.toolName === "fs.write");
  assert.equal(Boolean(pendingAfterOnce), true, "approval should return after once grant is consumed");

  await resolveApproval(pendingAfterOnce.id, "approved", {
    scope: { type: "tool", toolName: "fs.write" },
    expiresAt: Date.now() + 50,
    note: "security harness short-lived tool grant"
  });

  await sleep(90);
  const createAttempt5 = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `create draft ${projectName}-expiry-check` })
  });
  assert.equal(createAttempt5.result?.ok, false, "expired tool grant should not permit single-write action");

  const memorySeed = `security-memory-${Date.now()}`;
  const remember = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `remember this: ${memorySeed}` })
  });
  const flushResult = remember?.result?.toolResults?.find((item) => item?.toolName === "memory.flush");
  assert.equal(Boolean(flushResult?.ok), true, "remember command should flush memory entry");
  const entryId = flushResult?.data?.entry?.id;
  assert.equal(typeof entryId, "string", "memory.flush should return entry id");

  const promote = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `promote memory ${entryId}` })
  });
  const promoteResult = promote?.result?.toolResults?.find((item) => item?.toolName === "memory.promote");
  assert.equal(Boolean(promoteResult?.ok), true, "promote command should mark memory entry as promoted");

  const search = await json(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `what did we decide ${memorySeed}` })
  });
  const searchResult = search?.result?.toolResults?.find((item) => item?.toolName === "memory.search");
  assert.equal(Boolean(searchResult?.ok), true, "memory.search should execute successfully");
  const results = searchResult?.data?.results;
  assert.equal(Array.isArray(results), true, "memory.search should return results array");
  assert.equal(
    results.some((item) => String(item?.memoryId ?? "") === String(entryId)),
    true,
    "memory.search should include the persisted memory entry id"
  );

  console.log("Security harness checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
