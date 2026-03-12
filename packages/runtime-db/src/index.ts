/**
 * Local-first runtime state store using PGlite.
 * Canonical workspace content (projects/, prompt/, identity/, notes/, tasks.md, FOLDER.md)
 * remains on the filesystem. This package stores only runtime state.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type {
  ApprovalItem,
  TraceItem,
  ViewStack,
  WorkflowRun,
  WorkflowStatus,
  WorkflowDefinition,
  Channel,
  ScheduledJob,
  JobExecution,
  ProactiveNotification,
  ProactiveJobKind,
  ProactiveJobStatus,
  ModelTier,
} from "@claws/shared/types";
import type { SessionLiveState } from "@claws/shared/types";
import { SCHEMA_SQL, CONVERSATIONS_SCHEMA_SQL, INTELLIGENCE_SCHEMA_SQL, CHANNELS_SCHEMA_SQL, PROACTIVITY_SCHEMA_SQL, DECISION_ENGINE_SCHEMA_SQL } from "./schema.js";
import { getDb, setDb, clearDb } from "./db-internal.js";

export { getDb };

let db: PGlite | null = null;

export type RuntimeDbOptions = {
  workspaceRoot: string;
};

const RUNTIME_DIR = ".claws/runtime";

/**
 * Initialize PGlite and create schema. Call once at gateway startup.
 */
export async function initRuntimeDb(options: RuntimeDbOptions): Promise<PGlite> {
  const dataDir = path.resolve(options.workspaceRoot, RUNTIME_DIR);
  await mkdir(dataDir, { recursive: true });

  db = await PGlite.create({
    dataDir,
  });

  setDb(db);
  await db.exec(SCHEMA_SQL);
  await db.exec(CONVERSATIONS_SCHEMA_SQL);
  await db.exec(INTELLIGENCE_SCHEMA_SQL);
  await db.exec(CHANNELS_SCHEMA_SQL);
  await db.exec(PROACTIVITY_SCHEMA_SQL);
  await db.exec(DECISION_ENGINE_SCHEMA_SQL);
  return db;
}

/**
 * Initialize PGlite in-memory (no persistence). Use as fallback when initRuntimeDb fails
 * (e.g. WASM/runtime errors on some systems). Data is lost on restart.
 */
export async function initRuntimeDbInMemory(): Promise<PGlite> {
  db = await PGlite.create();
  setDb(db);
  await db.exec(SCHEMA_SQL);
  await db.exec(CONVERSATIONS_SCHEMA_SQL);
  await db.exec(INTELLIGENCE_SCHEMA_SQL);
  await db.exec(CHANNELS_SCHEMA_SQL);
  await db.exec(PROACTIVITY_SCHEMA_SQL);
  await db.exec(DECISION_ENGINE_SCHEMA_SQL);
  return db;
}

/**
 * Close the database (e.g. on shutdown).
 */
export async function closeRuntimeDb(): Promise<void> {
  if (db) {
    await db.close();
    clearDb();
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionRow = {
  id: string;
  chat_id: string;
  thread_id: string | null;
  channel: string;
  workspace_id: string;
  view_primary: string | null;
  view_overlays: string[];
  created_at: number;
  updated_at: number;
};

export function sessionId(chatId: string, threadId?: string): string {
  return `session:${chatId}:${threadId ?? "root"}`;
}

export async function getOrCreateSession(
  chatId: string,
  threadId?: string,
  view?: ViewStack
): Promise<SessionRow> {
  const id = sessionId(chatId, threadId);
  const now = Date.now();
  const db = getDb();

  const existing = await db.query<SessionRow>(
    "SELECT * FROM sessions WHERE id = $1",
    [id]
  );
  if (existing.rows?.length) {
    if (view) {
      await db.query(
        "UPDATE sessions SET view_primary = $1, view_overlays = $2, updated_at = $3 WHERE id = $4",
        [view.primary, JSON.stringify(view.overlays ?? []), now, id]
      );
    }
    const updated = await db.query<SessionRow>("SELECT * FROM sessions WHERE id = $1", [id]);
    return updated.rows![0];
  }

  await db.query(
    `INSERT INTO sessions (id, chat_id, thread_id, channel, workspace_id, view_primary, view_overlays, created_at, updated_at)
     VALUES ($1, $2, $3, 'local', 'ws_local', $4, $5, $6, $6)`,
    [id, chatId, threadId ?? null, view?.primary ?? null, JSON.stringify(view?.overlays ?? []), now]
  );
  const created = await db.query<SessionRow>("SELECT * FROM sessions WHERE id = $1", [id]);
  return created.rows![0];
}

export async function getSession(sessionIdKey: string): Promise<SessionRow | null> {
  const res = await getDb().query<SessionRow>("SELECT * FROM sessions WHERE id = $1", [sessionIdKey]);
  return res.rows?.[0] ?? null;
}

export async function listSessions(limit = 50): Promise<SessionRow[]> {
  const res = await getDb().query<SessionRow>(
    "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT $1",
    [limit]
  );
  return res.rows ?? [];
}

export async function setSessionView(
  chatId: string,
  threadId: string | undefined,
  view: ViewStack
): Promise<void> {
  const id = sessionId(chatId, threadId);
  const now = Date.now();
  await getDb().query(
    "UPDATE sessions SET view_primary = $1, view_overlays = $2, updated_at = $3 WHERE id = $4",
    [view.primary, JSON.stringify(view.overlays ?? []), now, id]
  );
}

// ---------------------------------------------------------------------------
// Messages (chat transcript)
// ---------------------------------------------------------------------------

export type MessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  tool_results: Record<string, unknown>[] | null;
  created_at: number;
  conversation_id?: string | null;
};

export async function appendMessage(
  sessionIdKey: string,
  role: "user" | "assistant",
  content: string,
  toolResults?: Array<{ toolName: string; ok: boolean; error?: string; data?: unknown }>
): Promise<void> {
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO messages (id, session_id, role, content, tool_results, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, sessionIdKey, role, content, toolResults ? JSON.stringify(toolResults) : null, now]
  );
}

