/**
 * Session Event Stream — JSONL-backed append-only session log.
 *
 * Ported from ultraworkers/claw-code rust/crates/runtime/src/session.rs
 * (MIT licensed). This is the TypeScript-idiomatic, simplified version.
 *
 * Design:
 *   - One file per session at {stateDir}/sessions/{sessionId}.jsonl
 *   - Append-only, never edit past events
 *   - Derived views (agent tree, cost total, approval queue) are computed
 *     by scanning the file — not stored separately
 *   - Simple file locks via fs.appendFile atomicity (no external DB)
 *
 * Why JSONL over PGlite: PGlite Wasm has been crashing on Node 22 in this
 * project, and JSONL is debuggable with `cat`. Matches the ultraworkers
 * reference implementation.
 */

import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  stat,
  rm,
} from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type SessionEventType =
  | "session.start"
  | "session.end"
  | "agent.spawn"
  | "agent.despawn"
  | "agent.status"
  | "tool.call"
  | "tool.result"
  | "tool.error"
  | "approval.requested"
  | "approval.granted"
  | "approval.denied"
  | "cost.delta"
  | "message.user"
  | "message.assistant"
  | "checkpoint"
  | "note";

export type AgentStatus =
  | "idle"
  | "working"
  | "blocked"
  | "done"
  | "error";

export interface BaseEvent {
  /** ISO 8601 timestamp. */
  ts: string;
  /** Monotonic sequence within the session. */
  seq: number;
  /** Event type discriminator. */
  type: SessionEventType;
}

export interface SessionStartEvent extends BaseEvent {
  type: "session.start";
  trigger: "user" | "cron" | "resume" | "fork";
  prompt?: string;
  parentSessionId?: string;
}

export interface SessionEndEvent extends BaseEvent {
  type: "session.end";
  outcome: "complete" | "error" | "paused" | "cancelled";
  reason?: string;
}

export interface AgentSpawnEvent extends BaseEvent {
  type: "agent.spawn";
  agent: string;
  parent?: string;
  task?: string;
}

export interface AgentDespawnEvent extends BaseEvent {
  type: "agent.despawn";
  agent: string;
}

export interface AgentStatusEvent extends BaseEvent {
  type: "agent.status";
  agent: string;
  status: AgentStatus;
  reason?: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool.call";
  agent: string;
  tool: string;
  callId: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool.result";
  agent: string;
  tool: string;
  callId: string;
  ok: true;
  output: unknown;
}

export interface ToolErrorEvent extends BaseEvent {
  type: "tool.error";
  agent: string;
  tool: string;
  callId: string;
  ok: false;
  error: string;
}

export interface ApprovalRequestedEvent extends BaseEvent {
  type: "approval.requested";
  approvalId: string;
  agent: string;
  reason: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface ApprovalResolvedEvent extends BaseEvent {
  type: "approval.granted" | "approval.denied";
  approvalId: string;
  by: "user" | "auto";
  via?: "dashboard" | "telegram" | "cli" | "api";
}

export interface CostDeltaEvent extends BaseEvent {
  type: "cost.delta";
  agent?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface MessageEvent extends BaseEvent {
  type: "message.user" | "message.assistant";
  content: string;
  agent?: string;
}

export interface CheckpointEvent extends BaseEvent {
  type: "checkpoint";
  label: string;
  note?: string;
}

export interface NoteEvent extends BaseEvent {
  type: "note";
  text: string;
}

export type SessionEvent =
  | SessionStartEvent
  | SessionEndEvent
  | AgentSpawnEvent
  | AgentDespawnEvent
  | AgentStatusEvent
  | ToolCallEvent
  | ToolResultEvent
  | ToolErrorEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | CostDeltaEvent
  | MessageEvent
  | CheckpointEvent
  | NoteEvent;

// ───────────────────────────────────────────────────────────────
// Agent Tree (derived view)
// ───────────────────────────────────────────────────────────────

export interface AgentNode {
  id: string;
  parent?: string;
  status: AgentStatus;
  task?: string;
  currentTool?: string;
  spawnedAt: string;
  lastUpdatedAt: string;
  children: string[];
}

export interface AgentTree {
  nodes: Record<string, AgentNode>;
  rootIds: string[];
}

// ───────────────────────────────────────────────────────────────
// Cost Summary (derived view)
// ───────────────────────────────────────────────────────────────

export interface CostSummary {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  eventCount: number;
}

// ───────────────────────────────────────────────────────────────
// SessionEventStream
// ───────────────────────────────────────────────────────────────

export interface SessionStreamOptions {
  /** Directory where sessions/*.jsonl live. Default: ~/.claws/sessions */
  stateDir?: string;
}

type Subscriber = (event: SessionEvent) => void;

/**
 * SessionEventStream — the single source of truth for reading and writing
 * events for one session.
 *
 * Derived views (agent tree, cost summary, pending approvals) are computed
 * on demand by scanning the JSONL file. For hot paths, call `loadAll()` once
 * and reuse the array.
 */
export class SessionEventStream {
  public readonly sessionId: string;
  private readonly filePath: string;
  private seqCounter = 0;
  private readonly subscribers = new Set<Subscriber>();

