/**
 * Tests for SessionEventStream — the JSONL-backed session log.
 * Run: node --import tsx --test packages/runtime-db/src/session-events.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  SessionEventStream,
  createSession,
  openSession,
  listSessions,
  deriveAgentTree,
  deriveCostSummary,
  type SessionEvent,
} from "./session-events.js";

describe("SessionEventStream", () => {
  let stateDir: string;

  before(async () => {
    stateDir = await mkdtemp(path.join(tmpdir(), "claws-session-test-"));
  });

  after(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  test("createSession assigns a UUID and uses the provided state dir", () => {
    const session = createSession({ stateDir });
    assert.match(session.sessionId, /^[0-9a-f-]{36}$/);
    assert.ok(session.path.startsWith(stateDir));
    assert.ok(session.path.endsWith(".jsonl"));
  });

  test("append + loadAll round-trips a single event", async () => {
    const session = createSession({ stateDir });
    const event = await session.append({
      type: "session.start",
      trigger: "user",
      prompt: "test run",
    });
    assert.equal(event.seq, 1);
    assert.equal(event.type, "session.start");
    assert.ok(event.ts);

    const events = await session.loadAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "session.start");
  });

  test("append increments seq across writes", async () => {
    const session = createSession({ stateDir });
    const e1 = await session.append({ type: "agent.spawn", agent: "a" });
    const e2 = await session.append({ type: "agent.spawn", agent: "b" });
    const e3 = await session.append({
      type: "agent.status",
      agent: "a",
      status: "working",
    });
    assert.equal(e1.seq, 1);
    assert.equal(e2.seq, 2);
    assert.equal(e3.seq, 3);
  });

  test("resume via openSession continues seq counter", async () => {
    const s1 = createSession({ stateDir });
    const sessionId = s1.sessionId;
    await s1.append({ type: "session.start", trigger: "user" });
    await s1.append({ type: "agent.spawn", agent: "orchestrator" });

    const s2 = openSession(sessionId, { stateDir });
    const next = await s2.append({ type: "note", text: "resumed" });
    assert.equal(next.seq, 3, "seq continues from existing file");
  });

  test("deriveAgentTree builds parent/child structure", async () => {
    const session = createSession({ stateDir });
    await session.append({ type: "agent.spawn", agent: "orchestrator" });
    await session.append({
      type: "agent.spawn",
      agent: "design-lead",
      parent: "orchestrator",
    });
    await session.append({
      type: "agent.spawn",
      agent: "eng-lead",
      parent: "orchestrator",
    });
    await session.append({
      type: "agent.status",
      agent: "design-lead",
      status: "working",
    });

    const tree = await session.getAgentTree();
    assert.deepEqual(tree.rootIds, ["orchestrator"]);
    assert.deepEqual(tree.nodes["orchestrator"].children.sort(), [
      "design-lead",
      "eng-lead",
    ]);
    assert.equal(tree.nodes["design-lead"].status, "working");
    assert.equal(tree.nodes["eng-lead"].status, "idle");
  });

  test("deriveAgentTree tracks tool.call / tool.result transitions", async () => {
    const session = createSession({ stateDir });
    await session.append({ type: "agent.spawn", agent: "worker-1" });
    await session.append({
      type: "tool.call",
      agent: "worker-1",
      tool: "fs.write",
      callId: "c1",
      args: { path: "/tmp/x" },
    });
    let tree = await session.getAgentTree();
    assert.equal(tree.nodes["worker-1"].status, "working");
    assert.equal(tree.nodes["worker-1"].currentTool, "fs.write");

    await session.append({
      type: "tool.result",
      agent: "worker-1",
      tool: "fs.write",
      callId: "c1",
      ok: true,
      output: { bytes: 42 },
    });
    tree = await session.getAgentTree();
    assert.equal(tree.nodes["worker-1"].status, "idle");
    assert.equal(tree.nodes["worker-1"].currentTool, undefined);
  });

  test("deriveAgentTree promotes tool.error to error state", async () => {
    const session = createSession({ stateDir });
    await session.append({ type: "agent.spawn", agent: "w" });
    await session.append({
      type: "tool.call",
      agent: "w",
      tool: "fs.write",
      callId: "c1",
      args: {},
    });
    await session.append({
      type: "tool.error",
      agent: "w",
      tool: "fs.write",
      callId: "c1",
      ok: false,
      error: "permission denied",
    });
    const tree = await session.getAgentTree();
    assert.equal(tree.nodes["w"].status, "error");
  });

  test("deriveCostSummary aggregates across providers and agents", async () => {
    const session = createSession({ stateDir });
    await session.append({
      type: "cost.delta",
      agent: "a1",
      provider: "openrouter",
      model: "gpt-4o-mini",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.0025,
    });
    await session.append({
      type: "cost.delta",
      agent: "a2",
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 800,
      outputTokens: 200,
      costUsd: 0.006,
    });
    await session.append({
      type: "cost.delta",
      agent: "a1",
      provider: "openrouter",
      model: "gpt-4o-mini",
      inputTokens: 500,
      outputTokens: 100,
      costUsd: 0.001,
    });

    const summary = await session.getCostSummary();
    const closeTo = (a: number, b: number, eps = 1e-9) =>
      Math.abs(a - b) < eps;
    assert.equal(summary.eventCount, 3);
    assert.ok(closeTo(summary.total, 0.0095), `total ~ 0.0095, got ${summary.total}`);
    assert.equal(summary.inputTokens, 2300);
    assert.equal(summary.outputTokens, 800);
    assert.ok(closeTo(summary.byProvider.openrouter, 0.0035));
    assert.ok(closeTo(summary.byProvider.anthropic, 0.006));
    assert.ok(closeTo(summary.byAgent.a1, 0.0035));
    assert.ok(closeTo(summary.byAgent.a2, 0.006));
  });

  test("getPendingApprovals filters resolved approvals", async () => {
    const session = createSession({ stateDir });
    await session.append({
      type: "approval.requested",
      approvalId: "a1",
      agent: "x",
      reason: "migration",
    });
    await session.append({
      type: "approval.requested",
      approvalId: "a2",
      agent: "y",
      reason: "deploy",
    });
    await session.append({
      type: "approval.granted",
      approvalId: "a1",
      by: "user",
      via: "telegram",
    });

    const pending = await session.getPendingApprovals();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].approvalId, "a2");
  });

  test("subscribe fires for new events and unsubscribe stops delivery", async () => {
    const session = createSession({ stateDir });
    const received: SessionEvent[] = [];
    const unsub = session.subscribe((ev) => received.push(ev));
    await session.append({ type: "note", text: "one" });
    await session.append({ type: "note", text: "two" });
    unsub();
    await session.append({ type: "note", text: "three" });
    assert.equal(received.length, 2);
    assert.equal((received[0] as { text: string }).text, "one");
  });

  test("listSessions finds all session files in state dir", async () => {
    const isolateDir = await mkdtemp(
      path.join(tmpdir(), "claws-list-test-")
    );
    try {
      await createSession({ stateDir: isolateDir }).append({
        type: "note",
        text: "one",
      });
      await createSession({ stateDir: isolateDir }).append({
        type: "note",
        text: "two",
      });
      const ids = await listSessions({ stateDir: isolateDir });
      assert.equal(ids.length, 2);
      ids.forEach((id) => assert.match(id, /^[0-9a-f-]{36}$/));
    } finally {
      await rm(isolateDir, { recursive: true, force: true });
    }
  });

  test("destroy removes the session file", async () => {
    const session = createSession({ stateDir });
    await session.append({ type: "note", text: "ephemeral" });
    assert.notEqual(await session.size(), 0);
    await session.destroy();
    assert.equal(await session.size(), 0);
  });

  test("streaming read() yields events in order", async () => {
    const session = createSession({ stateDir });
    await session.append({ type: "agent.spawn", agent: "a" });
    await session.append({ type: "agent.spawn", agent: "b" });
    await session.append({ type: "agent.spawn", agent: "c" });
    const ids: string[] = [];
    for await (const ev of session.read()) {
      if (ev.type === "agent.spawn") ids.push(ev.agent);
    }
    assert.deepEqual(ids, ["a", "b", "c"]);
  });

  test("pure deriveAgentTree works on raw event arrays", () => {
    const events: SessionEvent[] = [
      {
        type: "agent.spawn",
        agent: "root",
        ts: "2026-01-01T00:00:00Z",
        seq: 1,
      },
      {
        type: "agent.spawn",
        agent: "child",
        parent: "root",
        ts: "2026-01-01T00:00:01Z",
        seq: 2,
      },
    ];
    const tree = deriveAgentTree(events);
    assert.deepEqual(tree.rootIds, ["root"]);
    assert.deepEqual(tree.nodes["root"].children, ["child"]);
  });

  test("pure deriveCostSummary works on raw event arrays", () => {
    const events: SessionEvent[] = [
      {
        type: "cost.delta",
        provider: "openrouter",
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        ts: "2026-01-01T00:00:00Z",
        seq: 1,
      },
    ];
    const summary = deriveCostSummary(events);
    assert.equal(summary.total, 0.001);
    assert.equal(summary.eventCount, 1);
  });
});