export async function getSessionMessages(
  sessionIdKey: string,
  limit = 50
): Promise<MessageRow[]> {
  const res = await getDb().query<MessageRow>(
    "SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2",
    [sessionIdKey, limit]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    ...r,
    tool_results: r.tool_results as Record<string, unknown>[] | null,
  }));
}

/** Replace session messages (e.g. when client sends full history on reconnect). */
export async function replaceSessionMessages(
  sessionIdKey: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  conversationId?: string | null
): Promise<void> {
  const db = getDb();
  await db.query("DELETE FROM messages WHERE session_id = $1", [sessionIdKey]);
  const now = Date.now();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const id = `msg_${now}_${i}_${Math.random().toString(36).slice(2, 9)}`;
    await db.query(
      "INSERT INTO messages (id, session_id, conversation_id, role, content, tool_results, created_at) VALUES ($1, $2, $3, $4, $5, NULL, $6)",
      [id, sessionIdKey, conversationId ?? null, m.role, m.content, now + i]
    );
  }
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export type ConversationType = "session" | "project" | "channel" | "agent";

export type ConversationRow = {
  id: string;
  type: ConversationType;
  title: string;
  project_slug: string | null;
  channel_slug: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  workspace_id: string;
  chat_id: string | null;
  thread_id: string | null;
  created_at: number;
  updated_at: number;
};

type ConversationRawRow = {
  id: string;
  type: string;
  title: string;
  project_slug: string | null;
  channel_slug: string | null;
  metadata: string | Record<string, unknown>;
  tags: string | string[];
  workspace_id: string;
  chat_id: string | null;
  thread_id: string | null;
  created_at: number;
  updated_at: number;
};

