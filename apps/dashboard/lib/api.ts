const DEFAULT_BASE_URL = "http://localhost:4317";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || DEFAULT_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export type GatewayStatusResponse = {
  ok: boolean;
  status: {
    gateway: string;
    workspaceRoot?: string;
    mode?: string;
    registeredTools?: string[];
    agents?: string[];
  };
};

export async function getStatus() {
  return request<GatewayStatusResponse>("/api/status", { method: "GET" });
}

export type SessionHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  ok: boolean;
  result: {
    ok?: boolean;
    agentId?: string;
    summary?: string;
    messages?: string[];
    toolResults?: Array<{
      toolName: string;
      ok: boolean;
      error?: string;
      data?: unknown;
    }>;
    workOrders?: unknown[];
  };
};

export type TraceItem = {
  id: string;
  ts: number;
  type: string;
  agentId: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type TracesResponse = {
  ok: boolean;
  traces: TraceItem[];
};

export type ApprovalItem = {
  id: string;
  createdAt: number;
  agentId: string;
  toolName: string;
  environment: string;
  risk: "low" | "medium" | "high";
  args: Record<string, unknown>;
  reason?: string;
};

export type ApprovalsResponse = {
  ok: boolean;
  approvals: ApprovalItem[];
};

export async function getGatewayStatus() {
  return request<GatewayStatusResponse>("/api/status", { method: "GET" });
}

export async function postChat(input: {
  message: string;
  chatId?: string;
  threadId?: string;
  history?: SessionHistoryMessage[];
}) {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getTraces() {
  return request<TracesResponse>("/api/traces", { method: "GET" });
}

export async function getTracesPage(input?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (input?.limit !== undefined) params.set("limit", String(input.limit));
  if (input?.offset !== undefined) params.set("offset", String(input.offset));
  const query = params.toString();
  return request<TracesResponse>(`/api/traces${query ? `?${query}` : ""}`, { method: "GET" });
}

export async function getApprovals() {
  return request<ApprovalsResponse>("/api/approvals", { method: "GET" });
}

export type SessionLiveState = {
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
};

export async function getLiveState(chatId: string, threadId?: string) {
  const params = new URLSearchParams({ chatId });
  if (threadId) params.set("threadId", threadId);
  return request<{ ok: boolean; state: SessionLiveState | null }>(
    `/api/live-state?${params.toString()}`,
    { method: "GET" }
  );
}

export async function createMemoryProposal(input: { entryId: string }) {
  return request<{
    ok: boolean;
    approvalId?: string;
    proposedBlock?: string;
    entryId?: string;
    source?: string;
    error?: string;
  }>("/api/memory/propose", {
    method: "POST",
    body: JSON.stringify({ entryId: input.entryId }),
  });
}

export async function resolveApproval(input: {
  requestId: string;
  decision: "approved" | "denied";
  note?: string;
  grant?: {
    expiresAt?: number;
    scope:
      | { type: "once"; toolName: string }
      | { type: "tool"; toolName: string }
      | { type: "agent"; agentId: string }
      | { type: "view"; view: string }
      | {
          type: "session";
          sessionKey: {
            workspaceId: string;
            agentId: string;
            channel: string;
            chatId: string;
            threadId?: string;
          };
        };
    note?: string;
  };
}) {
  return request<{ ok: boolean; result: unknown }>(`/api/approvals/${input.requestId}/resolve`, {
    method: "POST",
    body: JSON.stringify({
      decision: input.decision,
      note: input.note,
      grant: input.grant
    })
  });
}

export async function getViewState(input?: { channel?: string; chatId?: string; threadId?: string }) {
  const params = new URLSearchParams();
  if (input?.channel) params.set("channel", input.channel);
  if (input?.chatId) params.set("chatId", input.chatId);
  if (input?.threadId) params.set("threadId", input.threadId);
  const query = params.toString();
  return request<{ ok: boolean; state: unknown }>(`/api/view-state${query ? `?${query}` : ""}`, { method: "GET" });
}

export async function setViewState(input: {
  primary: string;
  overlays?: string[];
  channel?: string;
  chatId?: string;
  threadId?: string;
}) {
  return request<{ ok: boolean; result: unknown }>("/api/view-state", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type TaskEvent = Record<string, unknown>;

export async function getTaskEvents() {
  return request<{ ok: boolean; events: TaskEvent[] }>("/api/tasks/events", {
    method: "GET"
  });
}

export async function getTaskEventsPage(input?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (input?.limit !== undefined) params.set("limit", String(input.limit));
  if (input?.offset !== undefined) params.set("offset", String(input.offset));
  const query = params.toString();
  return request<{ ok: boolean; events: TaskEvent[] }>(`/api/tasks/events${query ? `?${query}` : ""}`, {
    method: "GET"
  });
}

export async function appendTaskEvent(event: TaskEvent) {
  return request<{ ok: boolean; result: unknown }>("/api/tasks/events", {
    method: "POST",
    body: JSON.stringify({ event })
  });
}

// Task mutations (update canonical tasks.md + append event to runtime store)
export async function createTask(input: {
  task: string;
  section?: string;
  priority?: string;
  owner?: string;
}) {
  return request<{ ok: boolean; result: { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | null }>(
    "/api/tasks/create",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function updateTask(input: { taskId: string; patch: Record<string, string> }) {
  return request<{ ok: boolean; result: { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | null }>(
    "/api/tasks/update",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function moveTask(input: {
  taskId: string;
  status?: string;
  targetSection?: string;
}) {
  return request<{ ok: boolean; result: { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | null }>(
    "/api/tasks/move",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function completeTask(input: { taskId: string }) {
  return request<{ ok: boolean; result: { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | null }>(
    "/api/tasks/complete",
    { method: "POST", body: JSON.stringify(input) }
  );
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export type WorkflowStep = {
  id: string;
  name: string;
  status: string;
  tool?: string;
  args?: Record<string, unknown>;
  requiresApproval?: boolean;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
};

export type WorkflowRun = {
  id: string;
  name: string;
  status: string;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  agentId: string;
  channel: string;
  chatId: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
};

export async function getWorkflows() {
  return request<{ ok: boolean; workflows: WorkflowRun[] }>("/api/workflows", {
    method: "GET",
  });
}

export async function getWorkflow(id: string) {
  return request<{ ok: boolean; workflow: WorkflowRun }>(`/api/workflows/${id}`, {
    method: "GET",
  });
}

export async function createWorkflow(input: {
  definition: {
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
  };
  agentId?: string;
}) {
  return request<{ ok: boolean; workflow: WorkflowRun }>("/api/workflows", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function advanceWorkflowStep(input: {
  runId: string;
  stepId: string;
  status: string;
  result?: unknown;
  error?: string;
}) {
  return request<{ ok: boolean; workflow: WorkflowRun | null }>(
    `/api/workflows/${input.runId}/advance`,
    {
      method: "POST",
      body: JSON.stringify({
        stepId: input.stepId,
        status: input.status,
        result: input.result,
        error: input.error,
      }),
    }
  );
}

export async function pauseWorkflow(id: string) {
  return request<{ ok: boolean; workflow: WorkflowRun | null }>(
    `/api/workflows/${id}/pause`,
    { method: "POST" }
  );
}

export async function resumeWorkflow(id: string) {
  return request<{ ok: boolean; workflow: WorkflowRun | null }>(
    `/api/workflows/${id}/resume`,
    { method: "POST" }
  );
}

export async function cancelWorkflow(id: string) {
  return request<{ ok: boolean; workflow: WorkflowRun | null }>(
    `/api/workflows/${id}/cancel`,
    { method: "POST" }
  );
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export type TenantInfo = {
  id: string;
  slug: string;
  name: string;
  subdomain?: string;
  customDomain?: string;
  workspaceRoot: string;
  createdAt: number;
};

export async function getTenants() {
  return request<{ ok: boolean; tenants: TenantInfo[] }>("/api/tenants", {
    method: "GET",
  });
}

export async function getTenant(idOrSlug: string) {
  return request<{ ok: boolean; tenant: TenantInfo }>(`/api/tenants/${idOrSlug}`, {
    method: "GET",
  });
}

export async function createTenant(input: {
  slug: string;
  name: string;
  subdomain?: string;
  customDomain?: string;
  workspaceRoot?: string;
}) {
  return request<{ ok: boolean; tenant: TenantInfo }>("/api/tenants", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------------------
// Direct tool execution (non-chat pipeline)
// ---------------------------------------------------------------------------

export async function runTool(name: string, args?: Record<string, unknown>) {
  return request<{ ok: boolean; result?: unknown; error?: string }>("/api/tools/run", {
    method: "POST",
    body: JSON.stringify({ name, args: args ?? {} }),
  });
}

// ---------------------------------------------------------------------------
// Workspace projects (filesystem-backed)
// ---------------------------------------------------------------------------

export type ProjectInfo = {
  name: string;
  slug: string;
  path: string;
  status?: string;
  hasProjectMd: boolean;
  hasTasksMd: boolean;
};

export async function getProjects() {
  return request<{ ok: boolean; projects: ProjectInfo[] }>("/api/projects", {
    method: "GET",
  });
}

export async function getProject(slug: string) {
  return request<{ ok: boolean; project?: ProjectInfo; error?: string }>(
    `/api/projects/${encodeURIComponent(slug)}`,
    { method: "GET" }
  );
}

// ---------------------------------------------------------------------------
// Chat intelligence (extracted tasks, memories, preferences, insights)
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

export type IntelligenceData = IntelligenceSignals & {
  id?: string;
  session_id?: string | null;
  conversation_id?: string | null;
  analyzed_at?: number;
  message_count?: number;
  created_at?: number;
  updated_at?: number;
};

export async function getChatIntelligence(chatId: string, threadId?: string) {
  const params = new URLSearchParams({ chatId });
  if (threadId) params.set("threadId", threadId);
  return request<{ ok: boolean; intelligence: IntelligenceData | null }>(
    `/api/chat/intelligence?${params}`,
    { method: "GET" }
  );
}

export type ChannelInfo = {
  id: string;
  type: string;
  title: string;
  channel_slug: string | null;
  project_slug?: string | null;
  metadata?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

export async function getChannels() {
  return request<{ ok: boolean; channels: ChannelInfo[] }>("/api/channels", { method: "GET" });
}

export async function createChannel(input: { channel_slug: string; title?: string }) {
  return request<{ ok: boolean; channel: ChannelInfo }>("/api/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type ConversationAgent = { id: string; conversation_id: string; agent_id: string; role: string | null; pinned: boolean };

export async function getConversationAgents(conversationId: string) {
  return request<{ ok: boolean; agents: ConversationAgent[] }>(
    `/api/conversations/${encodeURIComponent(conversationId)}/agents`,
    { method: "GET" }
  );
}

export async function addConversationAgent(conversationId: string, input: { agent_id: string; role?: string; pinned?: boolean }) {
  return request<{ ok: boolean }>(`/api/conversations/${encodeURIComponent(conversationId)}/agents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeConversationAgent(conversationId: string, agentId: string) {
  return request<{ ok: boolean }>(
    `/api/conversations/${encodeURIComponent(conversationId)}/agents/${encodeURIComponent(agentId)}`,
    { method: "DELETE" }
  );
}

export async function getConversationMessages(conversationId: string, limit?: number) {
  const params = limit != null ? `?limit=${limit}` : "";
  return request<{ ok: boolean; messages: Array<{ id: string; role: string; content: string; created_at: number }> }>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages${params}`,
    { method: "GET" }
  );
}

export async function postConversationMessage(conversationId: string, input: { message: string; history?: Array<{ role: string; content: string }> }) {
  return request<{ ok: boolean; result?: { summary?: string; messages?: string[] } }>(
    `/api/conversations/${encodeURIComponent(conversationId)}/message`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

// Proactivity: jobs, notifications, runs
export type ProactiveJob = { id: string; kind: string; name: string; scheduleCron?: string | null; intervalSec?: number | null; config?: Record<string, unknown>; modelTier: string; conversationId?: string | null; projectSlug?: string | null; status: "active" | "paused"; createdAt: number; updatedAt: number; lastRunAt?: number | null };
export type ProactiveNotification = { id: string; jobId?: string | null; executionId?: string | null; kind: "inform" | "reassure" | "escalate" | "delight"; title: string; body: string; conversationId?: string | null; sessionChatId?: string | null; readAt?: number | null; createdAt: number };
export type ProactiveRun = { id: string; jobId: string; startedAt: number; finishedAt?: number | null; status: "running" | "completed" | "failed"; summary?: string | null; result?: Record<string, unknown> | null; error?: string | null; modelUsed?: string | null };
export async function getProactiveJobs(status?: "active" | "paused") { const q = status ? `?status=${status}` : ""; return request<{ ok: boolean; jobs: ProactiveJob[] }>(`/api/proactive/jobs${q}`, { method: "GET" }); }
export async function getProactiveJob(id: string) { return request<{ ok: boolean; job: ProactiveJob | null }>(`/api/proactive/jobs/${id}`, { method: "GET" }); }
export async function createProactiveJob(input: { kind: string; name: string; scheduleCron?: string | null; intervalSec?: number | null; config?: Record<string, unknown>; modelTier?: string; conversationId?: string | null; projectSlug?: string | null }) { return request<{ ok: boolean; job: ProactiveJob }>("/api/proactive/jobs", { method: "POST", body: JSON.stringify(input) }); }
export async function pauseProactiveJob(id: string) { return request<{ ok: boolean; job: ProactiveJob | null }>(`/api/proactive/jobs/${id}/pause`, { method: "POST" }); }
export async function resumeProactiveJob(id: string) { return request<{ ok: boolean; job: ProactiveJob | null }>(`/api/proactive/jobs/${id}/resume`, { method: "POST" }); }
export async function runProactiveJobNow(id: string) { return request<{ ok: boolean; result?: { executionId?: string; summary?: string; notification?: ProactiveNotification } }>(`/api/proactive/jobs/${id}/run`, { method: "POST" }); }
export async function getProactiveNotifications(opts?: { unreadOnly?: boolean; limit?: number }) { const p = new URLSearchParams(); if (opts?.unreadOnly) p.set("unreadOnly", "true"); if (opts?.limit != null) p.set("limit", String(opts.limit)); const q = p.toString(); return request<{ ok: boolean; notifications: ProactiveNotification[] }>(`/api/proactive/notifications${q ? `?${q}` : ""}`, { method: "GET" }); }
export async function markProactiveNotificationRead(id: string) { return request<{ ok: boolean }>(`/api/proactive/notifications/${id}/read`, { method: "POST" }); }
export async function getProactiveRuns(jobId?: string, limit?: number) { const p = new URLSearchParams(); if (jobId) p.set("jobId", jobId); if (limit != null) p.set("limit", String(limit)); const q = p.toString(); return request<{ ok: boolean; runs: ProactiveRun[] }>(`/api/proactive/runs${q ? `?${q}` : ""}`, { method: "GET" }); }

export type TriggerEvent = { id: string; jobId: string; executionId: string; kind: string; jobName: string; payload: Record<string, unknown>; conversationId?: string | null; projectSlug?: string | null; sessionChatId?: string | null; createdAt: number };
export type AttentionDecision = { id: string; candidateId: string; triggerEventId: string; outcome: string; rationale: string; owner: string; notificationId?: string | null; workItemId?: string | null; criteria: Record<string, unknown>; createdAt: number };
export type AttentionBudgetConfig = { maxProactiveMessagesPerDay: number; quietHours?: [number, number] | null; bundleRelated: boolean; minMinutesBetweenSameTypeNudge: number; preferSilentProgress: boolean };
export async function getProactiveTriggers(limit?: number, offset?: number) { const p = new URLSearchParams(); if (limit != null) p.set("limit", String(limit)); if (offset != null) p.set("offset", String(offset)); const q = p.toString(); return request<{ ok: boolean; triggers: TriggerEvent[] }>(`/api/proactive/triggers${q ? `?${q}` : ""}`, { method: "GET" }); }
export async function getProactiveDecisions(limit?: number, offset?: number) { const p = new URLSearchParams(); if (limit != null) p.set("limit", String(limit)); if (offset != null) p.set("offset", String(offset)); const q = p.toString(); return request<{ ok: boolean; decisions: AttentionDecision[] }>(`/api/proactive/decisions${q ? `?${q}` : ""}`, { method: "GET" }); }
export async function getAttentionBudgetConfig() { return request<{ ok: boolean; config: AttentionBudgetConfig | null }>("/api/proactive/attention-budget", { method: "GET" }); }
