import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { StaticRouter } from "@claws/core/router";
import type { WorkflowRun, WorkflowDefinition, TenantConfig } from "@claws/shared/types";
import { resolveTenant } from "./tenantRouter";
import { parseDestination } from "./channelMapping";

export type GatewayRuntime = {
  router?: StaticRouter;
  runTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  handleChat?: (input: {
    message: string;
    chatId?: string;
    threadId?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    conversationId?: string;
    participantAgentIds?: string[];
    mentionedAgentIds?: string[];
    leadAgentId?: string;
  }) => Promise<unknown>;
  handleChatStream?: (
    input: {
      message: string;
      chatId?: string;
      threadId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    },
    res: http.ServerResponse
  ) => Promise<void>;
  listTraces?: (input?: { limit?: number; offset?: number }) => Promise<unknown>;
  listApprovals?: () => Promise<unknown>;
  createMemoryProposal?: (input: { entryId: string }) => Promise<{
    ok: boolean;
    approvalId: string;
    proposedBlock: string;
    entryId: string;
    source: string;
  }>;
  getStatus?: () => Promise<unknown>;
  resolveApproval?: (input: {
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
  }) => Promise<unknown>;
  getViewState?: (input?: {
    channel?: string;
    chatId?: string;
    threadId?: string;
  }) => Promise<unknown>;
  setViewState?: (input: {
    primary: string;
    overlays?: string[];
    channel?: string;
    chatId?: string;
    threadId?: string;
  }) => Promise<unknown>;
  getTaskEvents?: (input?: { limit?: number; offset?: number; view?: string; project_slug?: string }) => Promise<unknown[]>;
  appendTaskEvent?: (input: { event: Record<string, unknown> }) => Promise<unknown>;
  resetState?: () => Promise<unknown>;
  listWorkflows?: () => Promise<WorkflowRun[]>;
  getWorkflow?: (id: string) => Promise<WorkflowRun | undefined>;
  createWorkflow?: (input: {
    definition: WorkflowDefinition;
    agentId: string;
  }) => Promise<WorkflowRun>;
  advanceWorkflowStep?: (input: {
    runId: string;
    stepId: string;
    status: string;
    result?: unknown;
    error?: string;
  }) => Promise<WorkflowRun | undefined>;
  pauseWorkflow?: (id: string) => Promise<WorkflowRun | undefined>;
  resumeWorkflow?: (id: string) => Promise<WorkflowRun | undefined>;
  cancelWorkflow?: (id: string) => Promise<WorkflowRun | undefined>;
  listTenants?: () => TenantConfig[];
  getTenant?: (idOrSlug: string) => TenantConfig | undefined;
  registerTenant?: (config: TenantConfig) => void;
  scanProjects?: (input?: { project_slug?: string }) => Promise<Array<{
    name: string;
    slug: string;
    path: string;
    status?: string;
    hasProjectMd: boolean;
    hasTasksMd: boolean;
  }>>;
  listConversations?: (filter?: { type?: string; project_slug?: string; channel_slug?: string; limit?: number; offset?: number }) => Promise<unknown[]>;
  createConversation?: (body: { type: string; title?: string; project_slug?: string; channel_slug?: string; tags?: string[] }) => Promise<unknown>;
  getConversation?: (id: string) => Promise<unknown | null>;
  getConversationMessages?: (id: string, limit?: number) => Promise<unknown[]>;
  addConversationMessage?: (id: string, body: { role: "user" | "assistant"; content: string }) => Promise<unknown>;
  postConversationMessage?: (id: string, body: { message: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) => Promise<unknown>;
  getChatIntelligence?: (chatId: string, threadId?: string) => Promise<unknown | null>;
  getConversationIntelligence?: (conversationId: string) => Promise<unknown | null>;
  listChannels?: () => Promise<unknown[]>;
  createChannel?: (body: { channel_slug: string; title?: string }) => Promise<unknown>;
  getConversationAgents?: (conversationId: string) => Promise<unknown[]>;
  addConversationAgent?: (conversationId: string, body: { agent_id: string; role?: string; pinned?: boolean }) => Promise<unknown>;
  removeConversationAgent?: (conversationId: string, agentId: string) => Promise<unknown>;
  /** Channel mapping: external id -> "#channel-slug" or "project:project-slug" for inbound routing */
  inboundMappings?: { telegram: Map<string, string>; slack: Map<string, string> };
  /** Resolve destination to conversation id (used by inbound handlers) */
  getOrCreateConversationForDestination?: (params: { type: "channel" | "project"; slug: string }) => Promise<{ id: string } | null>;
  /** Unified live state for a session (traces, approvals, tools, workflows, etc.) */
  getSessionLiveState?: (chatId: string, threadId?: string) => Promise<unknown>;
  // Proactivity Engine
  listProactiveJobs?: (status?: "active" | "paused") => Promise<unknown[]>;
  getProactiveJob?: (id: string) => Promise<unknown | null>;
  createProactiveJob?: (body: {
    kind: string;
    name: string;
    scheduleCron?: string | null;
    intervalSec?: number | null;
    config?: Record<string, unknown>;
    modelTier?: string;
    conversationId?: string | null;
    projectSlug?: string | null;
  }) => Promise<unknown>;
  pauseProactiveJob?: (id: string) => Promise<unknown | null>;
  resumeProactiveJob?: (id: string) => Promise<unknown | null>;
  runProactiveJobNow?: (id: string) => Promise<unknown>;
  listProactiveNotifications?: (opts?: { unreadOnly?: boolean; limit?: number }) => Promise<unknown[]>;
  listProactiveRuns?: (jobId?: string, limit?: number) => Promise<unknown[]>;
  markProactiveNotificationRead?: (id: string) => Promise<void>;
  listTriggerEvents?: (limit?: number, offset?: number) => Promise<unknown[]>;
  listAttentionDecisions?: (limit?: number, offset?: number) => Promise<unknown[]>;
  getAttentionBudgetConfig?: () => Promise<unknown>;
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "access-control-max-age": "86400",
};

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    // Invalid JSON (e.g. client sent object without stringifying -> "[object Object]").
    // Return null so routes treat as missing body and return 400 where appropriate.
    return null;
  }
}