  constructor(sessionId: string, opts: SessionStreamOptions = {}) {
    this.sessionId = sessionId;
    const stateDir = opts.stateDir ?? getDefaultStateDir();
    this.filePath = path.join(stateDir, "sessions", `${sessionId}.jsonl`);
  }

  /** Filesystem path of the session's JSONL file. */
  get path(): string {
    return this.filePath;
  }

  /** Append one event to the JSONL log. */
  async append(
    event: Omit<SessionEvent, "ts" | "seq">
  ): Promise<SessionEvent> {
    await this.ensureDir();
    if (this.seqCounter === 0) {
      // First write on this instance — read existing file to continue seq
      this.seqCounter = await this.countExistingLines();
    }
    const full = {
      ts: new Date().toISOString(),
      seq: ++this.seqCounter,
      ...event,
    } as SessionEvent;
    const line = JSON.stringify(full) + "\n";
    await appendFile(this.filePath, line, "utf8");
    for (const sub of this.subscribers) {
      try {
        sub(full);
      } catch {
        // never let subscriber errors break the writer
      }
    }
    return full;
  }

  /** Read all events for the session as an array. */
  async loadAll(): Promise<SessionEvent[]> {
    if (!existsSync(this.filePath)) return [];
    const content = await readFile(this.filePath, "utf8");
    return parseJsonLines(content);
  }

  /** Stream events as an async iterable — use for very large sessions. */
  async *read(): AsyncIterable<SessionEvent> {
    if (!existsSync(this.filePath)) return;
    const stream = createReadStream(this.filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed) as SessionEvent;
      } catch {
        // Skip malformed lines; log elsewhere if needed.
      }
    }
  }

  /** Derive the agent tree snapshot from the event log. */
  async getAgentTree(): Promise<AgentTree> {
    const events = await this.loadAll();
    return deriveAgentTree(events);
  }

  /** Derive cost summary. */
  async getCostSummary(): Promise<CostSummary> {
    const events = await this.loadAll();
    return deriveCostSummary(events);
  }

  /** Get pending approvals (requested but not resolved). */
  async getPendingApprovals(): Promise<ApprovalRequestedEvent[]> {
    const events = await this.loadAll();
    const pending = new Map<string, ApprovalRequestedEvent>();
    for (const ev of events) {
      if (ev.type === "approval.requested") pending.set(ev.approvalId, ev);
      if (ev.type === "approval.granted" || ev.type === "approval.denied") {
        pending.delete(ev.approvalId);
      }
    }
    return Array.from(pending.values());
  }

  /** Subscribe to new events. Returns an unsubscribe function. */
  subscribe(listener: Subscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /** Delete the session file entirely. */
  async destroy(): Promise<void> {
    if (existsSync(this.filePath)) {
      await rm(this.filePath);
    }
    this.subscribers.clear();
  }

  /** Current byte size of the log. */
  async size(): Promise<number> {
    if (!existsSync(this.filePath)) return 0;
    const s = await stat(this.filePath);
    return s.size;
  }

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
  }

  private async countExistingLines(): Promise<number> {
    if (!existsSync(this.filePath)) return 0;
    const content = await readFile(this.filePath, "utf8");
    return content.split("\n").filter((l) => l.trim().length > 0).length;
  }
}

