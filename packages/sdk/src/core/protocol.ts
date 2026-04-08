import { z } from "zod";

// ── v3 WS Protocol Schemas ──

/** RPC request envelope */
export const RpcRequestSchema = z.object({
  type: z.literal("req"),
  id: z.string().uuid(),
  method: z.string(),
  params: z.record(z.unknown()),
});

/** RPC response envelope */
export const RpcResponseSchema = z.object({
  type: z.literal("res"),
  id: z.string(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});

/** Event envelope */
export const GatewayEventSchema = z.object({
  type: z.literal("event"),
  event: z.string(),
  payload: z.unknown(),
});

/** Any gateway message */
export const GatewayMessageSchema = z.discriminatedUnion("type", [
  RpcResponseSchema,
  GatewayEventSchema,
]);

// ── Known Methods ──

export const METHODS = {
  // Connection
  CONNECT: "connect",

  // Chat
  CHAT_SEND: "chat.send",
  CHAT_HISTORY: "chat.history",

  // Cron
  CRON_LIST: "cron.list",
  CRON_CREATE: "cron.create",
  CRON_UPDATE: "cron.update",
  CRON_DELETE: "cron.delete",

  // Channels
  CHANNELS_STATUS: "channels.status",

  // Sessions
  SESSIONS_LIST: "sessions.list",

  // Config
  CONFIG_GET: "config.get",
  CONFIG_SET: "config.set",
  CONFIG_SCHEMA: "config.schema",

  // Agents
  AGENTS_LIST: "agents.list",

  // Presence
  SYSTEM_PRESENCE: "system-presence",

  // Tools
  TOOLS_LIST: "tools.list",

  // Skills
  SKILLS_LIST: "skills.list",
  SKILLS_ENABLE: "skills.enable",
  SKILLS_DISABLE: "skills.disable",

  // Exec
  EXEC_APPROVE: "exec.approve",
  EXEC_DENY: "exec.deny",

  // ACP
  ACP_SPAWN: "acp.spawn",
  ACP_STEER: "acp.steer",
  ACP_CANCEL: "acp.cancel",
} as const;

// ── Known Events ──

export const EVENTS = {
  CONNECT_CHALLENGE: "connect.challenge",
  CHAT_MESSAGE: "chat.message",
  CHAT_STREAM_DELTA: "chat.stream.delta",
  CHAT_STREAM_END: "chat.stream.end",
  EXEC_APPROVAL_REQUEST: "exec.approval.request",
  CRON_RUN_START: "cron.run.start",
  CRON_RUN_END: "cron.run.end",
  SESSION_CREATED: "session.created",
  SESSION_ENDED: "session.ended",
  SYSTEM_PRESENCE: "system-presence",
  AGENT: "agent",
} as const;

// ── Connect Method Params ──

export const ConnectParamsSchema = z.object({
  minProtocol: z.number(),
  maxProtocol: z.number(),
  client: z.object({
    id: z.string(),
    version: z.string(),
    platform: z.string(),
    mode: z.enum(["operator", "viewer"]),
  }),
  role: z.enum(["operator", "viewer"]),
  scopes: z.array(z.string()),
  caps: z.array(z.string()),
  userAgent: z.string(),
  locale: z.string(),
});

// ── Chat Method Params ──

export const ChatSendParamsSchema = z.object({
  sessionKey: z.string(),
  message: z.string(),
  deliver: z.boolean().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const ChatHistoryParamsSchema = z.object({
  sessionKey: z.string(),
  limit: z.number().optional(),
});

// ── Cron Method Params ──

export const CronCreateParamsSchema = z.object({
  name: z.string(),
  schedule: z.string(),
  command: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const CronUpdateParamsSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  schedule: z.string().optional(),
  command: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const CronDeleteParamsSchema = z.object({
  id: z.string(),
});

// ── Config Method Params ──

export const ConfigGetParamsSchema = z.object({
  key: z.string(),
});

export const ConfigSetParamsSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  baseHash: z.string(),
});

// ── Skills Method Params ──

export const SkillsToggleParamsSchema = z.object({
  id: z.string(),
});

// ── Exec Method Params ──

export const ExecApproveParamsSchema = z.object({
  id: z.string(),
});

export const ExecDenyParamsSchema = z.object({
  id: z.string(),
  reason: z.string().optional(),
});

// ── ACP Method Params ──

export const AcpSpawnParamsSchema = z.object({
  prompt: z.string(),
  sessionKey: z.string().optional(),
});

export const AcpSteerParamsSchema = z.object({
  sessionId: z.string(),
  instruction: z.string(),
});

export const AcpCancelParamsSchema = z.object({
  sessionId: z.string(),
});

// Protocol version
export const PROTOCOL_VERSION = 3;
