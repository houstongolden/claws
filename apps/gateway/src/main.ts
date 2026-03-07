import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFile, rm, readdir, appendFile, mkdir, writeFile } from "node:fs/promises";
import { createDefaultAgents } from "@claws/agents/index";
import { ApprovalStore } from "@claws/core/approvals";
import { runAgentLoop } from "@claws/core/runner";
import { StaticRouter } from "@claws/core/router";
import { createVercelWorkflowAdapter } from "@claws/core/workflow-vercel";
import type { MessageEvent, Mode, TraceItem } from "@claws/shared/types";
import {
  initRuntimeDb,
  getSession,
  getOrCreateSession,
  getSessionMessages,
  appendMessage,
  replaceSessionMessages,
  setSessionView,
  insertTrace,
  listTraces,
  appendToolEvent,
  insertApproval,
  listPendingApprovals,
  deleteApproval,
  insertApprovalGrant,
  listApprovalGrants,
  deleteApprovalGrant,
  createWorkflowRun as dbCreateWorkflowRun,
  getWorkflowRunById,
  listWorkflowRuns as dbListWorkflowRuns,
  advanceWorkflowStep as dbAdvanceWorkflowStep,
  pauseWorkflowRun as dbPauseWorkflowRun,
  resumeWorkflowRun as dbResumeWorkflowRun,
  cancelWorkflowRun as dbCancelWorkflowRun,
  resetWorkflows as dbResetWorkflows,
  resetRuntimeState,
  appendTaskEvent as dbAppendTaskEvent,
  listTaskEvents as dbListTaskEvents,
  sessionId as getSessionIdKey,
  countTraces,
  createConversation as dbCreateConversation,
  listConversations as dbListConversations,
  getConversation as dbGetConversation,
  getConversationByChatAndThread,
  getConversationMessages as dbGetConversationMessages,
  addConversationMessage as dbAddConversationMessage,
  listChannels as dbListChannels,
  createChannel as dbCreateChannel,
  getConversationAgents as dbGetConversationAgents,
  addConversationAgent as dbAddConversationAgent,
  removeConversationAgent as dbRemoveConversationAgent,
  getOrCreateConversationForDestination as dbGetOrCreateConversationForDestination,
  getSessionLiveState as dbGetSessionLiveState,
  listScheduledJobs as dbListScheduledJobs,
  getScheduledJob as dbGetScheduledJob,
  createScheduledJob as dbCreateScheduledJob,
  pauseScheduledJob as dbPauseScheduledJob,
  resumeScheduledJob as dbResumeScheduledJob,
  listDueScheduledJobs as dbListDueScheduledJobs,
  createJobExecution as dbCreateJobExecution,
  updateJobExecution as dbUpdateJobExecution,
  updateScheduledJobLastRun as dbUpdateScheduledJobLastRun,
  listJobExecutions as dbListJobExecutions,
  listProactiveNotifications as dbListProactiveNotifications,
  createProactiveNotification as dbCreateProactiveNotification,
  markProactiveNotificationRead as dbMarkProactiveNotificationRead,
  seedModelPolicies as dbSeedModelPolicies,
  seedBuiltInProactiveJobs as dbSeedBuiltInProactiveJobs,
  listTriggerEvents as dbListTriggerEvents,
  listAttentionDecisions as dbListAttentionDecisions,
  getAttentionBudgetConfig as dbGetAttentionBudgetConfig,
  upsertConversationIntelligence,
  getIntelligenceBySession,
  getIntelligenceByConversation,
} from "@claws/runtime-db";
import { registerDefaultTools, ToolRegistry, resolveSandboxConfig, resolveBrowserConfig } from "@claws/tools/index";
import { FolderPolicyError } from "@claws/workspace";
import { printStartupBanner, runCliChat } from "./cli";
import { startGateway, type GatewayRuntime } from "./httpServer";
import {
  getConfiguredAIProvider,
  isAIEnabled,
  handleAIChat,
  validateAIProviderConfiguration,
  writeStreamToResponse,
  type ChatHistoryTurn,
} from "./aiHandler";
import { registerTenant, listTenants, getTenant } from "./tenantRouter";
import { runChatIntelligenceAnalysis } from "./intelligenceAnalysis";
import { parseMappingFile } from "./channelMapping";
import { parseAgentMentions, resolveLeadAgent } from "./agentMentions";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function normalizeCommandTarget(input: string): string {
  return input
    .trim()
    .replace(/^called\s+/i, "")
    .replace(/^named\s+/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}

class ApprovalRequiredError extends Error {
  constructor(
    message: string,
    readonly approvalId: string
  ) {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

async function workspaceFsRead(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

async function loadIdentityContext(workspaceRoot: string): Promise<Record<string, string>> {
  const targets = [
    "identity/you.md",
    "identity/profile/about.md",
    "identity/profile/now.md",
    "identity/preferences/agent.md"
  ];
  const context: Record<string, string> = {};
  for (const relativePath of targets) {
    const absolute = path.join(workspaceRoot, relativePath);
    if (!existsSync(absolute)) continue;
    try {
      context[relativePath] = (await readFile(absolute, "utf8")).slice(0, 2000);
    } catch {
      // ignore unreadable optional files
    }
  }
  return context;
}

async function main() {
  const cwd = process.cwd();
  const workspaceRoot = existsSync(path.join(cwd, "project-context")) ? cwd : path.resolve(cwd, "..", "..");
  const port = Number(process.env.CLAWS_PORT || 4317);
  const defaultPrimary = (process.env.CLAWS_DEFAULT_VIEW as Mode | undefined) ?? "founder";
  validateAIProviderConfiguration();

  const router = new StaticRouter({
    workspaceId: "ws_local",
    defaultPrimaryView: defaultPrimary,
    defaultOverlays: ["developer"]
  });

  const approvals = new ApprovalStore();
  await initRuntimeDb({ workspaceRoot });
  await dbSeedModelPolicies();
  await dbSeedBuiltInProactiveJobs();
  const pendingFromDb = await listPendingApprovals();
  for (const item of pendingFromDb) {
    approvals.hydrate(item);
  }
  const grantsFromDb = await listApprovalGrants();
  const now = Date.now();
  for (const g of grantsFromDb) {
    const key = `${g.scope_type}:${g.scope_key}`;
    if (g.expires_at && g.expires_at < now) {
      await deleteApprovalGrant(g.scope_type, g.scope_key);
      continue;
    }
    approvals.hydrateGrant(key, { expiresAt: g.expires_at ?? undefined, note: g.note ?? undefined });
  }

  const vercelWorkflow = createVercelWorkflowAdapter();
  if (vercelWorkflow) {
    console.log("[gateway] Vercel Workflow adapter active (VERCEL_PROJECT_ID configured)");
  }
  const agents = createDefaultAgents();

  const registry = registerDefaultTools(new ToolRegistry(), workspaceRoot);
  const identityContext = await loadIdentityContext(workspaceRoot);

  const chatRef: { handleChat?: GatewayRuntime["handleChat"] } = {};

  function getThreadKey(input: { chatId: string; threadId?: string }): string {
    return `local:${input.chatId}:${input.threadId ?? "root"}`;
  }

  async function getSessionHistory(input: {
    chatId: string;
    threadId?: string;
    history?: ChatHistoryTurn[];
  }): Promise<ChatHistoryTurn[]> {
    const sessionKey = getSessionIdKey(input.chatId, input.threadId);
    if (input.history && input.history.length > 0) {
      await getOrCreateSession(input.chatId, input.threadId);
      await replaceSessionMessages(sessionKey, input.history);
      return input.history;
    }
    const messages = await getSessionMessages(sessionKey);
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  async function persistSessionHistory(
    input: { chatId: string; threadId?: string },
    history: ChatHistoryTurn[]
  ): Promise<void> {
    const sessionKey = getSessionIdKey(input.chatId, input.threadId);
    await getOrCreateSession(input.chatId, input.threadId);
    const conv = await getConversationByChatAndThread(input.chatId, input.threadId);
    await replaceSessionMessages(sessionKey, history.slice(-20), conv?.id ?? undefined);
  }

  async function persistSessionState(input: { chatId: string; threadId?: string }) {
    const viewState = await router.getThreadViewState({
      channel: "local",
      chatId: input.chatId,
      threadId: input.threadId,
    });
    if (viewState) {
      await setSessionView(input.chatId, input.threadId, viewState);
    }
  }

  const guardedRunTool = async (input: {
    name: string;
    args: Record<string, unknown>;
    agentId: string;
    sessionKey: {
      workspaceId: string;
      agentId: string;
      channel: string;
      chatId: string;
      threadId?: string;
    };
    view: Mode;
  }) => {
    const spec = registry.get(input.name);
    if (!spec) throw new Error(`Tool "${input.name}" is not registered`);
    const sessionIdKey = getSessionIdKey(input.sessionKey.chatId, input.sessionKey.threadId);

    if (spec.risk === "high") {
      const granted = approvals.isGranted({
        toolName: input.name,
        agentId: input.agentId,
        view: input.view,
        sessionKey: input.sessionKey
      });

      if (!granted) {
        const approval = approvals.enqueue({
          agentId: input.agentId,
          toolName: input.name,
          risk: spec.risk,
          args: input.args,
          reason: "High-risk tool requires approval or active trust grant.",
          environment: spec.environment
        });
        await insertApproval(approval);
        const traceItem: TraceItem = {
          id: randomUUID(),
          ts: Date.now(),
          type: "approval-required",
          agentId: input.agentId,
          summary: `Approval required for ${input.name}`,
          data: {
            approvalId: approval.id,
            toolName: input.name,
            environment: spec.environment,
            args: input.args,
          }
        };
        await insertTrace(traceItem, sessionIdKey);

        throw new ApprovalRequiredError(
          `Approval required for ${input.name}. Resolve request ${approval.id} in Approvals.`,
          approval.id
        );
      }
    }

    let result: unknown;
    try {
      result = await registry.run(input.name, input.args);
    } catch (err) {
      if (err instanceof FolderPolicyError) {
        const traceItem: TraceItem = {
          id: randomUUID(),
          ts: Date.now(),
          type: "folder-policy-blocked",
          agentId: input.agentId,
          summary: `FOLDER.md policy blocked: ${err.code} (${err.path})`,
          data: {
            code: err.code,
            path: err.path,
            root: err.root,
            message: err.message,
            toolName: input.name,
            args: input.args,
          },
        };
        await insertTrace(traceItem, sessionIdKey);
      }
      throw err;
    }

    const traceItem: TraceItem = {
      id: randomUUID(),
      ts: Date.now(),
      type: "tool-call",
      agentId: input.agentId,
      summary: `${input.name}`,
      data: {
        toolName: input.name,
        environment: spec.environment,
        risk: spec.risk,
        args: input.args,
      },
    };
    if (
      result &&
      typeof result === "object" &&
      "provider" in result &&
      "mode" in result &&
      (input.name.startsWith("browser.") || spec.environment === "browser")
    ) {
      const br = result as { provider?: string; mode?: string; fallbackUsed?: boolean; requestedProvider?: string };
      (traceItem.data as Record<string, unknown>).provider = br.provider;
      (traceItem.data as Record<string, unknown>).mode = br.mode;
      if (br.fallbackUsed) (traceItem.data as Record<string, unknown>).fallbackUsed = true;
      if (br.requestedProvider) (traceItem.data as Record<string, unknown>).requestedProvider = br.requestedProvider;
    }
    await insertTrace(traceItem, sessionIdKey);
    await appendToolEvent(
      sessionIdKey,
      traceItem.id,
      input.name,
      input.args,
      result,
      true
    );

    return result;
  };

  let telegramMapping = new Map<string, string>();
  let slackMapping = new Map<string, string>();
  try {
    const telegramPath = path.join(workspaceRoot, "config", "telegram.md");
    const slackPath = path.join(workspaceRoot, "config", "slack.md");
    if (existsSync(telegramPath)) {
      const content = await readFile(telegramPath, "utf8");
      telegramMapping = parseMappingFile(content, "telegram_topic");
    }
    if (existsSync(slackPath)) {
      const content = await readFile(slackPath, "utf8");
      slackMapping = parseMappingFile(content, "slack_channel");
    }
  } catch (e) {
    console.warn("[gateway] Channel mapping load failed:", e);
  }

  const runtime: GatewayRuntime = {
    router,
    runTool: async (name, args) =>
      guardedRunTool({
        name,
        args,
        agentId: "orchestrator",
        sessionKey: {
          workspaceId: "ws_local",
          agentId: "orchestrator",
          channel: "local",
          chatId: "dashboard-chat"
        },
        view: defaultPrimary
      }),
    getStatus: async () => {
      const browserConfig = resolveBrowserConfig();
      const sandboxConfig = resolveSandboxConfig();
      const toolsByEnv = registry.byEnvironment();
      const aiProvider = getConfiguredAIProvider();

      return {
        gateway: "online",
        workspaceRoot,
        mode: "local-first",
        registeredTools: registry.listNames(),
        toolsByEnvironment: toolsByEnv,
        agents: agents.map((a) => ({
          id: a.id,
          description: a.description,
          modes: a.modes,
        })),
        ai: {
          enabled: isAIEnabled(),
          streaming: isAIEnabled(),
          model: process.env.AI_MODEL || "gpt-4o-mini",
          provider: aiProvider,
          gatewayUrl:
            aiProvider === "gateway"
              ? process.env.AI_GATEWAY_URL || "https://ai-gateway.vercel.sh/v1"
              : null,
        },
        execution: {
          browser: {
            provider: browserConfig.provider,
            defaultMode: browserConfig.defaultMode,
            availableProviders: browserConfig.availableProviders,
            availableModes: browserConfig.availableModes,
            preferredAgentBrowser: browserConfig.preferredAgentBrowser,
          },
          sandbox: {
            enabled: sandboxConfig.enabled,
            provider: sandboxConfig.provider,
          },
          computer: {
            available: browserConfig.provider === "native",
            note: "Full computer-use requires Agent Browser native mode or a persistent VPS.",
          },
          routerOrder: ["api", "browser", "sandbox", "computer"],
        },
        workflows: {
          count: (await dbListWorkflowRuns()).length,
          persistence: "pglite",
        },
        tenants: {
          count: listTenants().length,
          multiTenantEnabled: listTenants().length > 0,
        },
        approvals: {
          pending: approvals.listPending().length,
        },
        traces: {
          count: await countTraces(),
        },
      };
    },
    listTraces: async (input) => {
      const limit = Math.max(1, Math.min(500, Number(input?.limit ?? 120)));
      const offset = Math.max(0, Number(input?.offset ?? 0));
      return listTraces(limit, offset);
    },
    listApprovals: async () => approvals.listPending(),
    createMemoryProposal: async (input: { entryId: string }) => {
      const entryId = input.entryId?.trim();
      if (!entryId) throw new Error("Missing entryId");
      const getResult = (await registry.run("memory.getEntry", { entryId })) as
        | { ok: boolean; entry?: { id: string; text: string; source?: string }; error?: string }
        | undefined;
      if (!getResult?.ok || !getResult.entry) {
        throw new Error(getResult?.error ?? "Memory entry not found");
      }
      const entry = getResult.entry;
      const approval = approvals.enqueue({
        agentId: "dashboard",
        toolName: "memory.promoteToDurable",
        risk: "high",
        args: { entryId: entry.id, text: entry.text, source: entry.source ?? "" },
        reason: "Append to prompt/MEMORY.md (durable memory). Approve to add this content.",
        environment: "workspace",
      });
      await insertApproval(approval);
      await insertTrace(
        {
          id: randomUUID(),
          ts: Date.now(),
          type: "memory-proposal-created",
          agentId: "dashboard",
          summary: `Memory proposal created for entry ${entryId} → prompt/MEMORY.md`,
          data: { approvalId: approval.id, entryId: entry.id, source: entry.source },
        },
        undefined
      );
      return {
        ok: true,
        approvalId: approval.id,
        proposedBlock: entry.text,
        entryId: entry.id,
        source: entry.source ?? "",
      };
    },
    resolveApproval: async ({ requestId, decision, note, grant }) => {
      const target = approvals.listPending().find((p) => p.id === requestId);
      const result = await approvals.resolveDecision({ requestId, decision, note, grant });
      await deleteApproval(requestId);
      if (decision === "approved" && grant?.scope) {
        const scope = grant.scope;
        const expiresAt = grant.expiresAt;
        const noteText = grant.note;
        if (scope.type === "once") {
          await insertApprovalGrant("once", scope.toolName, expiresAt, noteText);
        } else if (scope.type === "tool") {
          await insertApprovalGrant("tool", scope.toolName, expiresAt, noteText);
        } else if (scope.type === "agent") {
          await insertApprovalGrant("agent", scope.agentId, expiresAt, noteText);
        } else if (scope.type === "view") {
          await insertApprovalGrant("view", scope.view, expiresAt, noteText);
        } else if (scope.type === "session") {
          const key = `session:${scope.sessionKey.workspaceId}:${scope.sessionKey.agentId}:${scope.sessionKey.channel}:${scope.sessionKey.chatId}:${scope.sessionKey.threadId ?? "root"}`;
          await insertApprovalGrant("session", key, expiresAt, noteText);
        }
      }
      if (decision === "approved" && target?.toolName === "memory.promoteToDurable") {
        const args = (target.args ?? {}) as { entryId?: string; text?: string; source?: string };
        const text = typeof args.text === "string" ? args.text.trim() : "";
        const entryId = typeof args.entryId === "string" ? args.entryId : "";
        const source = typeof args.source === "string" ? args.source : "";
        if (text) {
          const memoryPath = path.join(workspaceRoot, "prompt", "MEMORY.md");
          try {
            await mkdir(path.dirname(memoryPath), { recursive: true });
            if (!existsSync(memoryPath)) {
              await writeFile(memoryPath, "# MEMORY.md\n", "utf8");
            }
            await appendFile(
              memoryPath,
              `\n\n---\n\n<!-- promoted ${new Date().toISOString()} entryId=${entryId} source=${source.replace(/--/g, "-")} -->\n\n${text}\n`,
              "utf8"
            );
            await insertTrace(
              {
                id: randomUUID(),
                ts: Date.now(),
                type: "memory-promoted-to-durable",
                agentId: target.agentId,
                summary: `Promoted memory to prompt/MEMORY.md (entry ${entryId})`,
                data: { entryId, source, path: "prompt/MEMORY.md" },
              },
              undefined
            );
            await dbAppendTaskEvent({
              type: "memory.promotedToDurable",
              entryId,
              source,
              path: "prompt/MEMORY.md",
              ts: Date.now(),
            });
          } catch (err) {
            await insertTrace(
              {
                id: randomUUID(),
                ts: Date.now(),
                type: "memory-promote-failed",
                agentId: target.agentId,
                summary: `Failed to append to MEMORY.md: ${err instanceof Error ? err.message : String(err)}`,
                data: { entryId, error: err instanceof Error ? err.message : String(err) },
              },
              undefined
            );
          }
        }
      }
      return result;
    },
    getViewState: async (input) => {
      const chatId = input?.chatId ?? "dashboard-chat";
      const threadId = input?.threadId;
      const sessionKey = getSessionIdKey(chatId, threadId);
      const session = await getSession(sessionKey);
      if (session?.view_primary) {
        return {
          primary: session.view_primary,
          overlays: Array.isArray(session.view_overlays) ? session.view_overlays : [],
        };
      }
      if ("getThreadViewState" in router && typeof router.getThreadViewState === "function") {
        return router.getThreadViewState({
          channel: (input?.channel ?? "local") as MessageEvent["channel"],
          chatId,
          threadId,
        });
      }
      return null;
    },
    setViewState: async ({ primary, overlays, channel, chatId, threadId }) => {
      if ("setThreadViewState" in router && typeof router.setThreadViewState === "function") {
        await router.setThreadViewState({
          primary: primary as Mode,
          overlays: (overlays ?? []) as Mode[],
          channel: (channel ?? "local") as MessageEvent["channel"],
          chatId: chatId ?? "dashboard-chat",
          threadId
        });
      }
      await setSessionView(chatId ?? "dashboard-chat", threadId, {
        primary: primary as Mode,
        overlays: (overlays ?? []) as Mode[],
      });
      return { primary, overlays: overlays ?? [] };
    },
    getTaskEvents: async (input) => {
      const limit = Math.max(1, Math.min(500, Number(input?.limit ?? 120)));
      const offset = Math.max(0, Number(input?.offset ?? 0));
      return dbListTaskEvents(limit, offset);
    },
    appendTaskEvent: async ({ event }) => {
      await dbAppendTaskEvent(event as Record<string, unknown>);
      await registry.run("tasks.appendEvent", { event });
      return { ok: true };
    },
    resetState: async () => {
      approvals.reset();
      await resetRuntimeState();
      const memoryStorePath = path.join(workspaceRoot, ".claws", "memory-store.json");
      try {
        await rm(memoryStorePath, { force: true });
      } catch {
        // ignore cleanup errors for reset flow
      }
    },
    listWorkflows: async () => dbListWorkflowRuns(),
    getWorkflow: async (id) => getWorkflowRunById(id),
    createWorkflow: async ({ definition, agentId }) =>
      await dbCreateWorkflowRun(definition, {
        agentId,
        channel: "local",
        chatId: "dashboard-chat",
      }),
    advanceWorkflowStep: async ({ runId, stepId, status, result, error }) =>
      await dbAdvanceWorkflowStep(runId, stepId, { status: status as import("@claws/shared/types").WorkflowStatus, result, error }),
    pauseWorkflow: async (id) => await dbPauseWorkflowRun(id),
    resumeWorkflow: async (id) => await dbResumeWorkflowRun(id),
    cancelWorkflow: async (id) => await dbCancelWorkflowRun(id),
    listTenants: () => listTenants(),
    getTenant: (idOrSlug) => getTenant(idOrSlug),
    registerTenant: (config) => registerTenant(config),
    listConversations: async (filter) => {
      const type = filter?.type as "session" | "project" | "channel" | "agent" | undefined;
      return dbListConversations({
        type,
        project_slug: filter?.project_slug,
        channel_slug: filter?.channel_slug,
        limit: filter?.limit,
        offset: filter?.offset,
      });
    },
    createConversation: async (body) =>
      dbCreateConversation({
        type: body.type as "session" | "project" | "channel" | "agent",
        title: body.title,
        project_slug: body.project_slug,
        channel_slug: body.channel_slug,
        tags: body.tags,
      }),
    getConversation: (id) => dbGetConversation(id),
    getConversationMessages: (id, limit) => dbGetConversationMessages(id, limit),
    addConversationMessage: async (id, body) => {
      await dbAddConversationMessage(id, body.role ?? "user", body.content);
      return { appended: true };
    },
    postConversationMessage: async (conversationId, body) => {
      await dbAddConversationMessage(conversationId, "user", body.message);
      const conv = await dbGetConversation(conversationId);
      if (!conv?.chat_id) throw new Error("Conversation not found or not linked to session");
      const hist =
        body.history ??
        (await dbGetConversationMessages(conversationId)).map((m) => ({ role: m.role, content: m.content }));
      const agents = await dbGetConversationAgents(conversationId);
      const participantAgentIds = agents.map((a) => a.agent_id);
      const pinnedAgentIds = agents.filter((a) => a.pinned).map((a) => a.agent_id);
      const mentionedAgentIds = parseAgentMentions(body.message);
      const routing = await router.route({
        id: randomUUID(),
        channel: "local",
        timestamp: Date.now(),
        text: body.message,
        from: { userId: "local-user", displayName: "You", isMe: true },
        chat: { chatId: conv.chat_id, threadId: conv.thread_id ?? undefined },
      });
      const leadAgentId = resolveLeadAgent({
        mentionedAgentIds,
        participantAgentIds,
        pinnedAgentIds,
        defaultAgentId: routing.leadAgentId,
      });
      return chatRef.handleChat!({
        message: body.message,
        chatId: conv.chat_id,
        threadId: conv.thread_id ?? undefined,
        history: hist,
        conversationId,
        participantAgentIds,
        mentionedAgentIds,
        leadAgentId,
      });
    },
    getChatIntelligence: async (chatId, threadId) => {
      const sessionKey = getSessionIdKey(chatId, threadId);
      return getIntelligenceBySession(sessionKey);
    },
    getConversationIntelligence: (conversationId) => getIntelligenceByConversation(conversationId),
    listChannels: () => dbListChannels(),
    createChannel: async (body) => dbCreateChannel({ channel_slug: body.channel_slug, title: body.title }),
    getConversationAgents: (conversationId) => dbGetConversationAgents(conversationId),
    addConversationAgent: async (conversationId, body) => {
      await dbAddConversationAgent(conversationId, body.agent_id, { role: body.role, pinned: body.pinned });
    },
    removeConversationAgent: (conversationId, agentId) => dbRemoveConversationAgent(conversationId, agentId),
    inboundMappings: { telegram: telegramMapping, slack: slackMapping },
    getOrCreateConversationForDestination: async (params) => {
      const conv = await dbGetOrCreateConversationForDestination(params);
      return conv ? { id: conv.id } : null;
    },
    getSessionLiveState: async (chatId, threadId) => {
      if (chatId.startsWith("conv_")) {
        const conv = await dbGetConversation(chatId);
        if (!conv?.chat_id) return null;
        return dbGetSessionLiveState(conv.chat_id, conv.thread_id ?? undefined);
      }
      return dbGetSessionLiveState(chatId, threadId);
    },
    listProactiveJobs: async (status) => dbListScheduledJobs(status as "active" | "paused" | undefined),
    getProactiveJob: (id) => dbGetScheduledJob(id),
    createProactiveJob: async (body) =>
      dbCreateScheduledJob({
        kind: body.kind as import("@claws/shared/types").ProactiveJobKind,
        name: body.name,
        scheduleCron: body.scheduleCron ?? null,
        intervalSec: body.intervalSec ?? null,
        config: body.config,
        modelTier: body.modelTier as import("@claws/shared/types").ModelTier | undefined,
        conversationId: body.conversationId ?? null,
        projectSlug: body.projectSlug ?? null,
      }),
    pauseProactiveJob: (id) => dbPauseScheduledJob(id),
    resumeProactiveJob: (id) => dbResumeScheduledJob(id),
    runProactiveJobNow: async (id) => {
      const { runProactiveJob } = await import("./proactiveRunner");
      return runProactiveJob(id, {
        insertTrace,
        listPendingApprovals,
        dbCreateProactiveNotification,
        dbCreateJobExecution,
        dbUpdateJobExecution,
        dbUpdateScheduledJobLastRun,
        getScheduledJob: dbGetScheduledJob,
      });
    },
    listProactiveNotifications: (opts) => dbListProactiveNotifications(opts),
    listProactiveRuns: (jobId, limit) => dbListJobExecutions(jobId, limit ?? 50),
    markProactiveNotificationRead: (id) => dbMarkProactiveNotificationRead(id),
    listTriggerEvents: (limit, offset) => dbListTriggerEvents(limit ?? 50, offset ?? 0),
    listAttentionDecisions: (limit, offset) => dbListAttentionDecisions(limit ?? 50, offset ?? 0),
    getAttentionBudgetConfig: () => dbGetAttentionBudgetConfig(),
    scanProjects: async () => {
      const projectsDir = path.join(workspaceRoot, "projects");
      if (!existsSync(projectsDir)) return [];
      const entries = await readdir(projectsDir, { withFileTypes: true });
      const results: Array<{
        name: string;
        slug: string;
        path: string;
        status?: string;
        hasProjectMd: boolean;
        hasTasksMd: boolean;
      }> = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const slug = entry.name;
        const projDir = path.join(projectsDir, slug);
        const projectMdPath = path.join(projDir, "project.md");
        const tasksMdPath = path.join(projDir, "tasks.md");
        const hasProjectMd = existsSync(projectMdPath);
        const hasTasksMd = existsSync(tasksMdPath);
        let name = slug;
        let status: string | undefined;
        if (hasProjectMd) {
          try {
            const content = await readFile(projectMdPath, "utf8");
            const nameMatch = content.match(/^##\s*Name\s*\n(.+)/m);
            if (nameMatch?.[1]) name = nameMatch[1].trim();
            const statusMatch = content.match(/^##\s*Status\s*\n(.+)/m);
            if (statusMatch?.[1]) status = statusMatch[1].trim();
          } catch { /* ignore read errors */ }
        }
        results.push({
          name,
          slug,
          path: `projects/${slug}`,
          status,
          hasProjectMd,
          hasTasksMd,
        });
      }
      return results;
    },
    handleChatStream: isAIEnabled()
      ? async (input, res) => {
          const chatId = input.chatId ?? "dashboard-chat";
          const threadId = input.threadId;
          const history = await getSessionHistory({
            chatId,
            threadId,
            history: input.history,
          });
          const routing = await router.route({
            id: randomUUID(),
            channel: "local",
            timestamp: Date.now(),
            text: input.message,
            from: { userId: "local-user", displayName: "You", isMe: true },
            chat: { chatId, threadId },
          });
          await writeStreamToResponse(
            {
              message: input.message,
              history,
            },
            {
              registry,
              guardedRunTool: async ({ name, args }) =>
                guardedRunTool({
                  name,
                  args: name === "memory.search" ? { ...args, identityContext } : args,
                  agentId: routing.leadAgentId,
                  sessionKey: routing.sessionKey,
                  view: routing.viewStack.primary,
                }),
              identityContext,
              onApprovalRequested: (approvalId) => {
                if (!res.destroyed) {
                  res.write(`data: ${JSON.stringify({ type: "approval_requested", approvalId })}\n\n`);
                }
              },
            },
            res
          );

          await persistSessionHistory(
            { chatId, threadId },
            [...history, { role: "user", content: input.message }]
          );
          if (isAIEnabled()) {
            const sessionKey = getSessionIdKey(chatId, threadId);
            runChatIntelligenceAnalysis({
              messages: [...history, { role: "user", content: input.message }],
            })
              .then((signals) =>
                upsertConversationIntelligence(
                  { session_id: sessionKey },
                  { ...signals, message_count: history.length + 1 }
                )
              )
              .catch((err) => console.error("[intelligence] analysis failed:", err));
          }
        }
      : undefined,
    handleChat: async ({
      message,
      chatId = "dashboard-chat",
      threadId,
      history: providedHistory,
      conversationId,
      participantAgentIds,
      mentionedAgentIds,
      leadAgentId: overrideLeadAgentId,
    }) => {
      const history = await getSessionHistory({ chatId, threadId, history: providedHistory });
      const event: MessageEvent = {
        id: randomUUID(),
        channel: "local",
        timestamp: Date.now(),
        text: message,
        from: { userId: "local-user", displayName: "You", isMe: true },
        chat: { chatId, threadId }
      };

      const routing = await router.route(event);
      const effectiveLeadAgentId = overrideLeadAgentId ?? routing.leadAgentId;
      const sessionKey = overrideLeadAgentId
        ? { workspaceId: "ws_local", agentId: overrideLeadAgentId, channel: "local" as const, chatId, threadId }
        : routing.sessionKey;
      const view = routing.viewStack.primary;

      if (/approve-test/i.test(message)) {
        approvals.enqueue({
          agentId: "developer",
          toolName: "fs.write",
          risk: "high",
          args: { path: "drafts/approve-test.md", content: "approval test" },
          reason: "Synthetic approval trigger for dashboard testing",
          environment: "workspace"
        });
      }

      const createDraftMatch = message.match(/^(?:create[- ]draft)\s+(.+)$/i);
      if (createDraftMatch?.[1]) {
        const draftName = createDraftMatch[1].trim();
        const slug = slugify(draftName);
        const draftPath = `drafts/${slug}.md`;
        const routing = await router.route(event);
        try {
          await guardedRunTool({
            name: "fs.write",
            args: {
              path: draftPath,
              content: `# ${draftName}\n\nCreated from chat command.\n`
            },
            agentId: effectiveLeadAgentId,
            sessionKey: routing.sessionKey,
            view: routing.viewStack.primary
          });
        } catch (error) {
          if (error instanceof ApprovalRequiredError) {
            return {
              ok: false,
              agentId: effectiveLeadAgentId,
              summary: "Draft creation paused for approval",
              messages: [error.message],
              toolResults: [
                {
                  toolName: "fs.write",
                  ok: false,
                  error: error.message,
                  data: { approvalId: error.approvalId }
                }
              ]
            };
          }
          throw error;
        }

        await insertTrace(
          {
            id: randomUUID(),
            ts: Date.now(),
            type: "draft-create",
            agentId: effectiveLeadAgentId,
            summary: `Created draft "${draftName}"`,
            data: { draftPath },
          },
          getSessionIdKey(chatId, threadId)
        );

        return {
          ok: true,
          agentId: effectiveLeadAgentId,
          summary: `Created draft "${draftName}" at ${draftPath}`,
          messages: [`Draft written to ${draftPath}`],
          toolResults: [{ toolName: "fs.write", ok: true, data: { path: draftPath } }]
        };
      }

      const createProjectMatch = message.match(
        /^(?:create(?:\s+a)?[- ]project(?:\s+called)?|new project(?:\s+called)?)\s+(.+)$/i
      );
      if (createProjectMatch?.[1]) {
        const projectName = normalizeCommandTarget(createProjectMatch[1]);
        const slug = slugify(projectName);
        const projectBase = `projects/${slug}`;
        const routing = await router.route(event);
        await registry.run("fs.write", {
          path: `${projectBase}/project.md`,
          content: `# project.md\n\n## Name\n${projectName}\n\n## Summary\nScaffolded from Chat. Add a short description and update status as needed.\n\n## Status\nactive\n`
        });
        await registry.run("fs.write", {
          path: `${projectBase}/tasks.md`,
          content: `# tasks.md\n\n## Active\n- [ ] (T-${Date.now().toString().slice(-4)}) Kickoff ${projectName}\n\n## Waiting / Blocked\n\n## Done\n`
        });

        await registry.run("tasks.appendEvent", {
          event: {
            ts: new Date().toISOString(),
            event: "workspace.project.created",
            owner: "agent",
            project: { name: projectName, slug, path: projectBase }
          }
        });
        await dbAppendTaskEvent(
          {
            ts: new Date().toISOString(),
            event: "workspace.project.created",
            owner: "agent",
            project: { name: projectName, slug, path: projectBase },
          },
          getSessionIdKey(chatId, threadId)
        );

        const summary = `Created project "${projectName}" at ${projectBase}`;
        await insertTrace(
          {
            ts: Date.now(),
            type: "project-create",
            agentId: "developer",
            summary,
            data: { projectName, slug },
          },
          getSessionIdKey(chatId, threadId)
        );

        return {
          ok: true,
          agentId: "developer",
          summary,
          messages: [`Project scaffolded at ${projectBase}`],
          toolResults: [{ toolName: "fs.write", ok: true, data: { path: projectBase } }]
        };
      }

      const createTaskMatch = message.match(
        /^(?:create(?:\s+a)?[- ]task(?:\s+called)?|add(?:\s+a)?\s+task(?:\s+called)?)\s+(.+?)(?:\s+in\s+(.+))?$/i
      );
      if (createTaskMatch?.[1]) {
        const title = normalizeCommandTarget(createTaskMatch[1]);
        const projectName = createTaskMatch[2]
          ? normalizeCommandTarget(createTaskMatch[2])
          : undefined;
        const taskId = `T-${Date.now().toString().slice(-6)}`;
        const routing = await router.route(event);

        await registry.run("tasks.appendEvent", {
          event: {
            ts: new Date().toISOString(),
            event: "task.created",
            owner: "agent",
            note: title,
            task: { id: taskId, title, status: "active" },
            ...(projectName
              ? {
                  project: {
                    name: projectName,
                    slug: slugify(projectName),
                  },
                }
              : {}),
          },
        });
        await dbAppendTaskEvent(
          {
            ts: new Date().toISOString(),
            event: "task.created",
            owner: "agent",
            note: title,
            task: { id: taskId, title, status: "active" },
            ...(projectName ? { project: { name: projectName, slug: slugify(projectName) } } : {}),
          },
          getSessionIdKey(chatId, threadId)
        );

        const summary = projectName
          ? `Created task "${title}" in ${projectName}`
          : `Created task "${title}"`;

        await insertTrace(
          {
            ts: Date.now(),
            type: "task-create",
            agentId: effectiveLeadAgentId,
            summary,
            data: {
              taskId,
              title,
              environment: "workspace",
              projectName: projectName ?? null,
            },
          },
          getSessionIdKey(chatId, threadId)
        );

        return {
          ok: true,
          agentId: effectiveLeadAgentId,
          summary,
          messages: [summary],
          toolResults: [
            {
              toolName: "tasks.appendEvent",
              ok: true,
              data: {
                taskId,
                title,
                projectName: projectName ?? null,
              },
            },
          ],
        };
      }

      let result;

      const hasGroupChat = (participantAgentIds?.length ?? 0) > 0 || (mentionedAgentIds?.length ?? 0) > 0;
      const delegateToAgent =
        hasGroupChat
          ? async (agentId: string, delegatedMessage: string, delegatedHistory?: ChatHistoryTurn[]) => {
              const delegateSessionKey = {
                workspaceId: "ws_local" as const,
                agentId,
                channel: "local" as const,
                chatId,
                threadId,
              };
              const delegateResult = await handleAIChat(
                { message: delegatedMessage, history: delegatedHistory ?? history },
                {
                  registry,
                  guardedRunTool: async ({ name, args }) =>
                    guardedRunTool({
                      name,
                      args: name === "memory.search" ? { ...args, identityContext } : args,
                      agentId,
                      sessionKey: delegateSessionKey,
                      view,
                    }),
                  identityContext,
                  leadAgentId: agentId,
                }
              );
              return { summary: delegateResult.summary };
            }
          : undefined;

      if (isAIEnabled()) {
        try {
          result = await handleAIChat(
            { message, history },
            {
              registry,
              guardedRunTool: async ({ name, args }) =>
                guardedRunTool({
                  name,
                  args: name === "memory.search" ? { ...args, identityContext } : args,
                  agentId: effectiveLeadAgentId,
                  sessionKey,
                  view,
                }),
              identityContext,
              leadAgentId: effectiveLeadAgentId,
              participantAgentIds,
              mentionedAgentIds,
              delegateToAgent,
            }
          );
        } catch (aiError) {
          console.error("AI handler error, falling back to keyword dispatch:", aiError);
          result = await runAgentLoop(event, {
            router,
            runTool: async (name, args) => {
              const r = await router.route(event);
              const mergedArgs = name === "memory.search" ? { ...args, identityContext } : args;
              return guardedRunTool({
                name,
                args: mergedArgs,
                agentId: effectiveLeadAgentId,
                sessionKey: r.sessionKey,
                view: r.viewStack.primary,
              });
            }
          });
        }
      } else {
        result = await runAgentLoop(event, {
          router,
          runTool: async (name, args) => {
            const r = await router.route(event);
            const mergedArgs = name === "memory.search" ? { ...args, identityContext } : args;
            return guardedRunTool({
              name,
              args: mergedArgs,
              agentId: effectiveLeadAgentId,
              sessionKey: r.sessionKey,
              view: r.viewStack.primary,
            });
          }
        });
      }

      await insertTrace(
        {
          ts: Date.now(),
          type: "chat",
          agentId: result.agentId,
          summary: result.summary,
          data: { message, toolResults: result.toolResults },
        },
        getSessionIdKey(chatId, threadId)
      );

      await persistSessionHistory(
        { chatId, threadId },
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: result.summary || result.messages?.[0] || "Done." },
        ]
      );

      if (isAIEnabled()) {
        const sessionKey = getSessionIdKey(chatId, threadId);
        const newHistory = [
          ...history,
          { role: "user" as const, content: message },
          { role: "assistant" as const, content: result.summary || result.messages?.[0] || "Done." },
        ];
        runChatIntelligenceAnalysis({ messages: newHistory })
          .then((signals) =>
            upsertConversationIntelligence(
              { session_id: sessionKey },
              { ...signals, message_count: newHistory.length }
            )
          )
          .catch((err) => console.error("[intelligence] analysis failed:", err));
      }

      await persistSessionState({ chatId, threadId });

      return result;
    }
  };
  chatRef.handleChat = runtime.handleChat;
  await startGateway(port, runtime);

  printStartupBanner(port);

  const cliMessage = process.argv.slice(2).join(" ").trim();
  if (cliMessage) {
    await runCliChat(cliMessage, {
      router,
      runTool: async (name, args) =>
        guardedRunTool({
          name,
          args,
          agentId: "orchestrator",
          sessionKey: {
            workspaceId: "ws_local",
            agentId: "orchestrator",
            channel: "cli",
            chatId: "terminal"
          },
          view: defaultPrimary
        })
    });
  }

  const contextPath = path.join(workspaceRoot, "project-context");
  console.log(`Project context: ${contextPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