function conversationFromRow(r: ConversationRawRow): ConversationRow {
  return {
    id: r.id,
    type: r.type as ConversationType,
    title: r.title,
    project_slug: r.project_slug,
    channel_slug: r.channel_slug,
    metadata: typeof r.metadata === "string" ? (JSON.parse(r.metadata || "{}") as Record<string, unknown>) : (r.metadata ?? {}),
    tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === "string" ? (JSON.parse(r.tags || "[]") as string[]) : []),
    workspace_id: r.workspace_id,
    chat_id: r.chat_id,
    thread_id: r.thread_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function createConversation(params: {
  type: ConversationType;
  title?: string;
  project_slug?: string;
  channel_slug?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  workspace_id?: string;
  chat_id?: string;
  thread_id?: string;
}): Promise<ConversationRow> {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const now = Date.now();
  const db = getDb();
  await db.query(
    `INSERT INTO conversations (id, type, title, project_slug, channel_slug, metadata, tags, workspace_id, chat_id, thread_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
    [
      id,
      params.type,
      params.title ?? "",
      params.project_slug ?? null,
      params.channel_slug ?? null,
      JSON.stringify(params.metadata ?? {}),
      JSON.stringify(params.tags ?? []),
      params.workspace_id ?? "ws_local",
      params.chat_id ?? null,
      params.thread_id ?? null,
      now,
    ]
  );
  const res = await db.query("SELECT * FROM conversations WHERE id = $1", [id]);
  return conversationFromRow(res.rows![0] as ConversationRawRow);
}

export type ListConversationsFilter = {
  type?: ConversationType;
  project_slug?: string;
  channel_slug?: string;
  limit?: number;
  offset?: number;
};

export async function listConversations(filter: ListConversationsFilter = {}): Promise<ConversationRow[]> {
  const db = getDb();
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  const conditions: string[] = ["1=1"];
  const params: unknown[] = [];
  let i = 1;
  if (filter.type) {
    conditions.push(`type = $${i++}`);
    params.push(filter.type);
  }
  if (filter.project_slug) {
    conditions.push(`project_slug = $${i++}`);
    params.push(filter.project_slug);
  }
  if (filter.channel_slug) {
    conditions.push(`channel_slug = $${i++}`);
    params.push(filter.channel_slug);
  }
  params.push(limit, offset);
  const res = await db.query(
    `SELECT * FROM conversations WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  const rows = res.rows ?? [];
  return rows.map((r) => conversationFromRow(r as ConversationRawRow));
}

export async function getConversation(id: string): Promise<ConversationRow | null> {
  const res = await getDb().query("SELECT * FROM conversations WHERE id = $1", [id]);
  const row = res.rows?.[0] as ConversationRawRow | undefined;
  if (!row) return null;
  return conversationFromRow(row);
}

/** Find a conversation by linked chat_id and thread_id (for session-type). */
export async function getConversationByChatAndThread(chatId: string, threadId?: string): Promise<ConversationRow | null> {
  const canonical = threadId ?? "root";
  const res = await getDb().query(
    "SELECT * FROM conversations WHERE chat_id = $1 AND COALESCE(thread_id, 'root') = $2",
    [chatId, canonical]
  );
  const row = res.rows?.[0] as ConversationRawRow | undefined;
  if (!row) return null;
  return conversationFromRow(row);
}

/** Resolve conversation to session id (for session-type conversations with chat_id/thread_id). */
export function conversationToSessionId(conv: ConversationRow): string | null {
  if (conv.chat_id) return sessionId(conv.chat_id, conv.thread_id ?? undefined);
  return null;
}

/** Append a message to a conversation. Creates/links session for session-type; writes message with conversation_id. */
export async function addConversationMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolResults?: Array<{ toolName: string; ok: boolean; error?: string; data?: unknown }>
): Promise<MessageRow> {
  const conv = await getConversation(conversationId);
  if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
  const db = getDb();
  let sessionIdKey = conversationToSessionId(conv);
  if (!sessionIdKey) {
    const chatId = `chat_${conversationId}`;
    await getOrCreateSession(chatId, conv.thread_id ?? undefined);
    await db.query("UPDATE conversations SET chat_id = $1, updated_at = $2 WHERE id = $3", [
      chatId,
      Date.now(),
      conversationId,
    ]);
    sessionIdKey = sessionId(chatId, conv.thread_id ?? undefined);
  }
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await db.query(
    `INSERT INTO messages (id, session_id, conversation_id, role, content, tool_results, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [msgId, sessionIdKey, conversationId, role, content, toolResults ? JSON.stringify(toolResults) : null, now]
  );
  await db.query("UPDATE conversations SET updated_at = $1 WHERE id = $2", [now, conversationId]);
  const msgRes = await db.query<MessageRow>("SELECT * FROM messages WHERE id = $1", [msgId]);
  const row = msgRes.rows![0];
  return { ...row, tool_results: row.tool_results as Record<string, unknown>[] | null };
}

export async function getConversationMessages(conversationId: string, limit = 100): Promise<MessageRow[]> {
  const res = await getDb().query<MessageRow & { tool_results: string | null }>(
    "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2",
    [conversationId, limit]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    ...r,
    tool_results: r.tool_results as Record<string, unknown>[] | null,
  }));
}

// ---------------------------------------------------------------------------
// Channels (conversations with type=channel)
// ---------------------------------------------------------------------------

export function channelSlugFromName(name: string): string {
  return name.toLowerCase().replace(/^#+/, "").replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "channel";
}

export async function listChannels(workspaceId = "ws_local", limit = 100): Promise<ConversationRow[]> {
  return listConversations({ type: "channel", limit, offset: 0 });
}

export async function createChannel(params: { channel_slug: string; title?: string; workspace_id?: string; metadata?: Record<string, unknown> }): Promise<ConversationRow> {
  const slug = channelSlugFromName(params.channel_slug);
  if (!slug) throw new Error("Invalid channel name");
  const title = params.title?.trim() || slug;
  return createConversation({ type: "channel", title, channel_slug: slug, workspace_id: params.workspace_id ?? "ws_local", metadata: params.metadata });
}

export type ConversationAgentRow = { id: string; conversation_id: string; agent_id: string; role: string | null; pinned: boolean };

export async function getConversationAgents(conversationId: string): Promise<ConversationAgentRow[]> {
  const res = await getDb().query(
    "SELECT id, conversation_id, agent_id, role, COALESCE(pinned, FALSE) as pinned FROM conversation_agents WHERE conversation_id = $1 ORDER BY pinned DESC, agent_id",
    [conversationId]
  );
  return (res.rows ?? []) as ConversationAgentRow[];
}

export async function addConversationAgent(conversationId: string, agentId: string, options?: { role?: string; pinned?: boolean }): Promise<void> {
  const id = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await getDb().query(
    `INSERT INTO conversation_agents (id, conversation_id, agent_id, role, pinned) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (conversation_id, agent_id) DO UPDATE SET role = EXCLUDED.role, pinned = EXCLUDED.pinned`,
    [id, conversationId, agentId, options?.role ?? null, options?.pinned ?? false]
  );
}

export async function removeConversationAgent(conversationId: string, agentId: string): Promise<void> {
  await getDb().query("DELETE FROM conversation_agents WHERE conversation_id = $1 AND agent_id = $2", [conversationId, agentId]);
}

/**
 * Get or create a conversation by destination (channel slug or project slug).
 * Used by Telegram/Slack inbound routing to resolve mapping targets to a conversation id.
 */
export async function getOrCreateConversationForDestination(params: {
  type: "channel" | "project";
  slug: string;
  workspace_id?: string;
}): Promise<ConversationRow> {
  const { type, slug, workspace_id = "ws_local" } = params;
  if (type === "channel") {
    const existing = await listConversations({ type: "channel", channel_slug: slug, limit: 1 });
    if (existing.length > 0) return existing[0];
    return createChannel({ channel_slug: slug, title: slug, workspace_id });
  }
  const existing = await listConversations({ type: "project", project_slug: slug, limit: 1 });
  if (existing.length > 0) return existing[0];
  return createConversation({ type: "project", title: slug, project_slug: slug, workspace_id });
}

// ---------------------------------------------------------------------------
// Conversation intelligence (extracted tasks, memories, preferences, insights)
// ---------------------------------------------------------------------------

export type IntelligenceSignals = {
  summary?: string;
  detected_tasks: Array<{ title: string; priority?: string; project?: string }>;
  memory_candidates: Array<{ text: string; source?: string }>;
  preferences: Array<{ key: string; value: string }>;
  project_updates: Array<{ project: string; update: string }>;
  key_insights: string[];
  style_hints: string[];
};

export type IntelligenceRow = IntelligenceSignals & {
  id: string;
  session_id: string | null;
  conversation_id: string | null;
  analyzed_at: number;
  message_count: number;
  created_at: number;
  updated_at: number;
};

function intelligenceFromRow(r: {
  id: string;
  session_id: string | null;
  conversation_id: string | null;
  summary: string | null;
  detected_tasks: string | unknown;
  memory_candidates: string | unknown;
  preferences: string | unknown;
  project_updates: string | unknown;
  key_insights: string | unknown;
  style_hints: string | unknown;
  analyzed_at: number;
  message_count: number;
  created_at: number;
  updated_at: number;
}): IntelligenceRow {
  const arr = (v: string | unknown) =>
    typeof v === "string" ? (JSON.parse(v || "[]") as unknown[]) : (Array.isArray(v) ? v : []);
  return {
    id: r.id,
    session_id: r.session_id,
    conversation_id: r.conversation_id,
    summary: r.summary ?? undefined,
    detected_tasks: arr(r.detected_tasks) as IntelligenceSignals["detected_tasks"],
    memory_candidates: arr(r.memory_candidates) as IntelligenceSignals["memory_candidates"],
    preferences: arr(r.preferences) as IntelligenceSignals["preferences"],
    project_updates: arr(r.project_updates) as IntelligenceSignals["project_updates"],
    key_insights: arr(r.key_insights) as string[],
    style_hints: arr(r.style_hints) as string[],
    analyzed_at: r.analyzed_at,
    message_count: r.message_count,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function upsertConversationIntelligence(
  key: { session_id?: string; conversation_id?: string },
  payload: IntelligenceSignals & { message_count: number }
): Promise<IntelligenceRow> {
  const db = getDb();
  const now = Date.now();
  const id = `intel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (key.session_id) {
    await db.query(
      `INSERT INTO conversation_intelligence (
        id, session_id, conversation_id, summary, detected_tasks, memory_candidates, preferences,
        project_updates, key_insights, style_hints, analyzed_at, message_count, created_at, updated_at
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $10, $10)
      ON CONFLICT (session_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        detected_tasks = EXCLUDED.detected_tasks,
        memory_candidates = EXCLUDED.memory_candidates,
        preferences = EXCLUDED.preferences,
        project_updates = EXCLUDED.project_updates,
        key_insights = EXCLUDED.key_insights,
        style_hints = EXCLUDED.style_hints,
        analyzed_at = EXCLUDED.analyzed_at,
        message_count = EXCLUDED.message_count,
        updated_at = EXCLUDED.updated_at`,
      [
        id,
        key.session_id,
        payload.summary ?? null,
        JSON.stringify(payload.detected_tasks ?? []),
        JSON.stringify(payload.memory_candidates ?? []),
        JSON.stringify(payload.preferences ?? []),
        JSON.stringify(payload.project_updates ?? []),
        JSON.stringify(payload.key_insights ?? []),
        JSON.stringify(payload.style_hints ?? []),
        now,
        payload.message_count ?? 0,
      ]
    );
    const res = await db.query("SELECT * FROM conversation_intelligence WHERE session_id = $1", [key.session_id]);
    return intelligenceFromRow(res.rows![0] as Parameters<typeof intelligenceFromRow>[0]);
  }

  if (key.conversation_id) {
    await db.query(
      `INSERT INTO conversation_intelligence (
        id, session_id, conversation_id, summary, detected_tasks, memory_candidates, preferences,
        project_updates, key_insights, style_hints, analyzed_at, message_count, created_at, updated_at
      ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $10, $10)
      ON CONFLICT (conversation_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        detected_tasks = EXCLUDED.detected_tasks,
        memory_candidates = EXCLUDED.memory_candidates,
        preferences = EXCLUDED.preferences,
        project_updates = EXCLUDED.project_updates,
        key_insights = EXCLUDED.key_insights,
        style_hints = EXCLUDED.style_hints,
        analyzed_at = EXCLUDED.analyzed_at,
        message_count = EXCLUDED.message_count,
        updated_at = EXCLUDED.updated_at`,
      [
        id,
        key.conversation_id,
        payload.summary ?? null,
        JSON.stringify(payload.detected_tasks ?? []),
        JSON.stringify(payload.memory_candidates ?? []),
        JSON.stringify(payload.preferences ?? []),
        JSON.stringify(payload.project_updates ?? []),
        JSON.stringify(payload.key_insights ?? []),
        JSON.stringify(payload.style_hints ?? []),
        now,
        payload.message_count ?? 0,
      ]
    );
    const res = await db.query("SELECT * FROM conversation_intelligence WHERE conversation_id = $1", [
      key.conversation_id,
    ]);
    return intelligenceFromRow(res.rows![0] as Parameters<typeof intelligenceFromRow>[0]);
  }

  throw new Error("Either session_id or conversation_id must be provided");
}

export async function getIntelligenceBySession(sessionIdKey: string): Promise<IntelligenceRow | null> {
  const res = await getDb().query("SELECT * FROM conversation_intelligence WHERE session_id = $1", [sessionIdKey]);
  const row = res.rows?.[0];
  if (!row) return null;
  return intelligenceFromRow(row as Parameters<typeof intelligenceFromRow>[0]);
}

export async function getIntelligenceByConversation(conversationId: string): Promise<IntelligenceRow | null> {
  const res = await getDb().query("SELECT * FROM conversation_intelligence WHERE conversation_id = $1", [
    conversationId,
  ]);
  const row = res.rows?.[0];
  if (!row) return null;
  return intelligenceFromRow(row as Parameters<typeof intelligenceFromRow>[0]);
}

// ---------------------------------------------------------------------------
// Traces
// ---------------------------------------------------------------------------

export async function insertTrace(
  item: Omit<TraceItem, "id"> & { id?: string },
  sessionIdKey?: string
): Promise<void> {
  const id = item.id ?? `tr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await getDb().query(
    `INSERT INTO traces (id, session_id, type, agent_id, summary, data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      sessionIdKey ?? null,
      item.type,
      item.agentId,
      item.summary ?? "",
      item.data ? JSON.stringify(item.data) : null,
      item.ts,
    ]
  );
}

export async function listTraces(limit: number, offset: number): Promise<TraceItem[]> {
  const res = await getDb().query<{
    id: string;
    type: string;
    agent_id: string;
    summary: string;
    data: string | null;
    created_at: number;
  }>(
    "SELECT id, type, agent_id, summary, data, created_at FROM traces ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    id: r.id,
    ts: r.created_at,
    type: r.type,
    agentId: r.agent_id,
    summary: r.summary,
    data: r.data ? (JSON.parse(r.data) as Record<string, unknown>) : undefined,
  }));
}

