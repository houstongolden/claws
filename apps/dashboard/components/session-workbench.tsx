"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Activity,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderKanban,
  ListChecks,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
  Workflow,
} from "lucide-react";
import { Shell } from "./shell";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { StatusDot } from "./ui/status-dot";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "../lib/utils";
import {
  createTask,
  getChatIntelligence,
  getApprovals,
  getProjects,
  getStatus,
  getTaskEventsPage,
  getTracesPage,
  getViewState,
  getWorkflows,
  runTool,
  createMemoryProposal,
  getProactiveJobs,
  runProactiveJobNow,
  getConversationMessages,
  postConversationMessage,
  type ApprovalItem,
  type IntelligenceData,
  type ProjectInfo,
  type TaskEvent,
  type TraceItem,
  type WorkflowRun,
} from "../lib/api";
import { LiveStateBar } from "./live-state-bar";
import {
  CHAT_DRAFT_KEY,
  createSessionMeta,
  ensureSessionMeta,
  loadHistoryForChat,
  saveHistoryForChat,
  type SessionHistoryMessage,
  type SessionMeta,
} from "../lib/session";
import { useChatList } from "./chat-list-context";

type ToolResult = {
  toolName: string;
  ok: boolean;
  error?: string;
  data?: unknown;
};

/** Live stream event for the current assistant turn (thinking, tool_call, tool_result, approval_requested). */
type StreamEvent =
  | { type: "thinking" }
  | { type: "tool_call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      toolCallId: string;
      toolName: string;
      ok: boolean;
      result?: unknown;
      error?: string;
    }
  | { type: "approval_requested"; approvalId: string };

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
  /** Live events while streaming (thinking, tool calls, results, approval). */
  streamEvents?: StreamEvent[];
  ts: number;
  streaming?: boolean;
};

type ViewState = {
  primary: string;
  overlays: string[];
};

type GatewayStatus = {
  gateway?: string;
  workspaceRoot?: string;
  ai?: { enabled: boolean; model: string; streaming: boolean };
  execution?: { routerOrder?: string[] };
};

type ContextTab =
  | "overview"
  | "project"
  | "files"
  | "approvals"
  | "memory"
  | "traces"
  | "workflow";

const GATEWAY_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL ?? "http://localhost:4317")
    : "http://localhost:4317";

const COMMAND_CHIPS = [
  { label: "Check status", command: "status" },
  { label: "New project", command: "create project " },
  { label: "Log task", command: "create task " },
  { label: "New draft", command: "create draft " },
  { label: "Search memory", command: "search memory " },
  { label: "List tools", command: "list tools" },
];

/** Human-readable labels for tool calls (streaming and completed). */
function getToolLabel(toolName: string, status: "pending" | "ok" | "error"): string {
  const pending = status === "pending";
  const labels: Record<string, string> = {
    "memory.search": pending ? "Searching memory…" : "Searched memory",
    "memory.flush": pending ? "Flushing session memory…" : "Flushed session memory",
    "memory.promote": pending ? "Promoting memory…" : "Promoted memory",
    "fs.read": pending ? "Reading file…" : "Read file",
    "fs.list": pending ? "Listing directory…" : "Listed directory",
    "fs.write": pending ? "Writing file…" : "Wrote file",
    "list tools": pending ? "Listing tools…" : "Listed tools",
    "status": pending ? "Checking status…" : "Checked status",
  };
  const base = labels[toolName] ?? (pending ? `Calling ${toolName}…` : `Called ${toolName}`);
  return base;
}

/** One-line summary for tool result (avoid raw JSON in collapsed state). */
function getToolResultSummary(toolName: string, data: unknown, error?: string): string | null {
  if (error) return error.slice(0, 80) + (error.length > 80 ? "…" : "");
  if (data == null) return null;
  const obj = data as Record<string, unknown>;
  if (toolName === "memory.search" && Array.isArray(obj.results)) {
    const n = obj.results.length;
    return n === 0 ? "No results" : `${n} result${n !== 1 ? "s" : ""}`;
  }
  if (toolName === "fs.read" && typeof obj.content === "string") {
    const line = obj.content.split("\n")[0]?.slice(0, 50) ?? "";
    return line ? `"${line}${line.length >= 50 ? "…" : ""}"` : "Empty file";
  }
  if (toolName === "fs.list" && Array.isArray(obj.entries)) {
    const n = (obj.entries as unknown[]).length;
    return `${n} item${n !== 1 ? "s" : ""}`;
  }
  if (toolName === "list tools" && Array.isArray(obj.tools)) {
    return `${(obj.tools as unknown[]).length} tools`;
  }
  if (typeof obj === "object" && "ok" in obj) {
    return (obj as { ok?: boolean }).ok ? "Done" : "View details";
  }
  return "View details";
}

const SUGGESTED_PROMPTS = [
  {
    label: "See workspace status",
    command: "status",
    note: "View gateway, tools, and workspace root.",
  },
  {
    label: "Scaffold a project",
    command: "create a project called launch-site",
    note: "Create canonical project files in the workspace.",
  },
  {
    label: "Capture a task",
    command: "create a task called tighten onboarding copy in launch-site",
    note: "Append a task event tied to the workspace.",
  },
  {
    label: "Search memory",
    command: "search memory release checklist",
    note: "Recall durable workspace context and prior notes.",
  },
];