// ───────────────────────────────────────────────────────────────
// Static helpers
// ───────────────────────────────────────────────────────────────

/** Create a new session with a random UUID. */
export function createSession(
  opts: SessionStreamOptions = {}
): SessionEventStream {
  return new SessionEventStream(randomUUID(), opts);
}

/** List all session IDs in the state dir. */
export async function listSessions(
  opts: SessionStreamOptions = {}
): Promise<string[]> {
  const stateDir = opts.stateDir ?? getDefaultStateDir();
  const dir = path.join(stateDir, "sessions");
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(/\.jsonl$/, ""));
}

/** Resume an existing session by ID. */
export function openSession(
  sessionId: string,
  opts: SessionStreamOptions = {}
): SessionEventStream {
  return new SessionEventStream(sessionId, opts);
}

// ───────────────────────────────────────────────────────────────
// Derived view helpers (exported for tests + stateless consumers)
// ───────────────────────────────────────────────────────────────

export function deriveAgentTree(events: SessionEvent[]): AgentTree {
  const nodes: Record<string, AgentNode> = {};
  const rootIds = new Set<string>();

  for (const ev of events) {
    switch (ev.type) {
      case "agent.spawn": {
        nodes[ev.agent] = {
          id: ev.agent,
          parent: ev.parent,
          status: "idle",
          task: ev.task,
          spawnedAt: ev.ts,
          lastUpdatedAt: ev.ts,
          children: [],
        };
        if (ev.parent) {
          const parent = nodes[ev.parent];
          if (parent && !parent.children.includes(ev.agent)) {
            parent.children.push(ev.agent);
          }
        } else {
          rootIds.add(ev.agent);
        }
        break;
      }
      case "agent.status": {
        const node = nodes[ev.agent];
        if (node) {
          node.status = ev.status;
          node.lastUpdatedAt = ev.ts;
        }
        break;
      }
      case "agent.despawn": {
        const node = nodes[ev.agent];
        if (node) {
          node.status = "done";
          node.lastUpdatedAt = ev.ts;
        }
        break;
      }
      case "tool.call": {
        const node = nodes[ev.agent];
        if (node) {
          node.currentTool = ev.tool;
          node.status = "working";
          node.lastUpdatedAt = ev.ts;
        }
        break;
      }
      case "tool.result":
      case "tool.error": {
        const node = nodes[ev.agent];
        if (node) {
          node.currentTool = undefined;
          if (ev.type === "tool.error") node.status = "error";
          else if (node.status === "working") node.status = "idle";
          node.lastUpdatedAt = ev.ts;
        }
        break;
      }
    }
  }

  return { nodes, rootIds: Array.from(rootIds) };
}

export function deriveCostSummary(events: SessionEvent[]): CostSummary {
  const summary: CostSummary = {
    total: 0,
    byProvider: {},
    byModel: {},
    byAgent: {},
    inputTokens: 0,
    outputTokens: 0,
    eventCount: 0,
  };

  for (const ev of events) {
    if (ev.type !== "cost.delta") continue;
    summary.eventCount++;
    summary.total += ev.costUsd;
    summary.inputTokens += ev.inputTokens;
    summary.outputTokens += ev.outputTokens;
    summary.byProvider[ev.provider] =
      (summary.byProvider[ev.provider] ?? 0) + ev.costUsd;
    summary.byModel[ev.model] =
      (summary.byModel[ev.model] ?? 0) + ev.costUsd;
    if (ev.agent) {
      summary.byAgent[ev.agent] =
        (summary.byAgent[ev.agent] ?? 0) + ev.costUsd;
    }
  }

  return summary;
}

function parseJsonLines(content: string): SessionEvent[] {
  const events: SessionEvent[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as SessionEvent);
    } catch {
      // skip malformed
    }
  }
  return events;
}

function getDefaultStateDir(): string {
  const envDir = process.env.CLAWS_STATE_DIR?.trim();
  if (envDir) return envDir;
  const envHome = process.env.CLAWS_HOME?.trim();
  if (envHome) return envHome;
  return path.join(process.env.HOME ?? process.cwd(), ".claws");
}