export async function countTraces(): Promise<number> {
  const res = await getDb().query<{ count: string }>("SELECT COUNT(*)::text as count FROM traces");
  return parseInt(res.rows?.[0]?.count ?? "0", 10);
}

export async function listTracesBySession(sessionIdKey: string, limit: number): Promise<TraceItem[]> {
  const res = await getDb().query<{
    id: string;
    type: string;
    agent_id: string;
    summary: string;
    data: string | null;
    created_at: number;
  }>(
    "SELECT id, type, agent_id, summary, data, created_at FROM traces WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sessionIdKey, limit]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    id: r.id,
    ts: r.created_at,
    type: r.type,
    agentId: r.agent_id,
    summary: r.summary,
    data: r.data ? (JSON.parse(r.data) as Record<string, unknown>) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Tool events
// ---------------------------------------------------------------------------

export async function appendToolEvent(
  sessionIdKey: string | null,
  traceId: string | null,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  ok: boolean
): Promise<void> {
  const id = `te_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO tool_events (id, session_id, trace_id, tool_name, args, result, ok, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      sessionIdKey,
      traceId,
      toolName,
      JSON.stringify(args),
      result !== undefined ? JSON.stringify(result) : null,
      ok,
      now,
    ]
  );
}

export type ToolEventRow = {
  id: string;
  tool_name: string;
  args: Record<string, unknown>;
  result: unknown;
  ok: boolean;
  created_at: number;
};

export async function listToolEventsBySession(sessionIdKey: string, limit: number): Promise<ToolEventRow[]> {
  const res = await getDb().query<{
    id: string;
    tool_name: string;
    args: string | null;
    result: string | null;
    ok: boolean;
    created_at: number;
  }>(
    "SELECT id, tool_name, args, result, ok, created_at FROM tool_events WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sessionIdKey, limit]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    id: r.id,
    tool_name: r.tool_name,
    args: r.args ? (JSON.parse(r.args) as Record<string, unknown>) : {},
    result: r.result != null ? JSON.parse(r.result) : null,
    ok: r.ok,
    created_at: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Approvals (pending) and approval_grants
// ---------------------------------------------------------------------------

export async function insertApproval(item: ApprovalItem): Promise<void> {
  await getDb().query(
    `INSERT INTO approvals (id, agent_id, tool_name, risk, args, reason, environment, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      item.id,
      item.agentId,
      item.toolName,
      item.risk,
      JSON.stringify(item.args ?? {}),
      item.reason ?? null,
      item.environment ?? "workspace",
      item.createdAt,
    ]
  );
}

export async function listPendingApprovals(): Promise<ApprovalItem[]> {
  const res = await getDb().query<{
    id: string;
    agent_id: string;
    tool_name: string;
    risk: string;
    args: string;
    reason: string | null;
    environment: string;
    created_at: number;
  }>("SELECT * FROM approvals ORDER BY created_at DESC");
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    agentId: r.agent_id,
    toolName: r.tool_name,
    risk: r.risk as ApprovalItem["risk"],
    args: JSON.parse(r.args) as Record<string, unknown>,
    reason: r.reason ?? undefined,
    environment: r.environment as ApprovalItem["environment"],
  }));
}