export function SessionWorkbench() {
  const { currentMeta, newChat, updateChatTitle, updateChatActivity } = useChatList();
  const meta = currentMeta ?? ensureSessionMeta();

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [viewState, setViewState] = useState<ViewState | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [contextTab, setContextTab] = useState<ContextTab>("overview");
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [intelligencePanelOpen, setIntelligencePanelOpen] = useState(false);
  const [intelligenceData, setIntelligenceData] = useState<IntelligenceData | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null);
  const [liveStateRefreshTrigger, setLiveStateRefreshTrigger] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevChatIdRef = useRef<string | undefined>(undefined);

  // Load history when chat changes (conversation-first; channels use conversation API)
  useEffect(() => {
    const chatId = currentMeta?.chatId ?? meta.chatId;
    if (chatId.startsWith("conv_")) {
      getConversationMessages(chatId)
        .then((res) => {
          const entries: ChatEntry[] = (res.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            ts: m.created_at,
          }));
          setHistory(entries);
        })
        .catch(() => setHistory([]));
    } else {
      const loaded = loadHistoryForChat(chatId) as ChatEntry[];
      setHistory(Array.isArray(loaded) ? loaded : []);
    }
    if (prevChatIdRef.current !== undefined && prevChatIdRef.current !== chatId) setMessage("");
    prevChatIdRef.current = chatId;
    setHydrated(true);
  }, [currentMeta?.chatId, meta.chatId]);

  // Persist history for current chat (skip for channel conversations; server persists)
  useEffect(() => {
    if (!hydrated) return;
    const chatId = currentMeta?.chatId ?? meta.chatId;
    if (chatId.startsWith("conv_")) return;
    saveHistoryForChat(chatId, history);
  }, [history, hydrated, currentMeta?.chatId, meta.chatId]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = typeof getComputedStyle(el).maxHeight === "string" ? parseInt(getComputedStyle(el).maxHeight, 10) : 192;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), max)}px`;
  }, [message]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (message.trim()) {
        window.sessionStorage.setItem(CHAT_DRAFT_KEY, message);
      } else {
        window.sessionStorage.removeItem(CHAT_DRAFT_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [message, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (message.trim()) {
        window.sessionStorage.setItem(CHAT_DRAFT_KEY, message);
      } else {
        window.sessionStorage.removeItem(CHAT_DRAFT_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [message, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const savedDraft = window.sessionStorage.getItem(CHAT_DRAFT_KEY);
      if (savedDraft) setMessage(savedDraft);
    } catch {
      // Ignore
    }
  }, [hydrated]);

  const loadContext = useCallback(async () => {
    const [
      statusRes,
      viewRes,
      approvalsRes,
      tracesRes,
      eventsRes,
      workflowsRes,
      projectsRes,
    ] = await Promise.all([
      getStatus().catch(() => null),
      getViewState({
        channel: meta.channel,
        chatId: meta.chatId,
        threadId: meta.threadId,
      }).catch(() => null),
      getApprovals().catch(() => ({ approvals: [] })),
      getTracesPage({ limit: 12, offset: 0 }).catch(() => ({ traces: [] })),
      getTaskEventsPage({ limit: 16, offset: 0 }).catch(() => ({ events: [] })),
      getWorkflows().catch(() => ({ workflows: [] })),
      getProjects().catch(() => ({ projects: [] })),
    ]);

    if (statusRes?.status) setStatus(statusRes.status as GatewayStatus);
    else setStatus({ gateway: "offline" } as GatewayStatus);
    if (viewRes?.state) setViewState(viewRes.state as ViewState);
    setApprovals((approvalsRes.approvals ?? []) as ApprovalItem[]);
    setTraces((tracesRes.traces ?? []) as TraceItem[]);
    setEvents((eventsRes.events ?? []) as TaskEvent[]);
    setWorkflows((workflowsRes.workflows ?? []) as WorkflowRun[]);
    setProjects((projectsRes.projects ?? []) as ProjectInfo[]);
  }, [meta]);

  useEffect(() => {
    loadContext();
    const interval = setInterval(loadContext, 5000);
    return () => clearInterval(interval);
  }, [loadContext]);

  const lastTool = useMemo(() => {
    return history
      .flatMap((entry) => entry.toolResults ?? [])
      .reverse()
      .find(Boolean);
  }, [history]);

  const touchedFiles = useMemo(() => {
    const files = history
      .flatMap((entry) => entry.toolResults ?? [])
      .map((tool) => {
        if (!tool.data || typeof tool.data !== "object") return null;
        const data = tool.data as Record<string, unknown>;
        return typeof data.path === "string" ? data.path : null;
      })
      .filter((value): value is string => Boolean(value));

    return [...new Set(files)].slice(-6).reverse();
  }, [history]);

  const memoryHits = useMemo(() => {
    const searchTool = history
      .flatMap((entry) => entry.toolResults ?? [])
      .reverse()
      .find((tool) => tool.toolName === "memory.search" && tool.ok);

    if (!searchTool?.data || typeof searchTool.data !== "object") return [];
    const data = searchTool.data as Record<string, unknown>;
    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .map((result) => {
        if (!result || typeof result !== "object") return null;
        const item = result as Record<string, unknown>;
        return {
          path: typeof item.path === "string" ? item.path : "unknown",
          excerpt: typeof item.excerpt === "string" ? item.excerpt : "",
        };
      })
      .filter((item): item is { path: string; excerpt: string } => Boolean(item))
      .slice(0, 4);
  }, [history]);

  const latestProjectInfo = useMemo(() => {
    const eventWithProject = events.find((event) => {
      const project = event.project;
      return Boolean(project && typeof project === "object");
    });

    if (!eventWithProject || !eventWithProject.project || typeof eventWithProject.project !== "object") {
      return projects[0] ?? null;
    }

    const project = eventWithProject.project as Record<string, unknown>;
    const slug = typeof project.slug === "string" ? project.slug : null;
    const name = typeof project.name === "string" ? project.name : null;

    return (
      projects.find((item) => (slug ? item.slug === slug : false) || (name ? item.name === name : false)) ??
      (name || slug
        ? {
            name: name ?? slug ?? "Project",
            slug: slug ?? name?.toLowerCase().replace(/\s+/g, "-") ?? "project",
            path: slug ? `projects/${slug}` : "projects/",
            hasProjectMd: true,
            hasTasksMd: false,
            status: undefined,
          }
        : null)
    );
  }, [events, projects]);

  const latestTask = useMemo(() => {
    const eventWithTask = events.find((event) => {
      const task = event.task;
      return Boolean(task && typeof task === "object");
    });
    if (!eventWithTask) return null;

    const task = typeof eventWithTask.task === "object" && eventWithTask.task
      ? (eventWithTask.task as Record<string, unknown>)
      : null;

    return {
      title:
        (task && typeof task.title === "string" ? task.title : null) ||
        (typeof eventWithTask.note === "string" ? eventWithTask.note : null) ||
        String(eventWithTask.event ?? "task"),
      status:
        (task && typeof task.status === "string" ? task.status : null) ||
        "active",
      project:
        latestProjectInfo?.name ??
        null,
    };
  }, [events, latestProjectInfo]);

  const activeWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.status === "running" || workflow.status === "pending" || workflow.status === "waiting-approval"),
    [workflows]
  );

  const inferredContextTab = useMemo<ContextTab>(() => {
    if (approvals.length > 0) return "approvals";
    if (lastTool?.toolName === "memory.search" && memoryHits.length > 0) return "memory";
    if (lastTool?.toolName?.startsWith("fs.") || touchedFiles.length > 0) return "files";
    if (activeWorkflows.length > 0) return "workflow";
    if (latestProjectInfo) return "project";
    if (traces.length > 0) return "traces";
    return "overview";
  }, [approvals.length, lastTool, memoryHits.length, touchedFiles.length, activeWorkflows.length, latestProjectInfo, traces.length]);

  useEffect(() => {
    setContextTab(inferredContextTab);
  }, [inferredContextTab]);

  const tryStreamChat = useCallback(
    async (
      text: string,
      assistantId: string,
      priorHistory: SessionHistoryMessage[],
      meta: SessionMeta
    ): Promise<boolean> => {
      try {
        const res = await fetch(`${GATEWAY_URL}/api/chat/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: text,
            chatId: meta.chatId,
            threadId: meta.threadId,
            history: priorHistory,
          }),
        });

        if (res.status === 501 || !res.ok || !res.body) return false;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let toolResults: ToolResult[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const event = JSON.parse(raw) as Record<string, unknown>;
              const type = event.type as string;

              if (type === "thinking") {
                setHistory((prev) =>
                  prev.map((entry) =>
                    entry.id === assistantId
                      ? { ...entry, streamEvents: [...(entry.streamEvents ?? []), { type: "thinking" }] }
                      : entry
                  )
                );
              }
              if (type === "text-delta" && typeof event.text === "string") {
                fullText += event.text;
                setHistory((prev) =>
                  prev.map((entry) =>
                    entry.id === assistantId
                      ? { ...entry, content: fullText, streaming: true }
                      : entry
                  )
                );
              }
              if (type === "tool_call") {
                const streamEvent: StreamEvent = {
                  type: "tool_call",
                  toolCallId: String(event.toolCallId ?? ""),
                  toolName: String(event.toolName ?? ""),
                  args: (event.args as Record<string, unknown>) ?? {},
                };
                setHistory((prev) =>
                  prev.map((entry) =>
                    entry.id === assistantId
                      ? { ...entry, streamEvents: [...(entry.streamEvents ?? []), streamEvent] }
                      : entry
                  )
                );
              }
              if (type === "tool_result") {
                const streamEvent: StreamEvent = {
                  type: "tool_result",
                  toolCallId: String(event.toolCallId ?? ""),
                  toolName: String(event.toolName ?? ""),
                  ok: event.ok === true,
                  result: event.result,
                  error: typeof event.error === "string" ? event.error : undefined,
                };
                setHistory((prev) =>
                  prev.map((entry) =>
                    entry.id === assistantId
                      ? { ...entry, streamEvents: [...(entry.streamEvents ?? []), streamEvent] }
                      : entry
                  )
                );
              }
              if (type === "approval_requested" && typeof event.approvalId === "string") {
                const streamEvent: StreamEvent = {
                  type: "approval_requested",
                  approvalId: event.approvalId,
                };
                setHistory((prev) =>
                  prev.map((entry) =>
                    entry.id === assistantId
                      ? { ...entry, streamEvents: [...(entry.streamEvents ?? []), streamEvent] }
                      : entry
                  )
                );
              }
              if (type === "complete" || type === "finish") {
                if (typeof event.text === "string") fullText = event.text;
                if (Array.isArray(event.toolResults)) {
                  toolResults = event.toolResults as ToolResult[];
                }
                setHistory((prev) =>
                  prev.map((entry) =>
                    entry.id === assistantId
                      ? {
                          ...entry,
                          content: fullText || "Done.",
                          toolResults,
                          streamEvents: undefined,
                          streaming: false,
                        }
                      : entry
                  )
                );
              }
              if (type === "error" && typeof event.error === "string") {
                setError(event.error);
              }
            } catch {
              // Ignore malformed SSE lines.
            }
          }
        }

        if (fullText || toolResults.length > 0) {
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === assistantId
                ? {
                    ...entry,
                    content: fullText || "Done.",
                    toolResults,
                    streamEvents: undefined,
                    streaming: false,
                  }
                : entry
            )
          );
        }
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      const raw = text.trim();
      const priorHistory: SessionHistoryMessage[] = history
        .filter((entry) => entry.content.trim())
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }));

      const userEntry: ChatEntry = {
        id: crypto.randomUUID(),
        role: "user",
        content: raw,
        ts: Date.now(),
      };
      const assistantId = crypto.randomUUID();
      const placeholderEntry: ChatEntry = {
        id: assistantId,
        role: "assistant",
        content: "",
        streamEvents: [],
        ts: Date.now(),
        streaming: true,
      };

      setHistory((prev) => [...prev, userEntry, placeholderEntry]);
      setMessage("");
      setLoading(true);
      setError(null);

      updateChatActivity(meta.chatId);
      if (history.length === 0) {
        const title = raw.slice(0, 50) || "New chat";
        updateChatTitle(meta.chatId, title.length === raw.length ? title : `${title}…`);
      }

      try {
        if (raw.startsWith("/")) {
          const cmd = raw.slice(1).toLowerCase().replace(/\s+.*$/, "");
          const slashToJobName: Record<string, string> = {
            "morning-brief": "Morning Brief",
            "midday-report": "Midday Report",
            "eod": "End of Day Report",
            "eod-report": "End of Day Report",
            "approvals-watchdog": "Approvals Watchdog",
            "watchdog": "Approvals Watchdog",
            "stale-project-watchdog": "Stale Project Watchdog",
          };
          const jobName = slashToJobName[cmd];
          if (jobName) {
            const jobsRes = await getProactiveJobs("active");
            const job = (jobsRes.jobs ?? []).find((j) => j.name === jobName);
            if (job) {
              const runRes = await runProactiveJobNow(job.id);
              const summary = runRes.result?.summary ?? `Ran "${jobName}".`;
              setHistory((prev) =>
                prev.map((entry) =>
                  entry.id === assistantId ? { ...entry, content: summary, streaming: false } : entry
                )
              );
              setLoading(false);
              setLiveStateRefreshTrigger((t) => t + 1);
              inputRef.current?.focus();
              void loadContext();
              return;
            }
          }
        }

        if (meta.chatId.startsWith("conv_")) {
          const res = await postConversationMessage(meta.chatId, {
            message: text.trim(),
            history: priorHistory,
          });
          const result = res?.result;
          const summary = (result && "summary" in result ? result.summary : null) ?? (result && "messages" in result ? (result as { messages?: string[] }).messages?.[0] : null) ?? "Done.";
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === assistantId ? { ...entry, content: summary, streaming: false } : entry
            )
          );
          return;
        }

        const streamed = await tryStreamChat(text.trim(), assistantId, priorHistory, meta);

        if (!streamed) {
          const res = await fetch(`${GATEWAY_URL}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              message: text.trim(),
              chatId: meta.chatId,
              threadId: meta.threadId,
              history: priorHistory,
            }),
          });

          if (!res.ok) throw new Error(`Gateway error: ${res.status}`);

          const data = (await res.json()) as {
            result?: { summary?: string; messages?: string[]; toolResults?: ToolResult[] };
            summary?: string;
            messages?: string[];
            toolResults?: ToolResult[];
          };
          const result = data.result ?? data;
          const summary = result.summary ?? result.messages?.[0] ?? "Done.";
          const toolResults = result.toolResults ?? [];

          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === assistantId
                ? {
                    ...entry,
                    content: summary,
                    toolResults,
                    streaming: false,
                  }
                : entry
            )
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setHistory((prev) => prev.filter((entry) => entry.id !== assistantId || entry.content));
      } finally {
        setLoading(false);
        setLiveStateRefreshTrigger((t) => t + 1);
        inputRef.current?.focus();
        void loadContext();
      }
    },
    [history, loadContext, loading, meta, tryStreamChat, updateChatActivity, updateChatTitle]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(message);
    },
    [message, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(message);
      }
    },
    [message, sendMessage]
  );

  const handleChip = useCallback(
    (command: string) => {
      if (command.endsWith(" ")) {
        setMessage(command);
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;
          input.focus();
          input.setSelectionRange(command.length, command.length);
        });
      } else {
        sendMessage(command);
      }
    },
    [sendMessage]
  );

  const clearConversation = useCallback(() => {
    newChat();
    setHistory([]);
    setError(null);
    setMessage("");
    try {
      window.sessionStorage.removeItem(CHAT_DRAFT_KEY);
    } catch {
      // Ignore storage failures.
    }
    inputRef.current?.focus();
  }, [newChat]);

  return (
    <Shell>
      <div className="flex h-screen flex-col bg-background">
        {/* Header: minimal, AI-native */}
        <header className="shrink-0 border-b border-border bg-background px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                Session
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                {loading
                  ? "Claws is responding…"
                  : status?.gateway === "online"
                    ? "Chat, build, and ship — projects, tasks, memory & tools"
                    : status?.gateway === "offline"
                      ? "Gateway offline — start the gateway to use chat"
                      : "Connecting…"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const next = !intelligencePanelOpen;
                  setIntelligencePanelOpen(next);
                  if (next && meta.chatId) {
                    setIntelligenceLoading(true);
                    try {
                      const res = await getChatIntelligence(meta.chatId, meta.threadId);
                      setIntelligenceData(res.intelligence ?? null);
                    } catch {
                      setIntelligenceData(null);
                    } finally {
                      setIntelligenceLoading(false);
                    }
                  }
                }}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  intelligencePanelOpen && "text-foreground"
                )}
                title="Chat intelligence"
                aria-label={intelligencePanelOpen ? "Close chat intelligence panel" : "Open chat intelligence panel"}
              >
                <Sparkles size={14} />
              </Button>
              {history.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearConversation}
                  className="text-muted-foreground hover:text-foreground"
                  title="Clear and start over"
                  aria-label="Clear conversation"
                >
                  <Trash2 size={14} />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <StatusDot variant={status?.gateway === "online" ? "success" : "neutral"} />
              {status?.gateway === "online" ? "Online" : status?.gateway === "offline" ? "Offline" : "Connecting"}
            </span>
            <Link href="/approvals" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors no-underline">
              <ShieldAlert size={12} className={approvals.length > 0 ? "text-warning" : ""} />
              {approvals.length > 0 ? `${approvals.length} pending` : "Approvals"}
            </Link>
            <Link href="/traces" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors no-underline">
              <Activity size={12} />
              Traces
            </Link>
            <Link href="/workflows" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors no-underline">
              <Workflow size={12} />
              {activeWorkflows.length > 0 ? `${activeWorkflows.length} active` : "Workflows"}
            </Link>
            {viewState?.primary ? (
              <span className="text-muted-foreground/80 font-[family-name:var(--font-geist-mono)] text-[11px]">
                {viewState.primary}
              </span>
            ) : null}
          </div>
        </header>

        {/* Intelligence panel: slide-over from right */}
        {intelligencePanelOpen ? (
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              type="button"
              className="absolute inset-0 bg-black/20"
              aria-label="Close intelligence panel"
              onClick={() => setIntelligencePanelOpen(false)}
            />
            <div className="relative w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
              <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-[15px] font-semibold flex items-center gap-2">
                  <Sparkles size={16} />
                  Chat intelligence
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setIntelligencePanelOpen(false)} aria-label="Close">
                  ×
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {intelligenceLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-[13px] py-8">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>Analyzing conversation…</span>
                  </div>
                ) : !intelligenceData ? (
                  <p className="text-[13px] text-muted-foreground py-4">
                    No analysis yet. Send messages and the AI will detect tasks, memories, and insights.
                  </p>
                ) : (
                  <>
                    {intelligenceData.summary ? (
                      <section>
                        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Chat summary</h3>
                        <p className="text-[13px] text-foreground">{intelligenceData.summary}</p>
                      </section>
                    ) : null}
                    {intelligenceData.detected_tasks?.length ? (
                      <section>
                        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Detected tasks</h3>
                        <ul className="list-disc list-inside text-[13px] space-y-1 mb-2">
                          {intelligenceData.detected_tasks.map((t, i) => (
                            <li key={i}>{t.title}{t.project ? ` (${t.project})` : ""}</li>
                          ))}
                        </ul>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={creatingTasks}
                          onClick={async () => {
                            setCreatingTasks(true);
                            try {
                              for (const t of intelligenceData.detected_tasks ?? []) {
                                await createTask({ task: t.title, section: "Active", priority: t.priority ?? "P2", owner: "human" });
                              }
                            } finally {
                              setCreatingTasks(false);
                            }
                          }}
                        >
                          {creatingTasks ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <ListChecks size={14} className="mr-1.5" />}
                          Create tasks now?
                        </Button>
                      </section>
                    ) : null}
                    {intelligenceData.memory_candidates?.length ? (
                      <section>
                        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Memory candidates</h3>
                        <ul className="space-y-2 mb-2">
                          {intelligenceData.memory_candidates.map((m, i) => {
                            const id = `mem-${i}`;
                            return (
                              <li key={i} className="text-[13px] border border-border rounded-lg p-2 bg-surface-2">
                                <p className="text-foreground">{m.text}</p>
                                {m.source ? <p className="text-[11px] text-muted-foreground mt-0.5">{m.source}</p> : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-1.5 text-[12px]"
                                  disabled={savingMemoryId === id}
                                  onClick={async () => {
                                    setSavingMemoryId(id);
                                    try {
                                      const res = await runTool("memory.flush", { text: m.text, source: m.source ?? "chat" }) as { ok?: boolean; result?: { ok?: boolean; entry?: { id?: string } } };
                                      const entryId = res?.result?.entry?.id;
                                      if (entryId) await createMemoryProposal({ entryId });
                                    } finally {
                                      setSavingMemoryId(null);
                                    }
                                  }}
                                >
                                  {savingMemoryId === id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Brain size={12} className="mr-1" />}
                                  Save memory?
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ) : null}
                    {intelligenceData.key_insights?.length ? (
                      <section>
                        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Key insights</h3>
                        <ul className="list-disc list-inside text-[13px] text-foreground space-y-0.5">
                          {intelligenceData.key_insights.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("flex-1 min-h-0 flex", contextPanelOpen && "xl:grid xl:grid-cols-[minmax(0,1fr)_340px]")}>
          <div className="min-h-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full max-w-[var(--content-max-width)] px-4 sm:px-6 py-8 space-y-10">
                {history.length === 0 && !loading ? (
                  <SessionEmptyState onChip={handleChip} />
                ) : null}

                {history.map((entry) =>
                  entry.role === "assistant" && entry.streaming ? (
                    <div key={entry.id} className="flex gap-4">
                      <AvatarIcon role="assistant" />
                      <div className="flex-1 min-w-0 space-y-3 max-w-[var(--chat-message-max-width)]">
                        {!entry.content && (!entry.streamEvents?.length || entry.streamEvents.every((e) => e.type === "thinking")) ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-[13px] pt-1 animate-pulse">
                            <Loader2 size={14} className="animate-spin shrink-0" />
                            <span>Thinking…</span>
                          </div>
                        ) : null}
                        {entry.content ? (
                          <div className="rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap bg-surface-2 text-foreground border border-border inline-block">
                            {entry.content}
                            <span className="inline-block w-2 h-4 bg-foreground/50 ml-0.5 animate-pulse rounded-sm align-middle" />
                          </div>
                        ) : null}
                        {entry.streamEvents?.length ? (
                          <StreamEventsList events={entry.streamEvents} />
                        ) : null}
                      </div>
                    </div>
                  ) : entry.role === "assistant" && entry.content ? (
                    <MessageRow key={entry.id} entry={entry} />
                  ) : entry.role === "user" ? (
                    <MessageRow key={entry.id} entry={entry} />
                  ) : null
                )}

                {error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive space-y-2">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => { setError(null); inputRef.current?.focus(); }}
                      className="text-[12px] font-medium text-foreground hover:underline"
                    >
                      Dismiss and retry
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Live State Bar: what the agent is doing, using, waiting on */}
            <div className="shrink-0 px-4 sm:px-6 pt-2 pb-0">
              <div className="mx-auto w-full max-w-[var(--content-max-width)]">
                <LiveStateBar
                  chatId={currentMeta?.chatId ?? meta.chatId}
                  threadId={currentMeta?.threadId ?? meta.threadId}
                  refreshTrigger={liveStateRefreshTrigger}
                />
              </div>
            </div>

            {/* Composer: fixed to bottom, ChatGPT/Claude style */}
            <div className="shrink-0 border-t border-border bg-background px-4 sm:px-6 py-4">
              <div className="mx-auto w-full max-w-[var(--content-max-width)]">
                {hydrated && status != null && status.gateway !== "online" ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-4 text-[13px] text-foreground">
                    <p className="font-medium mb-0.5">Gateway not connected</p>
                    <p className="text-muted-foreground">
                      Start the Claws gateway to chat and use tools. Check your setup and refresh.
                    </p>
                  </div>
                ) : null}
                {history.length > 0 ? (
                  <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-none">
                    {COMMAND_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => handleChip(chip.command)}
                        className="shrink-0 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors duration-150 font-[family-name:var(--font-geist-mono)]"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <form onSubmit={onSubmit} className="relative rounded-2xl border border-border bg-surface-1 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Claws anything…"
                    title="Enter to send, Shift+Enter for new line"
                    rows={1}
                    disabled={loading || (hydrated && status != null && status.gateway !== "online")}
                    className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-12 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 font-[family-name:var(--font-geist-sans)] min-h-[52px] max-h-[var(--composer-max-height)]"
                  />
                  <button
                    type="submit"
                    disabled={loading || !message.trim() || (hydrated && status != null && status.gateway !== "online")}
                    className="absolute right-2 bottom-2 flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-40 hover:opacity-90"
                    aria-label="Send message"
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ArrowUp size={18} strokeWidth={2.2} />
                    )}
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-muted-foreground/80">
                  {history.length === 0
                    ? "Enter to send · Shift+Enter for new line · Try a suggestion above"
                    : "Enter to send · Shift+Enter for new line"}
                </p>
              </div>
            </div>
          </div>

          {contextPanelOpen ? (
          <aside className="hidden xl:flex min-h-0 flex-col border-l border-border bg-surface-1/50">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Context
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                Live context from this session: project focus, touched files, approvals, and traces.
              </div>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
                <Link href="/files" className="text-muted-foreground hover:text-foreground no-underline">Files</Link>
                <span className="text-muted-foreground/50">·</span>
                <Link href="/tasks" className="text-muted-foreground hover:text-foreground no-underline">Tasks</Link>
                <span className="text-muted-foreground/50">·</span>
                <Link href="/memory" className="text-muted-foreground hover:text-foreground no-underline">Memory</Link>
                <span className="text-muted-foreground/50">·</span>
                <Link href="/approvals" className="text-muted-foreground hover:text-foreground no-underline">Approvals</Link>
                <span className="text-muted-foreground/50">·</span>
                <Link href="/traces" className="text-muted-foreground hover:text-foreground no-underline">Traces</Link>
                <span className="text-muted-foreground/50">·</span>
                <Link href="/workflows" className="text-muted-foreground hover:text-foreground no-underline">Workflows</Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Tabs value={contextTab} onValueChange={(value) => setContextTab(value as ContextTab)}>
                <TabsList className="flex flex-wrap gap-x-3 gap-y-1 pb-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="project">Project</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="approvals">Approvals</TabsTrigger>
                  <TabsTrigger value="memory">Memory</TabsTrigger>
                  <TabsTrigger value="traces">Traces</TabsTrigger>
                  <TabsTrigger value="workflow">Workflow</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3">
                  <SidecarCard
                    icon={<ListChecks size={14} />}
                    title="Current task"
                    actionHref="/tasks"
                    actionLabel="Full view"
                  >
                    {latestTask ? (
                      <div className="space-y-1">
                        <div className="text-[13px] text-foreground">{latestTask.title}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {latestTask.project ? `${latestTask.project} · ` : ""}
                          {latestTask.status}
                        </div>
                      </div>
                    ) : (
                      <EmptyCopy text="No task linked to this session yet." />
                    )}
                  </SidecarCard>
                  <SidecarCard
                    icon={<FolderKanban size={14} />}
                    title="Current project"
                    actionHref="/projects"
                    actionLabel="Full view"
                  >
                    {latestProjectInfo ? (
                      <div className="space-y-1">
                        <div className="text-[13px] text-foreground">{latestProjectInfo.name}</div>
                        <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                          {latestProjectInfo.path}
                        </div>
                      </div>
                    ) : (
                      <EmptyCopy text="Create or mention a project in chat to see it here." />
                    )}
                  </SidecarCard>
                  <SidecarCard
                    icon={<FileText size={14} />}
                    title="Files touched"
                    actionHref="/files"
                    actionLabel="Full view"
                  >
                    {touchedFiles.length > 0 ? (
                      <ul className="space-y-1">
                        {touchedFiles.slice(0, 4).map((file) => (
                          <li key={file} className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] break-all">
                            {file}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyCopy text="Files you read or write in chat will appear here." />
                    )}
                  </SidecarCard>
                </TabsContent>

                <TabsContent value="project" className="space-y-3">
                  <SidecarCard
                    icon={<FolderKanban size={14} />}
                    title="Project focus"
                    actionHref="/projects"
                    actionLabel="Full view"
                  >
                    {latestProjectInfo ? (
                      <div className="space-y-2">
                        <div>
                          <div className="text-[13px] text-foreground">{latestProjectInfo.name}</div>
                          <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                            {latestProjectInfo.path}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {latestProjectInfo.hasProjectMd ? <Badge variant="outline" className="text-[10px]">project.md</Badge> : null}
                          {latestProjectInfo.hasTasksMd ? <Badge variant="outline" className="text-[10px]">tasks.md</Badge> : null}
                          {latestProjectInfo.status ? <Badge variant="secondary" className="text-[10px]">{latestProjectInfo.status}</Badge> : null}
                        </div>
                      </div>
                    ) : (
                      <EmptyCopy text="Create or reference a project in chat to pin it here." />
                    )}
                  </SidecarCard>
                </TabsContent>

                <TabsContent value="files" className="space-y-3">
                  <SidecarCard
                    icon={<FileText size={14} />}
                    title="Touched files"
                    actionHref="/files"
                    actionLabel="Full view"
                  >
                    {touchedFiles.length > 0 ? (
                      <ul className="space-y-1">
                        {touchedFiles.map((file) => (
                          <li key={file} className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] break-all">
                            {file}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyCopy text="No tracked file touches in this session yet." />
                    )}
                  </SidecarCard>
                </TabsContent>

                <TabsContent value="approvals" className="space-y-3">
                  <SidecarCard
                    icon={<ShieldAlert size={14} />}
                    title="Approvals needed"
                    actionHref="/approvals"
                    actionLabel="Full view"
                  >
                    {approvals.length > 0 ? (
                      <div className="space-y-2">
                        {approvals.slice(0, 4).map((approval) => (
                          <div key={approval.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                            <div className="text-[12px] font-medium text-foreground">{approval.toolName}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {approval.agentId} · {approval.risk} risk
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyCopy text="All clear. When Claws needs your approval, it'll show here first." />
                    )}
                  </SidecarCard>
                </TabsContent>

                <TabsContent value="memory" className="space-y-3">
                  <SidecarCard
                    icon={<Brain size={14} />}
                    title="Memory hits"
                    actionHref="/memory"
                    actionLabel="Full view"
                  >
                    {memoryHits.length > 0 ? (
                      <div className="space-y-2">
                        {memoryHits.map((hit) => (
                          <div key={hit.path} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                            <div className="text-[11px] text-foreground font-[family-name:var(--font-geist-mono)] break-all">
                              {hit.path}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                              {hit.excerpt}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyCopy text="Search memory in chat to see results here." />
                    )}
                  </SidecarCard>
                </TabsContent>

                <TabsContent value="traces" className="space-y-3">
                  <SidecarCard
                    icon={<Sparkles size={14} />}
                    title="Trace timeline"
                    actionHref="/traces"
                    actionLabel="Full view"
                  >
                    {traces.length > 0 ? (
                      <div className="space-y-2">
                        {traces.slice(0, 6).map((trace) => (
                          <div key={trace.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                            <div className="text-[12px] text-foreground">{trace.summary}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {trace.type} · {trace.agentId}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyCopy text="Tool calls and traces will appear here as you chat." />
                    )}
                  </SidecarCard>
                </TabsContent>

                <TabsContent value="workflow" className="space-y-3">
                  <SidecarCard
                    icon={<Workflow size={14} />}
                    title="Workflow state"
                    actionHref="/workflows"
                    actionLabel="Full view"
                  >
                    {activeWorkflows.length > 0 ? (
                      <div className="space-y-2">
                        {activeWorkflows.slice(0, 4).map((workflow) => (
                          <div key={workflow.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <StatusDot variant={workflow.status === "running" ? "running" : "neutral"} pulse={workflow.status === "running"} />
                              <div className="text-[12px] text-foreground">{workflow.name}</div>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {workflow.steps.filter((step) => step.status === "completed").length}/{workflow.steps.length} steps · {workflow.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyCopy text="Long-running workflows will appear here when started." />
                    )}
                  </SidecarCard>
                </TabsContent>
              </Tabs>
            </div>
          </aside>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

function SessionEmptyState({ onChip }: { onChip: (cmd: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-10">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <Bot size={28} strokeWidth={1.5} />
        </div>
        <div className="space-y-2 max-w-md">
          <p className="text-[18px] font-semibold text-foreground tracking-tight">
            Your AI workspace
          </p>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            Chat, build, and ship in one place. Projects, tasks, memory, and tools—all connected.
          </p>
        </div>
      </div>
      <div className="w-full max-w-lg space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Try these
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => onChip(prompt.command)}
              className="rounded-xl border border-border bg-surface-1 p-4 text-left hover:bg-surface-2 transition-colors duration-150 card-interactive"
            >
              <div className="text-[13px] font-medium text-foreground">{prompt.label}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">{prompt.note}</div>
              <div className="mt-2 text-[11px] font-[family-name:var(--font-geist-mono)] text-muted-foreground/80 truncate">
                {prompt.command}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-[11px] text-muted-foreground/80 uppercase tracking-wider mr-1">Quick:</span>
        {COMMAND_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onChip(chip.command)}
            className="rounded-full border border-border bg-surface-1 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors font-[family-name:var(--font-geist-mono)]"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SidecarCard({
  icon,
  title,
  children,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <div className="text-[12px] text-muted-foreground">{text}</div>;
}

function AvatarIcon({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        role === "assistant"
          ? "bg-surface-2 text-muted-foreground border border-border"
          : "bg-primary text-primary-foreground"
      )}
    >
      {role === "assistant" ? (
        <Bot size={16} strokeWidth={1.8} />
      ) : (
        <MessageSquare size={16} strokeWidth={1.8} />
      )}
    </div>
  );
}

function StreamEventsList({ events }: { events: StreamEvent[] }) {
  const toolRuns = useMemo(() => {
    const runs: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      status: "pending" | "ok" | "error";
      result?: unknown;
      error?: string;
    }> = [];
    const byId = new Map<string, (typeof runs)[0]>();
    for (const e of events) {
      if (e.type === "tool_call") {
        const run = {
          toolCallId: e.toolCallId,
          toolName: e.toolName,
          args: e.args,
          status: "pending" as const,
        };
        byId.set(e.toolCallId, run);
        runs.push(run);
      } else if (e.type === "tool_result") {
        const run = byId.get(e.toolCallId);
        if (run) {
          run.status = e.ok ? "ok" : "error";
          run.result = e.result;
          run.error = e.error;
        } else {
          runs.push({
            toolCallId: e.toolCallId,
            toolName: e.toolName,
            args: {},
            status: e.ok ? "ok" : "error",
            result: e.result,
            error: e.error,
          });
        }
      }
    }
    return runs;
  }, [events]);

  const approval = events.find((e): e is StreamEvent & { type: "approval_requested" } => e.type === "approval_requested");

  return (
    <div className="space-y-3">
      {toolRuns.map((run) => (
        <div
          key={run.toolCallId}
          className="rounded-xl border border-border bg-surface-1 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-surface-2/80">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              {run.status === "pending" ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
              ) : (
                <Wrench size={14} className="shrink-0 text-muted-foreground" />
              )}
              <span>{getToolLabel(run.toolName, run.status)}</span>
            </div>
            {run.status !== "pending" && (
              <Badge
                variant={run.status === "ok" ? "success" : "destructive"}
                className="text-[10px]"
              >
                {run.status === "ok" ? "Done" : "Error"}
              </Badge>
            )}
          </div>
          {run.status !== "pending" && (run.error || run.result !== undefined) && (
            <StreamToolResultBody toolName={run.toolName} error={run.error} result={run.result} />
          )}
        </div>
      ))}
      {approval ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-[13px] text-amber-700 dark:text-amber-400">
              <ShieldAlert size={14} />
              <span>Approval required</span>
            </div>
            <Badge variant="warning" className="text-[10px]">Pending</Badge>
          </div>
          <div className="px-3 py-3 space-y-2">
            <p className="text-[12px] text-muted-foreground">
              This action is paused. Resolve it in Approvals to continue.
            </p>
            <Link href="/approvals">
              <Button size="sm" variant="outline">
                <ShieldAlert size={12} />
                Open Approvals
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StreamToolResultBody({ toolName, error, result }: { toolName: string; error?: string; result?: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const summary = getToolResultSummary(toolName, result, error);
  const hasDetail = error || (result !== undefined && result !== null);

  if (!hasDetail) return null;
  return (
    <>
      {error ? (
        <div className="px-3 py-2.5 text-[13px] text-destructive">{error}</div>
      ) : null}
      {result !== undefined && result !== null ? (
        <div className="px-3 py-2.5">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Hide details" : summary}
          </button>
          {expanded ? (
            <pre className="mt-2 rounded-lg border border-border bg-code-bg p-3 text-[12px] text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function MessageRow({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!entry.content) return;
    navigator.clipboard.writeText(entry.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [entry.content]);

  return (
    <div className={cn("flex gap-4", isUser && "flex-row-reverse")}>
      <AvatarIcon role={entry.role} />
      <div className={cn("flex-1 min-w-0 max-w-[var(--chat-message-max-width)]", isUser ? "text-right" : "")}>
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "inline-block rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap max-w-[85%]",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-surface-2 text-foreground border border-border"
            )}
          >
            {entry.content}
            {entry.streaming ? (
              <span className="inline-block w-2 h-4 bg-foreground/50 ml-0.5 animate-pulse rounded-sm align-middle" />
            ) : null}
          </div>
          {!isUser && entry.content && !entry.streaming ? (
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              title={copied ? "Copied" : "Copy"}
              aria-label={copied ? "Copied" : "Copy response"}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          ) : null}
        </div>
        {entry.toolResults && entry.toolResults.length > 0 ? (
          <div className="mt-3 space-y-3">
            {entry.toolResults.map((tool, idx) => (
              <ToolResultBlock key={`${tool.toolName}-${idx}`} tool={tool} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolResultBlock({ tool }: { tool: ToolResult }) {
  const isApprovalNeeded = !tool.ok && tool.error?.includes("Approval required");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const label = getToolLabel(tool.toolName, tool.ok ? "ok" : "error");
  const summary = !isApprovalNeeded && tool.data != null
    ? getToolResultSummary(tool.toolName, tool.data, tool.error)
    : null;

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-surface-2/80">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {isApprovalNeeded ? (
            <ShieldAlert size={14} className="text-warning" />
          ) : (
            <Wrench size={14} />
          )}
          <span>{isApprovalNeeded ? "Approval required" : label}</span>
        </div>
        {isApprovalNeeded ? (
          <Badge variant="warning" className="text-[10px]">
            Pending
          </Badge>
        ) : (
          <Badge
            variant={tool.ok ? "success" : "destructive"}
            className="text-[10px]"
          >
            {tool.ok ? "Done" : "Error"}
          </Badge>
        )}
      </div>

      {isApprovalNeeded ? (
        <div className="px-3 py-3 space-y-2">
          <p className="text-[12px] text-muted-foreground">
            Resolve in Approvals to continue.
          </p>
          <Link href="/approvals">
            <Button size="sm" variant="outline">
              <ShieldAlert size={12} />
              Open Approvals
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {tool.error ? (
            <div className="px-3 py-2.5 text-[13px] text-destructive">{tool.error}</div>
          ) : null}
          {tool.data !== undefined && tool.data !== null ? (
            <div className="px-3 py-2.5">
              <button
                type="button"
                onClick={() => setDetailsExpanded((e) => !e)}
                className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {detailsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {detailsExpanded ? "Hide details" : summary ?? "View details"}
              </button>
              {detailsExpanded ? (
                <pre className="mt-2 rounded-lg border border-border bg-code-bg p-3 text-[12px] text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(tool.data, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
