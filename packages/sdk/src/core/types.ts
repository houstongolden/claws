/** Connection state of the gateway client */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "challenged"
  | "connected"
  | "reconnecting"
  | "needs_pairing";

/** Client identity sent during connect handshake */
export interface ClientInfo {
  id: string;
  version: string;
  platform: string;
  mode: "operator" | "viewer";
}

/** Gateway client configuration */
export interface GatewayConfig {
  /** WebSocket URL (e.g. ws://localhost:18789) */
  url: string;
  /** Client identity */
  client: ClientInfo;
  /** Role for the connection */
  role?: "operator" | "viewer";
  /** Scopes requested */
  scopes?: string[];
  /** Capabilities advertised */
  caps?: string[];
  /** Max reconnect attempts (0 = unlimited) */
  maxReconnectAttempts?: number;
  /** Called when device pairing is required */
  onPairingRequired?: () => void;
  /** Called when pairing is complete */
  onPairingComplete?: () => void;
}

/** RPC request envelope */
export interface RpcRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

/** RPC response envelope */
export interface RpcResponse {
  type: "res";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

/** Event envelope */
export interface GatewayEvent {
  type: "event";
  event: string;
  payload: unknown;
}

/** Any message from the gateway */
export type GatewayMessage = RpcResponse | GatewayEvent;

/** Chat message role */
export type ChatRole = "user" | "assistant" | "system" | "tool";

/** A chat message */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ToolCallCard[];
  timestamp?: number;
}

/** Tool call rendered in chat */
export interface ToolCallCard {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "running" | "completed" | "failed";
}

/** Streaming chat delta */
export interface ChatStreamDelta {
  sessionKey: string;
  delta: string;
  messageId: string;
}

/** Chat stream end signal */
export interface ChatStreamEnd {
  sessionKey: string;
  messageId: string;
  message: ChatMessage;
}

/** Cron job definition */
export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  command?: string;
}

/** Cron run event */
export interface CronRunEvent {
  cronId: string;
  status: "start" | "end";
  timestamp: number;
  result?: unknown;
  error?: string;
}

/** Channel status */
export interface ChannelStatus {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  lastActivity?: number;
}

/** Exec approval request */
export interface ExecApprovalRequest {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  reason?: string;
  timestamp: number;
}

/** Connected node/device */
export interface NodeInfo {
  id: string;
  name: string;
  platform: string;
  capabilities: string[];
  connectedAt: number;
  status: "online" | "idle" | "offline";
}

/** Session info */
export interface SessionInfo {
  key: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
}

/** Tool definition from tools.list */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  provenance: "core" | `plugin:${string}`;
}

/** Skill definition */
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version?: string;
}

/** Config value with hash for safe updates */
export interface ConfigValue {
  key: string;
  value: unknown;
  baseHash: string;
}

/** Config schema for form generation */
export interface ConfigSchema {
  key: string;
  type: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

/** Presence info */
export interface PresenceInfo {
  agentOnline: boolean;
  connectedDevices: number;
  lastSeen?: number;
}

/** ACP session state */
export type AcpSessionState =
  | "idle"
  | "spawning"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "error";

/** ACP session info */
export interface AcpSession {
  id: string;
  state: AcpSessionState;
  startedAt: number;
  prompt?: string;
  output?: string;
  error?: string;
}

/** Events emitted by the gateway client */
export interface GatewayClientEvents extends Record<string, unknown> {
  "status:change": ConnectionStatus;
  "message:raw": GatewayMessage;
  "event:chat": unknown;
  "event:chat.stream.delta": ChatStreamDelta;
  "event:chat.stream.end": ChatStreamEnd;
  "event:agent": unknown;
  "event:exec.approval.request": ExecApprovalRequest;
  "event:cron.run.start": CronRunEvent;
  "event:cron.run.end": CronRunEvent;
  "event:session.created": SessionInfo;
  "event:session.ended": { key: string };
  "event:system-presence": PresenceInfo;
  error: Error;
}