export async function deleteApproval(requestId: string): Promise<void> {
  await getDb().query("DELETE FROM approvals WHERE id = $1", [requestId]);
}

export type GrantRow = {
  scope_type: string;
  scope_key: string;
  expires_at: number | null;
  note: string | null;
};

export async function insertApprovalGrant(
  scopeType: string,
  scopeKey: string,
  expiresAt?: number,
  note?: string
): Promise<void> {
  const id = `gr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO approval_grants (id, scope_type, scope_key, expires_at, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (scope_type, scope_key) DO UPDATE SET expires_at = $4, note = $5`,
    [id, scopeType, scopeKey, expiresAt ?? null, note ?? null, now]
  );
}

export async function listApprovalGrants(): Promise<GrantRow[]> {
  const res = await getDb().query<GrantRow>(
    "SELECT scope_type, scope_key, expires_at, note FROM approval_grants"
  );
  return res.rows ?? [];
}

export async function deleteApprovalGrant(scopeType: string, scopeKey: string): Promise<void> {
  await getDb().query(
    "DELETE FROM approval_grants WHERE scope_type = $1 AND scope_key = $2",
    [scopeType, scopeKey]
  );
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export async function createWorkflowRun(
  definition: WorkflowDefinition,
  context: { agentId: string; channel: string; chatId: string; threadId?: string }
): Promise<WorkflowRun> {
  const id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const db = getDb();

  await db.query(
    `INSERT INTO workflow_runs (id, name, status, agent_id, channel, chat_id, thread_id, created_at, updated_at)
     VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $7)`,
    [
      id,
      definition.name,
      context.agentId,
      context.channel,
      context.chatId,
      context.threadId ?? null,
      now,
    ]
  );

  for (const s of definition.steps) {
    const rowId = `wstep_${id}_${s.id}`;
    await db.query(
      `INSERT INTO workflow_steps (id, run_id, step_id, name, status, tool, args, requires_approval, started_at, completed_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NULL, NULL)`,
      [
        rowId,
        id,
        s.id,
        s.name,
        s.tool ?? null,
        s.args ? JSON.stringify(s.args) : null,
        s.requiresApproval ?? false,
      ]
    );
  }

  return getWorkflowRunById(id) as Promise<WorkflowRun>;
}

async function workflowRunFromRows(
  runRow: {
    id: string;
    name: string;
    status: string;
    agent_id: string;
    channel: string;
    chat_id: string;
    thread_id: string | null;
    created_at: number;
    updated_at: number;
  },
  steps: Array<{
    step_id: string;
    name: string;
    status: string;
    tool: string | null;
    args: string | null;
    result: string | null;
    error: string | null;
    requires_approval: boolean;
    started_at: number | null;
    completed_at: number | null;
  }>
): Promise<WorkflowRun> {
  return {
    id: runRow.id,
    name: runRow.name,
    status: runRow.status as WorkflowRun["status"],
    agentId: runRow.agent_id,
    channel: runRow.channel as Channel,
    chatId: runRow.chat_id,
    threadId: runRow.thread_id ?? undefined,
    createdAt: runRow.created_at,
    updatedAt: runRow.updated_at,
    steps: steps.map((st) => ({
      id: st.step_id,
      name: st.name,
      status: st.status as WorkflowRun["steps"][0]["status"],
      tool: st.tool ?? undefined,
      args: st.args ? (JSON.parse(st.args) as Record<string, unknown>) : undefined,
      result: st.result ? (JSON.parse(st.result) as unknown) : undefined,
      error: st.error ?? undefined,
      requiresApproval: st.requires_approval,
      startedAt: st.started_at ?? undefined,
      completedAt: st.completed_at ?? undefined,
    })),
  };
}

export async function getWorkflowRunById(id: string): Promise<WorkflowRun | undefined> {
  const db = getDb();
  const runRes = await db.query<{
    id: string;
    name: string;
    status: string;
    agent_id: string;
    channel: string;
    chat_id: string;
    thread_id: string | null;
    created_at: number;
    updated_at: number;
  }>("SELECT * FROM workflow_runs WHERE id = $1", [id]);
  const run = runRes.rows?.[0];
  if (!run) return undefined;

  const stepsRes = await db.query<{
    step_id: string;
    name: string;
    status: string;
    tool: string | null;
    args: string | null;
    result: string | null;
    error: string | null;
    requires_approval: boolean;
    started_at: number | null;
    completed_at: number | null;
  }>("SELECT step_id, name, status, tool, args, result, error, requires_approval, started_at, completed_at FROM workflow_steps WHERE run_id = $1 ORDER BY step_id", [id]);
  const steps = stepsRes.rows ?? [];
  return workflowRunFromRows(run, steps);
}

export async function listWorkflowRuns(): Promise<WorkflowRun[]> {
  const db = getDb();
  const runRes = await db.query<{
    id: string;
    name: string;
    status: string;
    agent_id: string;
    channel: string;
    chat_id: string;
    thread_id: string | null;
    created_at: number;
    updated_at: number;
  }>("SELECT * FROM workflow_runs ORDER BY updated_at DESC");
  const runs = runRes.rows ?? [];
  const result: WorkflowRun[] = [];
  for (const run of runs) {
    const stepsRes = await db.query<{
      step_id: string;
      name: string;
      status: string;
      tool: string | null;
      args: string | null;
      result: string | null;
      error: string | null;
      requires_approval: boolean;
      started_at: number | null;
      completed_at: number | null;
    }>("SELECT step_id, name, status, tool, args, result, error, requires_approval, started_at, completed_at FROM workflow_steps WHERE run_id = $1 ORDER BY step_id", [run.id]);
    result.push(await workflowRunFromRows(run, stepsRes.rows ?? []));
  }
  return result;
}

export async function listWorkflowRunsByChat(chatId: string, threadId?: string): Promise<WorkflowRun[]> {
  const all = await listWorkflowRuns();
  const canonical = threadId ?? "root";
  return all.filter(
    (r) => r.chatId === chatId && (r.threadId ?? "root") === canonical
  );
}

export async function advanceWorkflowStep(
  runId: string,
  stepId: string,
  update: { status: WorkflowStatus; result?: unknown; error?: string }
): Promise<WorkflowRun | undefined> {
  const now = Date.now();
  const db = getDb();

  const stepRow = await db.query<{ id: string; started_at: number | null }>(
    "SELECT id, started_at FROM workflow_steps WHERE run_id = $1 AND step_id = $2",
    [runId, stepId]
  );
  const step = stepRow.rows?.[0];
  if (!step) return undefined;

  let startedAt: number | null = step.started_at;
  let completedAt: number | null = null;
  if (update.status === "running" && !startedAt) {
    startedAt = now;
    await db.query(
      "UPDATE workflow_steps SET status = $1, started_at = $2 WHERE run_id = $3 AND step_id = $4",
      [update.status, startedAt, runId, stepId]
    );
  } else {
    if (update.status === "completed" || update.status === "failed") {
      completedAt = now;
    }
    await db.query(
      "UPDATE workflow_steps SET status = $1, result = $2, error = $3, completed_at = $4 WHERE run_id = $5 AND step_id = $6",
      [
        update.status,
        update.result !== undefined ? JSON.stringify(update.result) : null,
        update.error ?? null,
        completedAt,
        runId,
        stepId,
      ]
    );
  }

  const run = await getWorkflowRunById(runId);
  if (!run) return undefined;

  const statuses = run.steps.map((s) => s.status);
  let newStatus: WorkflowStatus = run.status;
  if (statuses.every((s) => s === "completed")) newStatus = "completed";
  else if (statuses.some((s) => s === "failed")) newStatus = "failed";
  else if (statuses.some((s) => s === "waiting-approval")) newStatus = "waiting-approval";
  else if (statuses.some((s) => s === "running")) newStatus = "running";
  else if (run.status !== "paused" && run.status !== "cancelled") newStatus = "pending";

  await db.query("UPDATE workflow_runs SET status = $1, updated_at = $2 WHERE id = $3", [
    newStatus,
    now,
    runId,
  ]);

  return getWorkflowRunById(runId);
}

export async function pauseWorkflowRun(runId: string): Promise<WorkflowRun | undefined> {
  const run = await getWorkflowRunById(runId);
  if (!run || run.status === "completed" || run.status === "failed") return undefined;
  const now = Date.now();
  await getDb().query("UPDATE workflow_runs SET status = 'paused', updated_at = $1 WHERE id = $2", [
    now,
    runId,
  ]);
  return getWorkflowRunById(runId);
}

export async function resumeWorkflowRun(runId: string): Promise<WorkflowRun | undefined> {
  const run = await getWorkflowRunById(runId);
  if (!run || run.status !== "paused") return undefined;
  const now = Date.now();
  await getDb().query("UPDATE workflow_runs SET status = 'running', updated_at = $1 WHERE id = $2", [
    now,
    runId,
  ]);
  return getWorkflowRunById(runId);
}

export async function cancelWorkflowRun(runId: string): Promise<WorkflowRun | undefined> {
  const run = await getWorkflowRunById(runId);
  if (!run || run.status === "completed") return undefined;
  const now = Date.now();
  await getDb().query("UPDATE workflow_runs SET status = 'cancelled', updated_at = $1 WHERE id = $2", [
    now,
    runId,
  ]);
  return getWorkflowRunById(runId);
}

export async function resetWorkflows(): Promise<void> {
  const db = getDb();
  await db.query("DELETE FROM workflow_steps");
  await db.query("DELETE FROM workflow_runs");
}

/** Clear traces, approvals, approval_grants, and workflows (for reset state). */
export async function resetRuntimeState(): Promise<void> {
  const db = getDb();
  await db.query("DELETE FROM traces");
  await db.query("DELETE FROM tool_events");
  await db.query("DELETE FROM approvals");
  await db.query("DELETE FROM approval_grants");
  await db.query("DELETE FROM workflow_steps");
  await db.query("DELETE FROM workflow_runs");
}

// ---------------------------------------------------------------------------
// Memory items
// ---------------------------------------------------------------------------

export type MemoryItemRow = {
  id: string;
  entry_id: string;
  text: string;
  source: string | null;
  tags: string[];
  promoted: boolean;
  created_at: number;
  promoted_at: number | null;
};

export async function insertMemoryItem(
  entryId: string,
  text: string,
  source?: string,
  tags?: string[]
): Promise<void> {
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO memory_items (id, entry_id, text, source, tags, promoted, created_at, promoted_at)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6, NULL)`,
    [id, entryId, text, source ?? null, tags ? JSON.stringify(tags) : "[]", now]
  );
}

export async function promoteMemoryItem(entryId: string): Promise<boolean> {
  const now = Date.now();
  const res = await getDb().query(
    "UPDATE memory_items SET promoted = TRUE, promoted_at = $1 WHERE entry_id = $2",
    [now, entryId]
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function listMemoryItems(limit = 600): Promise<MemoryItemRow[]> {
  const res = await getDb().query<MemoryItemRow & { tags: string }>(
    "SELECT * FROM memory_items ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => ({
    ...r,
    tags: typeof r.tags === "string" ? (JSON.parse(r.tags) as string[]) : r.tags,
  }));
}

// ---------------------------------------------------------------------------
// Task events
// ---------------------------------------------------------------------------

export async function appendTaskEvent(
  event: Record<string, unknown>,
  sessionIdKey?: string
): Promise<void> {
  const id = `te_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  await getDb().query(
    `INSERT INTO task_events (id, session_id, event, created_at) VALUES ($1, $2, $3, $4)`,
    [id, sessionIdKey ?? null, JSON.stringify(event), now]
  );
}

