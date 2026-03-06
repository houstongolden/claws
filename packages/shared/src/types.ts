export type UUID = string;

export type Channel = "local" | "cli" | "telegram" | "slack" | "imessage";

export type Mode =
  | "founder"
  | "agency"
  | "developer"
  | "creator"
  | "personal"
  | "fitness";

export type VisibilityMode = "quiet" | "compact" | "verbose" | "live";
export type ApprovalMode = "off" | "smart" | "strict";
export type ToolRisk = "low" | "medium" | "high";
export type ToolEnvironment = "workspace" | "api" | "browser" | "sandbox" | "computer";

export type BrowserExecutionMode =
  | "background"
  | "record-on-complete"
  | "watch-live"
  | "hybrid";

export type ComputerUseProvider = "agent-browser" | "playwright" | "native";

export interface MessageEvent {
  id: UUID;
  channel: Channel;
  timestamp: number;
  text?: string;
  from: {
    userId: string;
    displayName?: string;
    isMe?: boolean;
  };
  chat: {
    chatId: string;
    threadId?: string;
  };
  meta?: Record<string, unknown>;
}

export interface SessionKey {
  workspaceId: string;
  agentId: string;
  channel: Channel;
  chatId: string;
  threadId?: string;
}

export interface ViewStack {
  primary: Mode;
  overlays: Mode[];
}

export interface RouterDecision {
  sessionKey: SessionKey;
  viewStack: ViewStack;
  leadAgentId: string;
}

export interface Router {
  route(event: MessageEvent): Promise<RouterDecision>;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  risk: ToolRisk;
  environment: ToolEnvironment;
}

export interface ToolResult {
  toolName: string;
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface WorkOrder {
  id: UUID;
  objective: string;
  constraints: string[];
  allowedTools: string[];
  outputTarget?: string;
  budget?: {
    maxSteps?: number;
    maxToolCalls?: number;
  };
}

export interface ApprovalItem {
  id: UUID;
  createdAt: number;
  agentId: string;
  toolName: string;
  environment: ToolEnvironment;
  risk: ToolRisk;
  args: Record<string, unknown>;
  reason?: string;
}

export interface TraceItem {
  id: UUID;
  ts: number;
  type: string;
  agentId: string;
  summary: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session Live State (unified agent process visibility)
// ---------------------------------------------------------------------------

export interface SessionLiveState {
  sessionId: string;
  currentGoal?: string;
  activeSubtask?: string;
  recentTools: Array<{ toolName: string; ok: boolean; summary?: string; ts: number }>;
  pendingApprovals: Array<ApprovalItem>;
  activeWorkflows: Array<{ id: string; name: string; status: string }>;
  filesTouched: string[];
  extractedTasks: Array<{ title: string; priority?: string; project?: string }>;
  memoryCandidates: Array<{ text: string; source?: string }>;
  artifacts: Array<{ type: string; summary: string }>;
  proposedNextActions: string[];
}

export interface AgentDefinition {
  id: string;
  description: string;
  modes: Mode[];
}

// ---------------------------------------------------------------------------
// Browser / Computer-Use types
// ---------------------------------------------------------------------------

export interface BrowserTaskConfig {
  url: string;
  mode: BrowserExecutionMode;
  provider: ComputerUseProvider;
  timeout?: number;
  recordDemo?: boolean;
}

export interface BrowserTaskResult {
  ok: boolean;
  url: string;
  mode: BrowserExecutionMode;
  provider: ComputerUseProvider;
  screenshot?: string;
  demoPath?: string;
  data?: unknown;
  error?: string;
  /** Set when CLAWS_BROWSER_PROVIDER=agent-browser but execution used Playwright. */
  fallbackUsed?: boolean;
  /** Provider that was requested (env) before any fallback. */
  requestedProvider?: ComputerUseProvider;
}

// ---------------------------------------------------------------------------
// Execution Substrate Status
// ---------------------------------------------------------------------------

export type ExecutionRouterOrder = ToolEnvironment[];

export interface BrowserSubstrateStatus {
  provider: ComputerUseProvider;
  defaultMode: BrowserExecutionMode;
  availableProviders: ComputerUseProvider[];
  availableModes: BrowserExecutionMode[];
  /** True when CLAWS_BROWSER_PROVIDER=agent-browser (fallback to Playwright if unavailable). */
  preferredAgentBrowser?: boolean;
}

export interface SandboxSubstrateStatus {
  enabled: boolean;
  provider: "vercel" | "local" | "none";
}

export interface ComputerSubstrateStatus {
  available: boolean;
  note: string;
}

export interface ExecutionSubstrateStatus {
  browser: BrowserSubstrateStatus;
  sandbox: SandboxSubstrateStatus;
  computer: ComputerSubstrateStatus;
  routerOrder: ExecutionRouterOrder;
}

// ---------------------------------------------------------------------------
// Workflow / Durable Execution types
// ---------------------------------------------------------------------------

export type WorkflowStatus =
  | "pending"
  | "running"
  | "paused"
  | "waiting-approval"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStatus;
  tool?: string;
  args?: Record<string, unknown>;
  requiresApproval?: boolean;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface WorkflowRun {
  id: UUID;
  name: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  agentId: string;
  channel: Channel;
  chatId: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    id: string;
    name: string;
    tool?: string;
    args?: Record<string, unknown>;
    requiresApproval?: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Multi-tenant types (future hosted deployment)
// ---------------------------------------------------------------------------

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  subdomain?: string;
  customDomain?: string;
  workspaceRoot: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Proactivity Engine
// ---------------------------------------------------------------------------

export type ModelTier = "cheap" | "standard" | "premium";

export interface ModelPolicy {
  jobType: string;
  defaultTier: ModelTier;
  escalationRules?: string[];
}

export type ProactiveJobKind =
  | "cron"
  | "heartbeat"
  | "watchdog"
  | "goal_loop"
  | "report";

export type ProactiveJobStatus = "active" | "paused";

export interface ScheduledJob {
  id: string;
  kind: ProactiveJobKind;
  name: string;
  /** Cron expression (e.g. "0 9 * * *" for 9am daily). Optional if interval_sec set. */
  scheduleCron?: string | null;
  /** Run every N seconds. Optional if schedule_cron set. */
  intervalSec?: number | null;
  /** Job-specific config (e.g. project_slug for goal_loop, report type for report). */
  config?: Record<string, unknown>;
  modelTier: ModelTier;
  /** Target conversation for follow-ups (channel/project). */
  conversationId?: string | null;
  projectSlug?: string | null;
  status: ProactiveJobStatus;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number | null;
}

export type JobExecutionStatus = "running" | "completed" | "failed";

export interface JobExecution {
  id: string;
  jobId: string;
  startedAt: number;
  finishedAt?: number | null;
  status: JobExecutionStatus;
  summary?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  modelUsed?: string | null;
}

export type ProactiveNotificationKind = "inform" | "reassure" | "escalate" | "delight";

export interface ProactiveNotification {
  id: string;
  jobId?: string | null;
  executionId?: string | null;
  kind: ProactiveNotificationKind;
  title: string;
  body: string;
  /** Conversation to attach to (channel/project). */
  conversationId?: string | null;
  /** Session chat_id for session-scoped delivery. */
  sessionChatId?: string | null;
  readAt?: number | null;
  createdAt: number;
}