export async function startGateway(port: number, runtime?: GatewayRuntime): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) return json(res, 400, { ok: false, error: "Invalid request" });
      const requestUrl = new URL(req.url, "http://localhost");
      const pathname = requestUrl.pathname;
      if (req.method === "OPTIONS") {
        res.writeHead(204, { ...CORS_HEADERS });
        res.end();
        return;
      }

      const tenant = resolveTenant(req);

      if (pathname === "/health" && req.method === "GET") {
        return json(res, 200, { ok: true, service: "claws-gateway", tenant: tenant.slug });
      }

      if (pathname === "/api/status" && req.method === "GET") {
        const status = await runtime?.getStatus?.();
        return json(res, 200, {
          ok: true,
          status: {
            ...(status ?? { gateway: "online", mode: "local-first" }),
            tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
          }
        });
      }

      if (pathname === "/api/env" && req.method === "GET") {
        const ENV_KEYS = [
          { key: "AI_GATEWAY_API_KEY", group: "AI", sensitive: true, desc: "Primary API key for Vercel AI Gateway routing" },
          { key: "OPENAI_API_KEY", group: "AI", sensitive: true, desc: "Fallback key for direct OpenAI routing" },
          { key: "ANTHROPIC_API_KEY", group: "AI", sensitive: true, desc: "Fallback key for direct Anthropic routing" },
          { key: "AI_MODEL", group: "AI", sensitive: false, desc: "Model name (default: gpt-4o-mini)" },
          { key: "AI_GATEWAY_URL", group: "AI", sensitive: false, desc: "Custom AI Gateway URL (optional)" },
          { key: "OPENROUTER_API_KEY", group: "AI", sensitive: true, desc: "OpenRouter API key for multi-model routing" },
          { key: "V0_API_KEY", group: "AI", sensitive: true, desc: "V0 Platform API key" },
          { key: "CLAWS_PORT", group: "Runtime", sensitive: false, desc: "Gateway port (default: 4317)" },
          { key: "DASHBOARD_PORT", group: "Runtime", sensitive: false, desc: "Dashboard port (default: 4318)" },
          { key: "CLAWS_DEFAULT_VIEW", group: "Runtime", sensitive: false, desc: "Default primary view (default: founder)" },
          { key: "CLAWS_BROWSER_PROVIDER", group: "Execution", sensitive: false, desc: "Browser provider (agent-browser | playwright | native)" },
          { key: "CLAWS_BROWSER_DEFAULT_MODE", group: "Execution", sensitive: false, desc: "Default visibility mode" },
          { key: "CLAWS_SANDBOX_ENABLED", group: "Execution", sensitive: false, desc: "Enable sandbox execution (true | false)" },
          { key: "CLAWS_SANDBOX_PROVIDER", group: "Execution", sensitive: false, desc: "Sandbox provider (vercel | local | none)" },
          { key: "AGENT_BROWSER_NATIVE", group: "Execution", sensitive: false, desc: "Use native Agent Browser (1 | 0)" },
          { key: "VERCEL_PROJECT_ID", group: "Hosting", sensitive: false, desc: "Vercel project ID for workflow/sandbox adapters" },
          { key: "VERCEL_API_TOKEN", group: "Hosting", sensitive: true, desc: "Vercel API token for hosted adapters" },
          { key: "TELEGRAM_BOT_TOKEN", group: "Integrations", sensitive: true, desc: "Telegram bot token for inbound channel" },
        ];
        const vars = ENV_KEYS.map((v) => {
          const raw = process.env[v.key];
          const isSet = raw !== undefined && raw !== "";
          let redacted: string | null = null;
          if (isSet && raw) {
            if (v.sensitive) {
              redacted = raw.length > 8 ? raw.slice(0, 4) + "••••" + raw.slice(-4) : "••••••••";
            } else {
              redacted = raw;
            }
          }
          return { ...v, isSet, redacted };
        });
        return json(res, 200, { ok: true, vars });
      }

      if (pathname === "/api/env/raw" && req.method === "GET") {
        const wsRoot = process.env.CLAWS_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..", "..");
        const envPath = path.join(wsRoot, ".env.local");
        try {
          const fs = await import("node:fs/promises");
          const content = await fs.readFile(envPath, "utf-8");
          return json(res, 200, { ok: true, content });
        } catch {
          return json(res, 200, { ok: true, content: "" });
        }
      }

      if (pathname === "/api/env" && req.method === "POST") {
        const body = await readBody(req);
        const { content } = body as { content?: string };
        if (typeof content !== "string") return json(res, 400, { ok: false, error: "content required" });
        const wsRoot = process.env.CLAWS_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..", "..");
        const envPath = path.join(wsRoot, ".env.local");
        const backupPath = path.join(wsRoot, ".env.local.bak");
        try {
          const fs = await import("node:fs/promises");
          try { await fs.copyFile(envPath, backupPath); } catch {}
          await fs.writeFile(envPath, content, "utf-8");
          return json(res, 200, { ok: true, message: "Saved .env.local (backup at .env.local.bak)" });
        } catch (err) {
          return json(res, 500, { ok: false, error: err instanceof Error ? err.message : "Write failed" });
        }
      }

      if (pathname === "/api/restart" && req.method === "POST") {
        json(res, 200, { ok: true, message: "Restarting gateway..." });
        setTimeout(() => process.exit(0), 200);
        return;
      }

      if (pathname === "/api/cli/open" && req.method === "POST") {
        const body = (await readBody(req)) as { command?: string } | null;
        const cmd = body?.command ?? "tui";
        const wsRoot = process.env.CLAWS_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..", "..");
        const cliPath = path.join(wsRoot, "packages/cli/bin/claws.mjs");
        try {
          const { exec } = await import("node:child_process");
          const platform = process.platform;
          let termCmd: string;
          if (platform === "darwin") {
            termCmd = `osascript -e 'tell application "Terminal" to do script "cd ${wsRoot} && node ${cliPath} ${cmd}"'`;
          } else if (platform === "linux") {
            termCmd = `x-terminal-emulator -e "cd ${wsRoot} && node ${cliPath} ${cmd}" &`;
          } else {
            termCmd = `start cmd /k "cd /d ${wsRoot} && node ${cliPath} ${cmd}"`;
          }
          exec(termCmd, (err) => {
            if (err) console.warn("CLI launch warning:", err.message);
          });
          return json(res, 200, { ok: true, message: `Opening Claws ${cmd}…`, command: termCmd });
        } catch (err) {
          return json(res, 500, { ok: false, error: err instanceof Error ? err.message : "Launch failed" });
        }
      }

      if (pathname === "/api/system/info" && req.method === "GET") {
        const wsRoot = process.env.CLAWS_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..", "..");
        const fs = await import("node:fs/promises");

        let currentVersion = "0.1.0";
        try {
          const pkg = JSON.parse(await fs.readFile(path.join(wsRoot, "package.json"), "utf-8"));
          currentVersion = pkg.version ?? currentVersion;
        } catch {}

        let dashboardModified = false;
        try {
          const stat = await fs.stat(path.join(wsRoot, ".claws/dashboard-custom"));
          dashboardModified = stat.isFile() || stat.isDirectory();
        } catch {
          try {
            const cp = await import("node:child_process");
            const gitOut = await new Promise<string>((resolve, reject) => {
              cp.exec("git diff --name-only HEAD -- apps/dashboard/", { cwd: wsRoot }, (err, stdout) => {
                if (err) reject(err); else resolve(stdout);
              });
            });
            dashboardModified = gitOut.trim().length > 0;
          } catch { dashboardModified = false; }
        }

        let cloudSyncEnabled = true;
        try {
          const syncPref = await fs.readFile(path.join(wsRoot, ".claws/sync-disabled"), "utf-8").catch(() => null);
          if (syncPref !== null) cloudSyncEnabled = false;
        } catch {}

        let latestVersion: string | null = null;
        try {
          const npmRes = await fetch("https://registry.npmjs.org/@claws-so/cli/latest", {
            signal: AbortSignal.timeout(3000),
          });
          if (npmRes.ok) {
            const data = (await npmRes.json()) as { version?: string };
            latestVersion = data.version ?? null;
          }
        } catch {}

        return json(res, 200, {
          ok: true,
          version: currentVersion,
          latestVersion,
          updateAvailable: latestVersion != null && latestVersion !== currentVersion,
          cloudSync: {
            enabled: cloudSyncEnabled,
            lastSynced: null,
            status: cloudSyncEnabled ? "idle" : "disabled",
          },
          dashboard: {
            isCustom: dashboardModified,
            templateVersion: currentVersion,
          },
        });
      }

      if (pathname === "/api/system/cloud-sync" && req.method === "POST") {
        const body = (await readBody(req)) as { enabled?: boolean } | null;
        const wsRoot = process.env.CLAWS_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..", "..");
        const fs = await import("node:fs/promises");
        const marker = path.join(wsRoot, ".claws/sync-disabled");
        try {
          if (body?.enabled === false) {
            await fs.mkdir(path.join(wsRoot, ".claws"), { recursive: true });
            await fs.writeFile(marker, "Cloud sync disabled by user", "utf-8");
            return json(res, 200, { ok: true, enabled: false });
          } else {
            await fs.rm(marker, { force: true });
            return json(res, 200, { ok: true, enabled: true });
          }
        } catch (err) {
          return json(res, 500, { ok: false, error: err instanceof Error ? err.message : "Failed" });
        }
      }

      if (pathname === "/api/traces" && req.method === "GET") {
        const limit = Number(requestUrl.searchParams.get("limit") ?? 120);
        const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
        const traces = await runtime?.listTraces?.({ limit, offset });
        return json(res, 200, { ok: true, traces: traces ?? [] });
      }

      if (pathname === "/api/approvals" && req.method === "GET") {
        const approvals = await runtime?.listApprovals?.();
        return json(res, 200, { ok: true, approvals: approvals ?? [] });
      }

      if (pathname === "/api/memory/propose" && req.method === "POST") {
        const body = (await readBody(req)) as { entryId?: string } | null;
        if (!body?.entryId || typeof body.entryId !== "string") {
          return json(res, 400, { ok: false, error: "Missing entryId" });
        }
        try {
          const result = await runtime?.createMemoryProposal?.({ entryId: body.entryId.trim() });
          return json(res, 200, { ok: true, ...result });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Propose failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      if (pathname.startsWith("/api/approvals/") && pathname.endsWith("/resolve") && req.method === "POST") {
        const requestId = pathname.split("/")[3];
        const body = (await readBody(req)) as {
          decision?: "approved" | "denied";
          note?: string;
          grant?: unknown;
        } | null;

        if (!requestId) return json(res, 400, { ok: false, error: "Missing request id" });
        if (!body?.decision) return json(res, 400, { ok: false, error: "Missing approval decision" });

        const result = await runtime?.resolveApproval?.({
          requestId,
          decision: body.decision,
          note: body.note,
          grant: body.grant as any
        });

        return json(res, 200, { ok: true, result: result ?? null });
      }

      if (pathname === "/api/view-state" && req.method === "GET") {
        const state = await runtime?.getViewState?.({
          channel: requestUrl.searchParams.get("channel") ?? "local",
          chatId: requestUrl.searchParams.get("chatId") ?? "dashboard-chat",
          threadId: requestUrl.searchParams.get("threadId") ?? undefined,
        } as any);
        return json(res, 200, { ok: true, state: state ?? null });
      }

      if (pathname === "/api/view-state" && req.method === "POST") {
        const body = (await readBody(req)) as {
          primary?: string;
          overlays?: string[];
          channel?: string;
          chatId?: string;
          threadId?: string;
        } | null;

        if (!body?.primary) return json(res, 400, { ok: false, error: "Missing primary view" });

        const result = await runtime?.setViewState?.({
          primary: body.primary,
          overlays: body.overlays ?? [],
          channel: body.channel ?? "local",
          chatId: body.chatId ?? "dashboard-chat",
          threadId: body.threadId
        });

        return json(res, 200, { ok: true, result: result ?? null });
      }

      if (pathname === "/api/tasks/events" && req.method === "GET") {
        const limit = Number(requestUrl.searchParams.get("limit") ?? 120);
        const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
        const view = requestUrl.searchParams.get("view") ?? undefined;
        const project_slug = requestUrl.searchParams.get("project_slug") ?? undefined;
        const events = await runtime?.getTaskEvents?.({ limit, offset, view, project_slug });
        return json(res, 200, { ok: true, events: events ?? [] });
      }

      if (pathname === "/api/tasks/events" && req.method === "POST") {
        const body = (await readBody(req)) as { event?: Record<string, unknown> } | null;
        if (!body?.event || typeof body.event !== "object") {
          return json(res, 400, { ok: false, error: "Missing event payload" });
        }

        const result = await runtime?.appendTaskEvent?.({ event: body.event });
        return json(res, 200, { ok: true, result: result ?? { ok: true } });
      }

      if (pathname === "/api/tasks/create" && req.method === "POST") {
        const body = (await readBody(req)) as {
          task?: string;
          section?: string;
          priority?: string;
          owner?: string;
        } | null;
        if (!body?.task || typeof body.task !== "string") {
          return json(res, 400, { ok: false, error: "Missing task description" });
        }
        try {
          const result = (await runtime?.runTool?.("tasks.createTask", {
            task: body.task,
            section: body.section ?? "Build queue",
            priority: body.priority ?? "P2",
            owner: body.owner ?? "human",
          })) as { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | undefined;
          if (result?.ok && result?.event) {
            await runtime?.appendTaskEvent?.({ event: result.event });
          }
          return json(res, 200, { ok: true, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Create task failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      if (pathname === "/api/tasks/update" && req.method === "POST") {
        const body = (await readBody(req)) as {
          taskId?: string;
          patch?: Record<string, string>;
        } | null;
        if (!body?.taskId || !body?.patch || typeof body.patch !== "object") {
          return json(res, 400, { ok: false, error: "Missing taskId or patch" });
        }
        try {
          const result = (await runtime?.runTool?.("tasks.updateTask", {
            taskId: body.taskId,
            patch: body.patch,
          })) as { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | undefined;
          if (result?.ok && result?.event) {
            await runtime?.appendTaskEvent?.({ event: result.event });
          }
          return json(res, 200, { ok: true, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Update task failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      if (pathname === "/api/tasks/move" && req.method === "POST") {
        const body = (await readBody(req)) as {
          taskId?: string;
          status?: string;
          targetSection?: string;
        } | null;
        if (!body?.taskId) {
          return json(res, 400, { ok: false, error: "Missing taskId" });
        }
        try {
          const result = (await runtime?.runTool?.("tasks.moveTask", {
            taskId: body.taskId,
            status: body.status,
            targetSection: body.targetSection,
          })) as { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | undefined;
          if (result?.ok && result?.event) {
            await runtime?.appendTaskEvent?.({ event: result.event });
          }
          return json(res, 200, { ok: true, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Move task failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      if (pathname === "/api/tasks/complete" && req.method === "POST") {
        const body = (await readBody(req)) as { taskId?: string } | null;
        if (!body?.taskId) {
          return json(res, 400, { ok: false, error: "Missing taskId" });
        }
        try {
          const result = (await runtime?.runTool?.("tasks.completeTask", {
            taskId: body.taskId,
          })) as { ok?: boolean; taskId?: string; task?: unknown; event?: Record<string, unknown> } | undefined;
          if (result?.ok && result?.event) {
            await runtime?.appendTaskEvent?.({ event: result.event });
          }
          return json(res, 200, { ok: true, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Complete task failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      if (pathname === "/api/test/reset" && req.method === "POST") {
        const result = await runtime?.resetState?.();
        return json(res, 200, { ok: true, result: result ?? { ok: true } });
      }

      if (pathname === "/api/chat/stream" && req.method === "POST") {
        const body = (await readBody(req)) as {
          message?: string;
          chatId?: string;
          threadId?: string;
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        } | null;
        const message = body?.message?.trim();
        if (!message) return json(res, 400, { ok: false, error: "Missing message" });

        if (runtime?.handleChatStream) {
          await runtime.handleChatStream({
            message,
            chatId: body?.chatId,
            threadId: body?.threadId,
            history: body?.history,
          }, res);
          return;
        }
        return json(res, 501, { ok: false, error: "Streaming not available (no API key configured)" });
      }

      if (pathname === "/api/chat" && req.method === "POST") {
        const body = (await readBody(req)) as {
          message?: string;
          chatId?: string;
          threadId?: string;
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        } | null;
        const message = body?.message?.trim();
        if (!message) return json(res, 400, { ok: false, error: "Missing message" });

        const result = await runtime?.handleChat?.({
          message,
          chatId: body?.chatId,
          threadId: body?.threadId,
          history: body?.history,
        });
        return json(res, 200, {
          ok: true,
          result: result ?? { summary: "No runtime handler attached yet." }
        });
      }

      // Workflow routes
      if (pathname === "/api/workflows" && req.method === "GET") {
        const workflows = await runtime?.listWorkflows?.();
        return json(res, 200, { ok: true, workflows: workflows ?? [] });
      }

      if (pathname === "/api/workflows" && req.method === "POST") {
        const body = (await readBody(req)) as {
          definition?: WorkflowDefinition;
          agentId?: string;
        } | null;
        if (!body?.definition) return json(res, 400, { ok: false, error: "Missing workflow definition" });
        const run = await runtime?.createWorkflow?.({
          definition: body.definition,
          agentId: body.agentId ?? "orchestrator",
        });
        return json(res, 200, { ok: true, workflow: run });
      }

      if (pathname.startsWith("/api/workflows/") && req.method === "GET") {
        const id = pathname.split("/")[3];
        if (!id) return json(res, 400, { ok: false, error: "Missing workflow id" });
        const run = await runtime?.getWorkflow?.(id);
        if (!run) return json(res, 404, { ok: false, error: "Workflow not found" });
        return json(res, 200, { ok: true, workflow: run });
      }

      if (pathname.startsWith("/api/workflows/") && pathname.endsWith("/advance") && req.method === "POST") {
        const id = pathname.split("/")[3];
        const body = (await readBody(req)) as {
          stepId?: string;
          status?: string;
          result?: unknown;
          error?: string;
        } | null;
        if (!id || !body?.stepId || !body?.status) {
          return json(res, 400, { ok: false, error: "Missing runId, stepId, or status" });
        }
        const run = await runtime?.advanceWorkflowStep?.({
          runId: id,
          stepId: body.stepId,
          status: body.status,
          result: body.result,
          error: body.error,
        });
        return json(res, 200, { ok: true, workflow: run ?? null });
      }

      if (pathname.startsWith("/api/workflows/") && pathname.endsWith("/pause") && req.method === "POST") {
        const id = pathname.split("/")[3];
        const run = await runtime?.pauseWorkflow?.(id);
        return json(res, 200, { ok: true, workflow: run ?? null });
      }

      if (pathname.startsWith("/api/workflows/") && pathname.endsWith("/resume") && req.method === "POST") {
        const id = pathname.split("/")[3];
        const run = await runtime?.resumeWorkflow?.(id);
        return json(res, 200, { ok: true, workflow: run ?? null });
      }

      if (pathname.startsWith("/api/workflows/") && pathname.endsWith("/cancel") && req.method === "POST") {
        const id = pathname.split("/")[3];
        const run = await runtime?.cancelWorkflow?.(id);
        return json(res, 200, { ok: true, workflow: run ?? null });
      }

      // Tenant management routes
      if (pathname === "/api/tenants" && req.method === "GET") {
        const tenants = runtime?.listTenants?.() ?? [];
        return json(res, 200, { ok: true, tenants });
      }

      if (pathname === "/api/tenants" && req.method === "POST") {
        const body = (await readBody(req)) as Partial<TenantConfig> | null;
        if (!body?.slug || !body?.name) {
          return json(res, 400, { ok: false, error: "Missing slug or name" });
        }
        const config: TenantConfig = {
          id: body.id ?? `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          slug: body.slug,
          name: body.name,
          subdomain: body.subdomain,
          customDomain: body.customDomain,
          workspaceRoot: body.workspaceRoot ?? process.cwd(),
          createdAt: Date.now(),
        };
        runtime?.registerTenant?.(config);
        return json(res, 200, { ok: true, tenant: config });
      }

      if (pathname.startsWith("/api/tenants/") && req.method === "GET") {
        const idOrSlug = pathname.split("/")[3];
        if (!idOrSlug) return json(res, 400, { ok: false, error: "Missing tenant id" });
        const tenant = runtime?.getTenant?.(idOrSlug);
        if (!tenant) return json(res, 404, { ok: false, error: "Tenant not found" });
        return json(res, 200, { ok: true, tenant });
      }

      // Conversations API
      if (pathname === "/api/conversations" && req.method === "GET") {
        const type = requestUrl.searchParams.get("type") ?? undefined;
        const project_slug = requestUrl.searchParams.get("project_slug") ?? undefined;
        const channel_slug = requestUrl.searchParams.get("channel_slug") ?? undefined;
        const limit = Number(requestUrl.searchParams.get("limit") ?? 50);
        const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
        const list = await runtime?.listConversations?.({ type: type ?? undefined, project_slug, channel_slug, limit, offset });
        return json(res, 200, { ok: true, conversations: list ?? [] });
      }

      if (pathname === "/api/conversations" && req.method === "POST") {
        const body = (await readBody(req)) as {
          type?: string;
          title?: string;
          project_slug?: string;
          channel_slug?: string;
          tags?: string[];
        } | null;
        if (!body?.type || !["session", "project", "channel", "agent"].includes(body.type)) {
          return json(res, 400, { ok: false, error: "Missing or invalid type (session|project|channel|agent)" });
        }
        try {
          const conv = await runtime?.createConversation?.({
            type: body.type,
            title: body.title ?? "",
            project_slug: body.project_slug,
            channel_slug: body.channel_slug,
            tags: body.tags,
          });
          return json(res, 200, { ok: true, conversation: conv ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Create conversation failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      const convIdMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
      if (convIdMatch && req.method === "GET") {
        const id = decodeURIComponent(convIdMatch[1]);
        const conv = await runtime?.getConversation?.(id);
        if (!conv) return json(res, 404, { ok: false, error: "Conversation not found" });
        return json(res, 200, { ok: true, conversation: conv });
      }

      const convMessagesMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
      if (convMessagesMatch && req.method === "GET") {
        const conversationId = decodeURIComponent(convMessagesMatch[1]);
        const limit = Number(requestUrl.searchParams.get("limit") ?? 100);
        const messages = await runtime?.getConversationMessages?.(conversationId, limit);
        return json(res, 200, { ok: true, messages: messages ?? [] });
      }

      const convMessageMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/message$/);
      if (convMessageMatch && req.method === "POST") {
        const conversationId = decodeURIComponent(convMessageMatch[1]);
        const body = (await readBody(req)) as {
          message?: string;
          role?: "user" | "assistant";
          content?: string;
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        } | null;
        const message = body?.message ?? body?.content;
        const trimmed = typeof message === "string" ? message.trim() : "";
        if (!trimmed) return json(res, 400, { ok: false, error: "Missing message or content" });
        try {
          if (runtime?.postConversationMessage) {
            const result = await runtime.postConversationMessage(conversationId, {
              message: trimmed,
              history: body?.history,
            });
            return json(res, 200, { ok: true, result: result ?? null });
          }
          await runtime?.addConversationMessage?.(conversationId, {
            role: body?.role ?? "user",
            content: trimmed,
          });
          return json(res, 200, { ok: true, result: { appended: true } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Send message failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      // Inbound Telegram: route by mapping to conversation, post message, return agent reply
      if (pathname === "/api/inbound/telegram" && req.method === "POST") {
        const body = (await readBody(req)) as {
          message?: { chat?: { id?: number }; text?: string; message_thread_id?: number };
          [key: string]: unknown;
        } | null;
        const chatId = body?.message?.chat?.id;
        const text = typeof body?.message?.text === "string" ? body.message.text.trim() : "";
        if (chatId == null || !text) {
          return json(res, 400, { ok: false, error: "Missing message.chat.id or message.text" });
        }
        const threadId = body?.message?.message_thread_id;
        const mappingKey = threadId != null ? `${chatId}_${threadId}` : String(chatId);
        const mapsTo = runtime?.inboundMappings?.telegram?.get(mappingKey) ?? runtime?.inboundMappings?.telegram?.get(String(chatId));
        if (!mapsTo) {
          return json(res, 404, { ok: false, error: "No mapping for this Telegram chat or topic" });
        }
        const dest = parseDestination(mapsTo);
        if (!dest) {
          return json(res, 400, { ok: false, error: "Invalid maps_to destination" });
        }
        try {
          const conv = await runtime?.getOrCreateConversationForDestination?.({ type: dest.type, slug: dest.slug });
          if (!conv) return json(res, 503, { ok: false, error: "Conversation resolution not available" });
          const result = await runtime?.postConversationMessage?.(conv.id, { message: text });
          return json(res, 200, { ok: true, conversationId: conv.id, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Inbound Telegram failed";
          return json(res, 500, { ok: false, error: msg });
        }
      }

      // Inbound Slack: route by mapping to conversation, post message, return agent reply
      if (pathname === "/api/inbound/slack" && req.method === "POST") {
        const body = (await readBody(req)) as { event?: { channel?: string; text?: string; type?: string }; [key: string]: unknown } | null;
        const channelId = body?.event?.channel;
        const text = typeof body?.event?.text === "string" ? body.event.text.trim() : "";
        if (!channelId || !text) {
          return json(res, 400, { ok: false, error: "Missing event.channel or event.text" });
        }
        if (body?.type === "url_verification" && typeof (body as { challenge?: string }).challenge === "string") {
          return json(res, 200, { challenge: (body as { challenge: string }).challenge });
        }
        const mapsTo = runtime?.inboundMappings?.slack?.get(channelId);
        if (!mapsTo) {
          return json(res, 404, { ok: false, error: "No mapping for this Slack channel" });
        }
        const dest = parseDestination(mapsTo);
        if (!dest) {
          return json(res, 400, { ok: false, error: "Invalid maps_to destination" });
        }
        try {
          const conv = await runtime?.getOrCreateConversationForDestination?.({ type: dest.type, slug: dest.slug });
          if (!conv) return json(res, 503, { ok: false, error: "Conversation resolution not available" });
          const result = await runtime?.postConversationMessage?.(conv.id, { message: text });
          return json(res, 200, { ok: true, conversationId: conv.id, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Inbound Slack failed";
          return json(res, 500, { ok: false, error: msg });
        }
      }

      if (pathname === "/api/chat/intelligence" && req.method === "GET") {
        const chatId = requestUrl.searchParams.get("chatId") ?? undefined;
        const threadId = requestUrl.searchParams.get("threadId") ?? undefined;
        if (!chatId) return json(res, 400, { ok: false, error: "Missing chatId" });
        const intel = await runtime?.getChatIntelligence?.(chatId, threadId);
        return json(res, 200, { ok: true, intelligence: intel ?? null });
      }

      if (pathname === "/api/live-state" && req.method === "GET") {
        const chatId = requestUrl.searchParams.get("chatId") ?? undefined;
        const threadId = requestUrl.searchParams.get("threadId") ?? undefined;
        if (!chatId) return json(res, 400, { ok: false, error: "Missing chatId" });
        try {
          const state = await runtime?.getSessionLiveState?.(chatId, threadId ?? undefined);
          return json(res, 200, { ok: true, state: state ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Live state failed";
          return json(res, 500, { ok: false, error: msg });
        }
      }

      const convIntelligenceMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/intelligence$/);
      if (convIntelligenceMatch && req.method === "GET") {
        const conversationId = decodeURIComponent(convIntelligenceMatch[1]);
        const intel = await runtime?.getConversationIntelligence?.(conversationId);
        return json(res, 200, { ok: true, intelligence: intel ?? null });
      }

      if (pathname === "/api/channels" && req.method === "GET") {
        const channels = await runtime?.listChannels?.();
        return json(res, 200, { ok: true, channels: channels ?? [] });
      }

      if (pathname === "/api/channels" && req.method === "POST") {
        const body = (await readBody(req)) as { channel_slug?: string; title?: string } | null;
        const slug = body?.channel_slug?.trim();
        if (!slug) return json(res, 400, { ok: false, error: "Missing channel_slug" });
        try {
          const channel = await runtime?.createChannel?.({ channel_slug: slug, title: body?.title });
          return json(res, 200, { ok: true, channel: channel ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Create channel failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      const convAgentsMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/agents$/);
      if (convAgentsMatch && req.method === "GET") {
        const conversationId = decodeURIComponent(convAgentsMatch[1]);
        const agents = await runtime?.getConversationAgents?.(conversationId);
        return json(res, 200, { ok: true, agents: agents ?? [] });
      }

      if (convAgentsMatch && req.method === "POST") {
        const conversationId = decodeURIComponent(convAgentsMatch[1]);
        const body = (await readBody(req)) as { agent_id?: string; role?: string; pinned?: boolean } | null;
        if (!body?.agent_id) return json(res, 400, { ok: false, error: "Missing agent_id" });
        try {
          await runtime?.addConversationAgent?.(conversationId, {
            agent_id: body.agent_id,
            role: body.role,
            pinned: body.pinned,
          });
          return json(res, 200, { ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Add agent failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      const convAgentRemoveMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/agents\/([^/]+)$/);
      if (convAgentRemoveMatch && req.method === "DELETE") {
        const conversationId = decodeURIComponent(convAgentRemoveMatch[1]);
        const agentId = decodeURIComponent(convAgentRemoveMatch[2]);
        try {
          await runtime?.removeConversationAgent?.(conversationId, agentId);
          return json(res, 200, { ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Remove agent failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      // Direct tool execution (non-chat pipeline, for dashboard tool calls)
      if (pathname === "/api/tools/run" && req.method === "POST") {
        const body = (await readBody(req)) as {
          name?: string;
          args?: Record<string, unknown>;
        } | null;
        if (!body?.name) return json(res, 400, { ok: false, error: "Missing tool name" });
        try {
          const result = await runtime?.runTool?.(body.name, body.args ?? {});
          return json(res, 200, { ok: true, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Tool execution failed";
          return json(res, 200, { ok: false, error: msg });
        }
      }

      // Proactivity: jobs and notifications
      if (pathname === "/api/proactive/jobs" && req.method === "GET") {
        const status = requestUrl.searchParams.get("status") as "active" | "paused" | undefined;
        const jobs = await runtime?.listProactiveJobs?.(status);
        return json(res, 200, { ok: true, jobs: jobs ?? [] });
      }

      if (pathname === "/api/proactive/jobs" && req.method === "POST") {
        const body = (await readBody(req)) as {
          kind?: string;
          name?: string;
          scheduleCron?: string | null;
          intervalSec?: number | null;
          config?: Record<string, unknown>;
          modelTier?: string;
          conversationId?: string | null;
          projectSlug?: string | null;
        } | null;
        if (!body?.kind || !body?.name) return json(res, 400, { ok: false, error: "Missing kind or name" });
        try {
          const job = await runtime?.createProactiveJob?.({
            kind: body.kind,
            name: body.name,
            scheduleCron: body.scheduleCron ?? null,
            intervalSec: body.intervalSec ?? null,
            config: body.config,
            modelTier: body.modelTier,
            conversationId: body.conversationId ?? null,
            projectSlug: body.projectSlug ?? null,
          });
          return json(res, 200, { ok: true, job: job ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Create job failed";
          return json(res, 400, { ok: false, error: msg });
        }
      }

      if (pathname.startsWith("/api/proactive/jobs/") && req.method === "GET") {
        const id = pathname.split("/")[4];
        if (!id) return json(res, 400, { ok: false, error: "Missing job id" });
        const job = await runtime?.getProactiveJob?.(id);
        if (!job) return json(res, 404, { ok: false, error: "Job not found" });
        return json(res, 200, { ok: true, job });
      }

      if (pathname.startsWith("/api/proactive/jobs/") && pathname.endsWith("/pause") && req.method === "POST") {
        const id = pathname.split("/")[4];
        const job = await runtime?.pauseProactiveJob?.(id);
        return json(res, 200, { ok: true, job: job ?? null });
      }

      if (pathname.startsWith("/api/proactive/jobs/") && pathname.endsWith("/resume") && req.method === "POST") {
        const id = pathname.split("/")[4];
        const job = await runtime?.resumeProactiveJob?.(id);
        return json(res, 200, { ok: true, job: job ?? null });
      }

      if (pathname.startsWith("/api/proactive/jobs/") && pathname.endsWith("/run") && req.method === "POST") {
        const id = pathname.split("/")[4];
        try {
          const result = await runtime?.runProactiveJobNow?.(id);
          return json(res, 200, { ok: true, result: result ?? null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Run job failed";
          return json(res, 500, { ok: false, error: msg });
        }
      }

      if (pathname === "/api/proactive/notifications" && req.method === "GET") {
        const unreadOnly = requestUrl.searchParams.get("unreadOnly") === "true";
        const limit = Number(requestUrl.searchParams.get("limit") ?? 50);
        const notifications = await runtime?.listProactiveNotifications?.({ unreadOnly, limit });
        return json(res, 200, { ok: true, notifications: notifications ?? [] });
      }

      if (pathname.startsWith("/api/proactive/notifications/") && pathname.endsWith("/read") && req.method === "POST") {
        const id = pathname.split("/")[4];
        await runtime?.markProactiveNotificationRead?.(id);
        return json(res, 200, { ok: true });
      }

      if (pathname === "/api/proactive/runs" && req.method === "GET") {
        const jobId = requestUrl.searchParams.get("jobId") ?? undefined;
        const limit = Number(requestUrl.searchParams.get("limit") ?? 50);
        const runs = await runtime?.listProactiveRuns?.(jobId, limit);
        return json(res, 200, { ok: true, runs: runs ?? [] });
      }

      if (pathname === "/api/proactive/triggers" && req.method === "GET") {
        const limit = Number(requestUrl.searchParams.get("limit") ?? 50);
        const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
        const triggers = await runtime?.listTriggerEvents?.(limit, offset);
        return json(res, 200, { ok: true, triggers: triggers ?? [] });
      }

      if (pathname === "/api/proactive/decisions" && req.method === "GET") {
        const limit = Number(requestUrl.searchParams.get("limit") ?? 50);
        const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
        const decisions = await runtime?.listAttentionDecisions?.(limit, offset);
        return json(res, 200, { ok: true, decisions: decisions ?? [] });
      }

      if (pathname === "/api/proactive/attention-budget" && req.method === "GET") {
        const config = await runtime?.getAttentionBudgetConfig?.();
        return json(res, 200, { ok: true, config: config ?? null });
      }

      // Workspace project directory scanner
      if (pathname === "/api/projects" && req.method === "GET") {
        const project_slug = requestUrl.searchParams.get("project_slug") ?? undefined;
        const projects = await runtime?.scanProjects?.({ project_slug });
        return json(res, 200, { ok: true, projects: projects ?? [] });
      }

      const projectSlugMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectSlugMatch && req.method === "GET") {
        const slug = decodeURIComponent(projectSlugMatch[1]);
        const projects = await runtime?.scanProjects?.();
        const project = projects?.find((p) => p.slug === slug);
        if (!project) {
          return json(res, 404, { ok: false, error: "Project not found" });
        }
        return json(res, 200, { ok: true, project });
      }

      return json(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown gateway error";
      // Avoid surfacing raw JSON parse errors (e.g. "[object Object] is not valid JSON")
      const safeMessage = message.includes("is not valid JSON") ? "Invalid JSON in request body" : message;
      return json(res, message.includes("is not valid JSON") ? 400 : 500, { ok: false, error: safeMessage });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  const address = server.address() as AddressInfo | null;
  const actualPort = address?.port ?? port;
  console.log(`Gateway listening on http://localhost:${actualPort}`);
  return server;
}
