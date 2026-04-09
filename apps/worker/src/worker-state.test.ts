/**
 * Tests for WorkerState state machine and WorkerRegistry.
 * Run: node --import tsx --test apps/worker/src/worker-state.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  WorkerState,
  WorkerRegistry,
  isLegalTransition,
  type WorkerStateSnapshot,
} from "./worker-state.js";

describe("isLegalTransition", () => {
  test("spawning can go to trust_required, ready, or failed", () => {
    assert.equal(isLegalTransition("spawning", "trust_required"), true);
    assert.equal(isLegalTransition("spawning", "ready"), true);
    assert.equal(isLegalTransition("spawning", "failed"), true);
    assert.equal(isLegalTransition("spawning", "running"), false);
    assert.equal(isLegalTransition("spawning", "blocked"), false);
    assert.equal(isLegalTransition("spawning", "finished"), false);
  });

  test("ready can go to running, finished, or failed", () => {
    assert.equal(isLegalTransition("ready", "running"), true);
    assert.equal(isLegalTransition("ready", "finished"), true);
    assert.equal(isLegalTransition("ready", "failed"), true);
    assert.equal(isLegalTransition("ready", "blocked"), false);
  });

  test("running can go to ready, blocked, finished, or failed", () => {
    assert.equal(isLegalTransition("running", "ready"), true);
    assert.equal(isLegalTransition("running", "blocked"), true);
    assert.equal(isLegalTransition("running", "finished"), true);
    assert.equal(isLegalTransition("running", "failed"), true);
  });

  test("blocked can go back to running, ready, finished, or failed", () => {
    assert.equal(isLegalTransition("blocked", "running"), true);
    assert.equal(isLegalTransition("blocked", "ready"), true);
    assert.equal(isLegalTransition("blocked", "finished"), true);
    assert.equal(isLegalTransition("blocked", "failed"), true);
  });

  test("finished is terminal", () => {
    assert.equal(isLegalTransition("finished", "running"), false);
    assert.equal(isLegalTransition("finished", "ready"), false);
    assert.equal(isLegalTransition("finished", "failed"), false);
  });

  test("failed is terminal", () => {
    assert.equal(isLegalTransition("failed", "running"), false);
    assert.equal(isLegalTransition("failed", "ready"), false);
    assert.equal(isLegalTransition("failed", "finished"), false);
  });

  test("same-state transition is legal (idempotent)", () => {
    assert.equal(isLegalTransition("ready", "ready"), true);
    assert.equal(isLegalTransition("running", "running"), true);
  });
});

describe("WorkerState lifecycle", () => {
  test("initial state is spawning with seed data", () => {
    const w = new WorkerState("worker-1");
    const snap = w.snapshot();
    assert.equal(snap.workerId, "worker-1");
    assert.equal(snap.status, "spawning");
    assert.equal(snap.stepsExecuted, 0);
    assert.ok(snap.spawnedAt);
    assert.ok(snap.lastUpdatedAt);
    assert.equal(snap.lastError, undefined);
  });

  test("happy path: spawning → ready → running → finished", () => {
    const w = new WorkerState("happy");
    w.transition("ready");
    assert.equal(w.getStatus(), "ready");
    w.transition("running", { task: "ship feature" });
    assert.equal(w.snapshot().currentTask, "ship feature");
    w.transition("finished");
    assert.equal(w.getStatus(), "finished");
  });

  test("full path with trust gate: spawning → trust_required → ready → running → blocked → running → finished", () => {
    const w = new WorkerState("trust");
    w.transition("trust_required");
    w.transition("ready");
    w.transition("running");
    w.transition("blocked", { approvalId: "a-1" });
    assert.equal(w.snapshot().currentApprovalId, "a-1");
    w.transition("running");
    assert.equal(
      w.snapshot().currentApprovalId,
      undefined,
      "approval cleared on resume"
    );
    w.transition("finished");
  });

  test("illegal transition throws", () => {
    const w = new WorkerState("illegal");
    w.transition("ready");
    w.transition("finished");
    assert.throws(
      () => w.transition("running"),
      /illegal transition finished → running/
    );
  });

  test("incrementStep advances counter and updates timestamp", async () => {
    const w = new WorkerState("step");
    w.transition("ready");
    w.transition("running");
    const beforeTs = w.snapshot().lastUpdatedAt;
    await new Promise((r) => setTimeout(r, 5));
    w.incrementStep();
    w.incrementStep();
    w.incrementStep();
    const snap = w.snapshot();
    assert.equal(snap.stepsExecuted, 3);
    assert.notEqual(snap.lastUpdatedAt, beforeTs);
  });

  test("fail() sets structured error and transitions to failed", () => {
    const w = new WorkerState("fail");
    w.transition("ready");
    w.transition("running");
    w.fail("cost_cap", "hit $50/day cap", true);
    const snap = w.snapshot();
    assert.equal(snap.status, "failed");
    assert.equal(snap.lastError?.kind, "cost_cap");
    assert.equal(snap.lastError?.message, "hit $50/day cap");
    assert.equal(snap.lastError?.recoverable, true);
  });

  test("subscribe receives snapshots on transitions", () => {
    const w = new WorkerState("sub");
    const received: WorkerStateSnapshot[] = [];
    const unsub = w.subscribe((s) => received.push(s));
    w.transition("ready");
    w.transition("running");
    w.incrementStep();
    unsub();
    w.transition("finished");
    assert.equal(received.length, 3);
    assert.equal(received[0].status, "ready");
    assert.equal(received[1].status, "running");
    assert.equal(received[2].stepsExecuted, 1);
  });

  test("listener errors don't break the emitter", () => {
    const w = new WorkerState("robust");
    w.subscribe(() => {
      throw new Error("listener boom");
    });
    let saw = 0;
    w.subscribe(() => saw++);
    w.transition("ready");
    assert.equal(saw, 1);
  });
});

describe("WorkerRegistry", () => {
  test("spawn creates and tracks a worker", () => {
    const reg = new WorkerRegistry();
    const w = reg.spawn("w1");
    assert.equal(w.workerId, "w1");
    assert.equal(reg.get("w1"), w);
  });

  test("spawn throws on duplicate ids", () => {
    const reg = new WorkerRegistry();
    reg.spawn("dup");
    assert.throws(() => reg.spawn("dup"), /already exists/);
  });

  test("list returns all worker snapshots", () => {
    const reg = new WorkerRegistry();
    reg.spawn("a");
    reg.spawn("b");
    reg.spawn("c");
    const all = reg.list();
    assert.equal(all.length, 3);
    const ids = all.map((w) => w.workerId).sort();
    assert.deepEqual(ids, ["a", "b", "c"]);
  });

  test("listActive filters finished and failed", () => {
    const reg = new WorkerRegistry();
    reg.spawn("active");
    reg.spawn("done");
    reg.spawn("broken");
    reg.get("done")?.transition("ready");
    reg.get("done")?.transition("finished");
    reg.get("broken")?.fail("compile", "tsc error");
    const active = reg.listActive();
    assert.equal(active.length, 1);
    assert.equal(active[0].workerId, "active");
  });

  test("listBlocked returns blocked + trust_required", () => {
    const reg = new WorkerRegistry();
    reg.spawn("a");
    reg.spawn("b");
    reg.spawn("c");
    reg.get("a")?.transition("trust_required");
    reg.get("b")?.transition("ready");
    reg.get("b")?.transition("running");
    reg.get("b")?.transition("blocked", { approvalId: "x" });
    const blocked = reg.listBlocked();
    assert.equal(blocked.length, 2);
    const ids = blocked.map((w) => w.workerId).sort();
    assert.deepEqual(ids, ["a", "b"]);
  });

  test("remove deletes a worker from the registry", () => {
    const reg = new WorkerRegistry();
    reg.spawn("ephemeral");
    assert.equal(reg.remove("ephemeral"), true);
    assert.equal(reg.get("ephemeral"), undefined);
    assert.equal(reg.remove("ephemeral"), false);
  });

  test("registry subscribe fires for all worker state changes", () => {
    const reg = new WorkerRegistry();
    const events: WorkerStateSnapshot[] = [];
    const unsub = reg.subscribe((s) => events.push(s));
    const a = reg.spawn("a");
    // initial snapshot emitted
    a.transition("ready");
    a.transition("running");
    unsub();
    a.transition("finished"); // not received
    assert.ok(events.length >= 3);
    assert.ok(events.some((e) => e.status === "ready"));
    assert.ok(events.some((e) => e.status === "running"));
    assert.ok(!events.some((e) => e.status === "finished"));
  });
});