export async function listTaskEvents(limit: number, offset: number): Promise<Record<string, unknown>[]> {
  const res = await getDb().query<{ event: string }>(
    "SELECT event FROM task_events ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => JSON.parse(r.event) as Record<string, unknown>);
}

export async function listTaskEventsBySession(
  sessionIdKey: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const res = await getDb().query<{ event: string }>(
    "SELECT event FROM task_events WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sessionIdKey, limit]
  );
  const rows = res.rows ?? [];
  return rows.map((r) => JSON.parse(r.event) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Session Live State (unified aggregator for agent process visibility)
// ---------------------------------------------------------------------------

const LIVE_STATE_RECENT_TOOLS = 10;
const LIVE_STATE_TRACES = 5;
const LIVE_STATE_TASK_EVENTS = 20;
const FS_TOOLS = new Set(["fs.read", "fs.write", "fs.append"]);

export async function getSessionLiveState(chatId: string, threadId?: string): Promise<SessionLiveState> {
  const sessionIdKey = sessionId(chatId, threadId);

  const [intelligence, traces, toolEvents, approvals, workflows, taskEvents] = await Promise.all([
    getIntelligenceBySession(sessionIdKey),
    listTracesBySession(sessionIdKey, LIVE_STATE_TRACES),
    listToolEventsBySession(sessionIdKey, LIVE_STATE_RECENT_TOOLS),
    listPendingApprovals(),
    listWorkflowRunsByChat(chatId, threadId),
    listTaskEventsBySession(sessionIdKey, LIVE_STATE_TASK_EVENTS),
  ]);

  const filesTouchedSet = new Set<string>();
  for (const te of toolEvents) {
    if (FS_TOOLS.has(te.tool_name) && te.args && typeof te.args.path === "string") {
      filesTouchedSet.add(te.args.path);
    }
  }

  const activeWorkflows = workflows
    .filter((w) => w.status === "running" || w.status === "pending" || w.status === "waiting-approval")
    .map((w) => ({ id: w.id, name: w.name, status: w.status }));

  const artifacts: Array<{ type: string; summary: string }> = [];
  for (const t of traces) {
    if (t.type === "draft-create" && t.data?.draftPath) {
      artifacts.push({ type: "draft", summary: String(t.data.draftPath) });
    } else if (t.type === "task-create" && t.summary) {
      artifacts.push({ type: "task", summary: t.summary });
    }
  }

  const proposedNextActions: string[] = [];
  if (intelligence?.key_insights?.length) {
    proposedNextActions.push(...intelligence.key_insights.slice(0, 3));
  }
  for (const ev of taskEvents) {
    const e = ev as { event?: string; task?: { title?: string } };
    if (e.event === "task.created" && e.task?.title) {
      proposedNextActions.push(`Task: ${e.task.title}`);
    }
  }

  let currentGoal: string | undefined = intelligence?.summary?.trim();
  let activeSubtask: string | undefined;
  const lastChatTrace = traces.find((t) => t.type === "chat");
  if (lastChatTrace?.summary) {
    activeSubtask = lastChatTrace.summary.slice(0, 120);
    if (lastChatTrace.summary.length > 120) activeSubtask += "…";
  }
  if (!currentGoal && lastChatTrace?.summary) currentGoal = lastChatTrace.summary.slice(0, 80) + "…";

  return {
    sessionId: sessionIdKey,
    currentGoal: currentGoal || undefined,
    activeSubtask: activeSubtask || undefined,
    recentTools: toolEvents.map((te) => ({
      toolName: te.tool_name,
      ok: te.ok,
      summary: te.result != null ? String(te.result).slice(0, 60) : undefined,
      ts: te.created_at,
    })),
    pendingApprovals: approvals,
    activeWorkflows,
    filesTouched: [...filesTouchedSet].slice(0, 15),
    extractedTasks: intelligence?.detected_tasks ?? [],
    memoryCandidates: intelligence?.memory_candidates ?? [],
    artifacts: artifacts.slice(0, 10),
    proposedNextActions: [...new Set(proposedNextActions)].slice(0, 5),
  };
}

// Proactivity Engine — re-export from proactivity.ts (uses db-internal to avoid circular deps)
export {
  listScheduledJobs,
  listDueScheduledJobs,
  createScheduledJob,
  getScheduledJob,
  pauseScheduledJob,
  resumeScheduledJob,
  updateScheduledJobLastRun,
  createJobExecution,
  updateJobExecution,
  listJobExecutions,
  listProactiveNotifications,
  createProactiveNotification,
  markProactiveNotificationRead,
  listModelPolicies,
  getModelPolicyForJobType,
  seedModelPolicies,
  seedBuiltInProactiveJobs,
} from "./proactivity.js";
export type { ScheduledJobRow, JobExecutionRow, ProactiveNotificationRow, ModelPolicyRow } from "./proactivity.js";
export {
  insertTriggerEvent,
  getTriggerEvent,
  listTriggerEvents,
  insertAttentionCandidate,
  insertAttentionDecision,
  updateAttentionDecisionNotificationAndWorkItem,
  listAttentionDecisions,
  getRecentDecisionByDedupeKey,
  createWorkItem,
  listWorkItems,
  getAttentionBudgetConfig,
  countProactiveNotificationsToday,
  isQuietHours,
} from "./decision-engine.js";
