"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Activity,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderKanban,
  ListChecks,
  Loader2,
  Pencil,
  ShieldAlert,
  Slash,
  ScanEye,
  Sparkles,
  Trash2,
  Wrench,
  Workflow,
  X,
  Image as ImageIcon,
  AtSign,
  Bot,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { Shell, useSidebar } from "./shell";
import { ArtifactPanel } from "./artifact-panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { StatusDot } from "./ui/status-dot";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "../lib/utils";
import { ChatMarkdown } from "./chat-markdown";
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
  streamEvents?: StreamEvent[];
  ts: number;
  streaming?: boolean;
  images?: string[];
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

type ChatMode = "agent" | "plan" | "chat";

const GATEWAY_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL ?? "http://localhost:4317")
    : "http://localhost:4317";

const SLASH_COMMANDS = [
  { label: "Check status", command: "status", description: "View gateway, tools, and workspace root" },
  { label: "New project", command: "create project ", description: "Scaffold a project in the workspace" },
  { label: "Log task", command: "create task ", description: "Append a task event" },
  { label: "New draft", command: "create draft ", description: "Start a draft document" },
  { label: "Search memory", command: "search memory ", description: "Recall durable context and notes" },
  { label: "List tools", command: "list tools", description: "Show all available tools" },
  { label: "Morning brief", command: "/morning-brief", description: "Run your morning briefing" },
  { label: "EOD report", command: "/eod", description: "Generate end of day summary" },
];

const MENTION_TARGETS = [
  { label: "Files", prefix: "files:", icon: FileText, description: "Reference workspace files" },
  { label: "Tasks", prefix: "tasks:", icon: ListChecks, description: "Reference tasks" },
  { label: "Projects", prefix: "projects:", icon: FolderKanban, description: "Reference projects" },
  { label: "Memory", prefix: "memory:", icon: Brain, description: "Search memory context" },
  { label: "Agents", prefix: "agents:", icon: Bot, description: "Mention an agent" },
];

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
  return labels[toolName] ?? (pending ? `Calling ${toolName}…` : `Called ${toolName}`);
}

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
  if (toolName === "fs.write" && typeof obj.path === "string") {
    return `Created ${obj.path}`;
  }
  if (toolName === "fs.append" && typeof obj.path === "string") {
    return `Appended to ${obj.path}`;
  }
  if (toolName === "fs.list" && Array.isArray(obj.entries)) {
    return `${(obj.entries as unknown[]).length} items`;
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
  { label: "See workspace status", command: "status", note: "View gateway, tools, and workspace root." },
  { label: "Scaffold a project", command: "create a project called launch-site", note: "Create canonical project files in the workspace." },
  { label: "Capture a task", command: "create a task called tighten onboarding copy in launch-site", note: "Append a task event tied to the workspace." },
  { label: "Search memory", command: "search memory release checklist", note: "Recall durable workspace context and prior notes." },
];

export function SessionWorkbench() {
  const { currentMeta, newChat, updateChatTitle, updateChatActivity } = useChatList();
  const { setSidebarCollapsed } = useSidebar();
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
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [intelligencePanelOpen, setIntelligencePanelOpen] = useState(false);
  const [intelligenceData, setIntelligenceData] = useState<IntelligenceData | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null);
  const [liveStateRefreshTrigger, setLiveStateRefreshTrigger] = useState(0);
  const [chatMode, setChatMode] = useState<ChatMode>("agent");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [mentionFilter, setMentionFilter] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string | null>(null);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevChatIdRef = useRef<string | undefined>(undefined);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

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
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), max)}px`;
  }, [message]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (message.trim()) window.sessionStorage.setItem(CHAT_DRAFT_KEY, message);
      else window.sessionStorage.removeItem(CHAT_DRAFT_KEY);
    } catch {}
  }, [message, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const savedDraft = window.sessionStorage.getItem(CHAT_DRAFT_KEY);
      if (savedDraft) setMessage(savedDraft);
    } catch {}
  }, [hydrated]);

  const loadContext = useCallback(async () => {
    const [statusRes, viewRes, approvalsRes, tracesRes, eventsRes, workflowsRes, projectsRes] = await Promise.all([
      getStatus().catch(() => null),
      getViewState({ channel: meta.channel, chatId: meta.chatId, threadId: meta.threadId }).catch(() => null),
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

  const lastTool = useMemo(() => history.flatMap((e) => e.toolResults ?? []).reverse().find(Boolean), [history]);
  const touchedFiles = useMemo(() => {
    const files = history.flatMap((e) => e.toolResults ?? []).map((t) => {
      if (!t.data || typeof t.data !== "object") return null;
      return typeof (t.data as Record<string, unknown>).path === "string" ? (t.data as Record<string, unknown>).path as string : null;
    }).filter((v): v is string => Boolean(v));
    return [...new Set(files)].slice(-6).reverse();
  }, [history]);
  const memoryHits = useMemo(() => {
    const st = history.flatMap((e) => e.toolResults ?? []).reverse().find((t) => t.toolName === "memory.search" && t.ok);
    if (!st?.data || typeof st.data !== "object") return [];
    const results = Array.isArray((st.data as Record<string, unknown>).results) ? (st.data as Record<string, unknown>).results as unknown[] : [];
    return results.map((r) => {
      if (!r || typeof r !== "object") return null;
      const item = r as Record<string, unknown>;
      return { path: typeof item.path === "string" ? item.path : "unknown", excerpt: typeof item.excerpt === "string" ? item.excerpt : "" };
    }).filter((i): i is { path: string; excerpt: string } => Boolean(i)).slice(0, 4);
  }, [history]);
  const latestProjectInfo = useMemo(() => {
    const evp = events.find((e) => Boolean(e.project && typeof e.project === "object"));
    if (!evp?.project || typeof evp.project !== "object") return projects[0] ?? null;
    const p = evp.project as Record<string, unknown>;
    const slug = typeof p.slug === "string" ? p.slug : null;
    const name = typeof p.name === "string" ? p.name : null;
    return projects.find((i) => (slug ? i.slug === slug : false) || (name ? i.name === name : false)) ?? (name || slug ? { name: name ?? slug ?? "Project", slug: slug ?? name?.toLowerCase().replace(/\s+/g, "-") ?? "project", path: slug ? `projects/${slug}` : "projects/", hasProjectMd: true, hasTasksMd: false, status: undefined } : null);
  }, [events, projects]);
  const latestTask = useMemo(() => {
    const evt = events.find((e) => Boolean(e.task && typeof e.task === "object"));
    if (!evt) return null;
    const task = typeof evt.task === "object" && evt.task ? evt.task as Record<string, unknown> : null;
    return { title: (task && typeof task.title === "string" ? task.title : null) || (typeof evt.note === "string" ? evt.note : null) || String(evt.event ?? "task"), status: (task && typeof task.status === "string" ? task.status : null) || "active", project: latestProjectInfo?.name ?? null };
  }, [events, latestProjectInfo]);
  const activeWorkflows = useMemo(() => workflows.filter((w) => w.status === "running" || w.status === "pending" || w.status === "waiting-approval"), [workflows]);
  const inferredContextTab = useMemo<ContextTab>(() => {
    if (approvals.length > 0) return "approvals";
    if (lastTool?.toolName === "memory.search" && memoryHits.length > 0) return "memory";
    if (lastTool?.toolName?.startsWith("fs.") || touchedFiles.length > 0) return "files";
    if (activeWorkflows.length > 0) return "workflow";
    if (latestProjectInfo) return "project";
    if (traces.length > 0) return "traces";
    return "overview";
  }, [approvals.length, lastTool, memoryHits.length, touchedFiles.length, activeWorkflows.length, latestProjectInfo, traces.length]);

  useEffect(() => { setContextTab(inferredContextTab); }, [inferredContextTab]);

  const openArtifact = useCallback((path: string) => {
    setSelectedArtifactPath(path);
    setArtifactContent(null);
    setArtifactPanelOpen(true);
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  const closeArtifact = useCallback(() => {
    setArtifactPanelOpen(false);
    setSelectedArtifactPath(null);
    setArtifactContent(null);
  }, []);

  useEffect(() => {
    if (!selectedArtifactPath) return;
    let cancelled = false;
    runTool("fs.read", { path: selectedArtifactPath })
      .then((res) => {
        if (cancelled) return;
        const data = res?.result as Record<string, unknown> | undefined;
        const content = typeof data?.content === "string" ? data.content : "";
        setArtifactContent(content);
      })
      .catch(() => {
        if (!cancelled) setArtifactContent("");
      });
    return () => { cancelled = true; };
  }, [selectedArtifactPath]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result;
          if (typeof dataUrl === "string") {
            setPastedImages((prev) => [...prev, dataUrl]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const removeImage = useCallback((idx: number) => {
    setPastedImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const tryStreamChat = useCallback(
    async (text: string, assistantId: string, priorHistory: SessionHistoryMessage[], meta: SessionMeta): Promise<boolean> => {
      try {
        const res = await fetch(`${GATEWAY_URL}/api/chat/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, chatId: meta.chatId, threadId: meta.threadId, history: priorHistory }),
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
                setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, streamEvents: [...(e.streamEvents ?? []), { type: "thinking" }] } : e));
              }
              if (type === "text-delta" && typeof event.text === "string") {
                fullText += event.text;
                setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, content: fullText, streaming: true } : e));
              }
              if (type === "tool_call") {
                setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, streamEvents: [...(e.streamEvents ?? []), { type: "tool_call", toolCallId: String(event.toolCallId ?? ""), toolName: String(event.toolName ?? ""), args: (event.args as Record<string, unknown>) ?? {} }] } : e));
              }
              if (type === "tool_result") {
                setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, streamEvents: [...(e.streamEvents ?? []), { type: "tool_result", toolCallId: String(event.toolCallId ?? ""), toolName: String(event.toolName ?? ""), ok: event.ok === true, result: event.result, error: typeof event.error === "string" ? event.error : undefined }] } : e));
              }
              if (type === "approval_requested" && typeof event.approvalId === "string") {
                setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, streamEvents: [...(e.streamEvents ?? []), { type: "approval_requested", approvalId: event.approvalId as string }] } : e));
              }
              if (type === "complete" || type === "finish") {
                if (typeof event.text === "string") fullText = event.text;
                if (Array.isArray(event.toolResults)) toolResults = event.toolResults as ToolResult[];
                setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, content: fullText || "Done.", toolResults, streamEvents: undefined, streaming: false } : e));
                if (toolResults.some((r) => r.toolName === "tasks.appendEvent" || r.toolName === "fs.write")) {
                  try { window.dispatchEvent(new CustomEvent("claws:refresh-context")); } catch {}
                }
              }
              if (type === "error" && typeof event.error === "string") setError(event.error);
            } catch {}
          }
        }
        if (fullText || toolResults.length > 0) {
          setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, content: fullText || "Done.", toolResults, streamEvents: undefined, streaming: false } : e));
          if (toolResults.some((r) => r.toolName === "tasks.appendEvent" || r.toolName === "fs.write")) {
            try { window.dispatchEvent(new CustomEvent("claws:refresh-context")); } catch {}
          }
        }
        return true;
      } catch { return false; }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      const raw = text.trim();
      const priorHistory: SessionHistoryMessage[] = history.filter((e) => e.content.trim()).map((e) => ({ role: e.role, content: e.content }));
      const userEntry: ChatEntry = { id: crypto.randomUUID(), role: "user", content: raw, ts: Date.now(), images: pastedImages.length > 0 ? [...pastedImages] : undefined };
      const assistantId = crypto.randomUUID();
      const placeholderEntry: ChatEntry = { id: assistantId, role: "assistant", content: "", streamEvents: [], ts: Date.now(), streaming: true };

      setHistory((prev) => [...prev, userEntry, placeholderEntry]);
      setMessage("");
      setPastedImages([]);
      setLoading(true);
      setError(null);
      setShowSlashMenu(false);
      setShowMentionMenu(false);

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
              setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, content: summary, streaming: false } : e));
              setLoading(false);
              setLiveStateRefreshTrigger((t) => t + 1);
              inputRef.current?.focus();
              void loadContext();
              return;
            }
          }
        }

        if (meta.chatId.startsWith("conv_")) {
          const res = await postConversationMessage(meta.chatId, { message: text.trim(), history: priorHistory });
          const result = res?.result;
          const summary = (result && "summary" in result ? result.summary : null) ?? (result && "messages" in result ? (result as { messages?: string[] }).messages?.[0] : null) ?? "Done.";
          setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, content: summary, streaming: false } : e));
          return;
        }

        const streamed = await tryStreamChat(text.trim(), assistantId, priorHistory, meta);
        if (!streamed) {
          const res = await fetch(`${GATEWAY_URL}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: text.trim(), chatId: meta.chatId, threadId: meta.threadId, history: priorHistory }),
          });
          if (!res.ok) throw new Error(`Gateway error: ${res.status}`);
          const data = (await res.json()) as { result?: { summary?: string; messages?: string[]; toolResults?: ToolResult[] }; summary?: string; messages?: string[]; toolResults?: ToolResult[] };
          const result = data.result ?? data;
          const summary = result.summary ?? result.messages?.[0] ?? "Done.";
          const toolResults = result.toolResults ?? [];
          setHistory((prev) => prev.map((e) => e.id === assistantId ? { ...e, content: summary, toolResults, streaming: false } : e));
          if (toolResults.some((r) => r.toolName === "tasks.appendEvent" || r.toolName === "fs.write")) {
            try { window.dispatchEvent(new CustomEvent("claws:refresh-context")); } catch {}
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setHistory((prev) => prev.filter((e) => e.id !== assistantId || e.content));
      } finally {
        setLoading(false);
        setLiveStateRefreshTrigger((t) => t + 1);
        inputRef.current?.focus();
        void loadContext();
      }
    },
    [history, loadContext, loading, meta, pastedImages, tryStreamChat, updateChatActivity, updateChatTitle]
  );

  const handleEditSubmit = useCallback((entryId: string) => {
    if (!editingContent.trim()) return;
    const idx = history.findIndex((e) => e.id === entryId);
    if (idx === -1) return;
    const trimmed = history.slice(0, idx);
    setHistory(trimmed);
    setEditingMessageId(null);
    setEditingContent("");
    setTimeout(() => sendMessage(editingContent.trim()), 50);
  }, [editingContent, history, sendMessage]);

  const onSubmit = useCallback((e: React.FormEvent) => { e.preventDefault(); sendMessage(message); }, [message, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (showSlashMenu || showMentionMenu) return;
        e.preventDefault();
        sendMessage(message);
      }
    },
    [message, sendMessage, showSlashMenu, showMentionMenu]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursorPos);

    const slashMatch = textBefore.match(/^\/(\S*)$/);
    if (slashMatch) {
      setShowSlashMenu(true);
      setSlashFilter(slashMatch[1] ?? "");
      setShowMentionMenu(false);
    } else {
      setShowSlashMenu(false);
    }

    const mentionMatch = textBefore.match(/@(\S*)$/);
    if (mentionMatch) {
      setShowMentionMenu(true);
      setMentionFilter(mentionMatch[1] ?? "");
      setShowSlashMenu(false);
    } else {
      setShowMentionMenu(false);
    }
  }, []);

  const selectSlashCommand = useCallback((cmd: string) => {
    setMessage(cmd.startsWith("/") ? cmd + " " : cmd);
    setShowSlashMenu(false);
    inputRef.current?.focus();
  }, []);

  const selectMention = useCallback((prefix: string) => {
    const cursorPos = inputRef.current?.selectionStart ?? message.length;
    const textBefore = message.slice(0, cursorPos);
    const textAfter = message.slice(cursorPos);
    const replaced = textBefore.replace(/@\S*$/, `@${prefix}`);
    setMessage(replaced + textAfter);
    setShowMentionMenu(false);
    inputRef.current?.focus();
  }, [message]);

  const clearConversation = useCallback(() => {
    newChat();
    setHistory([]);
    setError(null);
    setMessage("");
    setPastedImages([]);
    try { window.sessionStorage.removeItem(CHAT_DRAFT_KEY); } catch {}
    inputRef.current?.focus();
  }, [newChat]);

  const filteredSlashCommands = useMemo(
    () => SLASH_COMMANDS.filter((c) => !slashFilter || c.label.toLowerCase().includes(slashFilter.toLowerCase()) || c.command.toLowerCase().includes(slashFilter.toLowerCase())),
    [slashFilter]
  );

  const filteredMentionTargets = useMemo(
    () => MENTION_TARGETS.filter((t) => !mentionFilter || t.label.toLowerCase().includes(mentionFilter.toLowerCase()) || t.prefix.toLowerCase().includes(mentionFilter.toLowerCase())),
    [mentionFilter]
  );

  return (
    <Shell>
      <div className="flex h-screen flex-col bg-background">
        <header className="shrink-0 border-b border-border bg-background px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-foreground tracking-tight truncate">Session</h1>
              <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                {loading ? "Claws is responding…" : status?.gateway === "online" && status?.ai?.enabled ? "Chat, build, and ship — projects, tasks, memory & tools" : status?.gateway === "online" && !status?.ai?.enabled ? "Gateway online — configure API keys in Settings to enable AI" : status?.gateway === "offline" ? "Gateway offline — start the gateway to use chat" : "Connecting…"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={async () => {
                const next = !intelligencePanelOpen;
                setIntelligencePanelOpen(next);
                if (next && meta.chatId) {
                  setIntelligenceLoading(true);
                  try { const res = await getChatIntelligence(meta.chatId, meta.threadId); setIntelligenceData(res.intelligence ?? null); } catch { setIntelligenceData(null); } finally { setIntelligenceLoading(false); }
                }
              }} className={cn("text-muted-foreground hover:text-foreground", intelligencePanelOpen && "text-foreground")} title="Chat intelligence" aria-label={intelligencePanelOpen ? "Close chat intelligence panel" : "Open chat intelligence panel"}>
                <ScanEye size={14} />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setContextPanelOpen(!contextPanelOpen)} className={cn("text-muted-foreground hover:text-foreground hidden xl:flex", contextPanelOpen && "text-foreground")} title={contextPanelOpen ? "Hide context panel" : "Show context panel"} aria-label={contextPanelOpen ? "Hide context panel" : "Show context panel"}>
                {contextPanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setContextPanelOpen(true)} className="flex xl:hidden" title="Open context panel" aria-label="Open context panel">
                <PanelRightOpen size={14} className="mr-1.5" />
                Context
              </Button>
              {history.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearConversation} className="text-muted-foreground hover:text-foreground" title="Clear and start over" aria-label="Clear conversation">
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
            {status?.gateway === "online" ? (
              <Link href="/settings" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors no-underline">
                <StatusDot variant={status?.ai?.enabled ? "success" : "warning"} />
                {status?.ai?.enabled ? `AI: ${status.ai.model ?? "active"}` : "AI: not configured"}
              </Link>
            ) : null}
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
          </div>
        </header>

        {intelligencePanelOpen ? (
          <IntelligencePanel
            intelligenceLoading={intelligenceLoading}
            intelligenceData={intelligenceData}
            creatingTasks={creatingTasks}
            savingMemoryId={savingMemoryId}
            onClose={() => setIntelligencePanelOpen(false)}
            onCreateTasks={async () => {
              setCreatingTasks(true);
              try { for (const t of intelligenceData?.detected_tasks ?? []) await createTask({ task: t.title, section: "Active", priority: t.priority ?? "P2", owner: "human" }); } finally { setCreatingTasks(false); }
            }}
            onSaveMemory={async (m, id) => {
              setSavingMemoryId(id);
              try {
                const res = await runTool("memory.flush", { text: m.text, source: m.source ?? "chat" }) as { ok?: boolean; result?: { ok?: boolean; entry?: { id?: string } } };
                const entryId = res?.result?.entry?.id;
                if (entryId) await createMemoryProposal({ entryId });
              } finally { setSavingMemoryId(null); }
            }}
          />
        ) : null}

        <div className={cn(
          "flex-1 min-h-0 flex",
          artifactPanelOpen && "xl:grid xl:grid-cols-[1fr_420px]",
          !artifactPanelOpen && contextPanelOpen && "xl:grid xl:grid-cols-[1fr_340px]"
        )}>
          <div className="min-h-0 flex flex-col flex-1">
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full max-w-[var(--content-max-width)] px-4 sm:px-6 py-8 space-y-6">
                {history.length === 0 && !loading ? (
                  <SessionEmptyState onSend={sendMessage} />
                ) : null}

                {history.map((entry) =>
                  entry.role === "assistant" && entry.streaming ? (
                    <div key={entry.id} className="space-y-2">
                      {!entry.content && (!entry.streamEvents?.length || entry.streamEvents.every((e) => e.type === "thinking")) ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-[13px] pt-1 animate-pulse">
                          <Loader2 size={14} className="animate-spin shrink-0" />
                          <span>Thinking…</span>
                        </div>
                      ) : null}
                      {entry.content ? (
                        <div className="text-[14px] leading-relaxed text-foreground max-w-[var(--chat-message-max-width)]">
                          <ChatMarkdown content={entry.content} />
                          <span className="inline-block w-1.5 h-4 bg-foreground/40 ml-0.5 animate-pulse rounded-sm align-middle" />
                        </div>
                      ) : null}
                      {entry.streamEvents?.length ? <StreamEventsList events={entry.streamEvents} onOpenArtifact={openArtifact} /> : null}
                    </div>
                  ) : entry.role === "assistant" && (entry.content || (entry.toolResults?.length ?? 0) > 0) ? (
                    <MessageRow key={entry.id} entry={entry} onEdit={null} onOpenArtifact={openArtifact} />
                  ) : entry.role === "user" ? (
                    <MessageRow
                      key={entry.id}
                      entry={entry}
                      onEdit={editingMessageId === entry.id ? null : () => { setEditingMessageId(entry.id); setEditingContent(entry.content); }}
                      isEditing={editingMessageId === entry.id}
                      editingContent={editingContent}
                      onEditChange={setEditingContent}
                      onEditSubmit={() => handleEditSubmit(entry.id)}
                      onEditCancel={() => { setEditingMessageId(null); setEditingContent(""); }}
                    />
                  ) : null
                )}

                {error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive space-y-2">
                    <p>{error}</p>
                    <button type="button" onClick={() => { setError(null); inputRef.current?.focus(); }} className="text-[12px] font-medium text-foreground hover:underline">
                      Dismiss and retry
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 px-4 sm:px-6 pt-2 pb-0">
              <div className="mx-auto w-full max-w-[var(--content-max-width)]">
                <LiveStateBar chatId={currentMeta?.chatId ?? meta.chatId} threadId={currentMeta?.threadId ?? meta.threadId} refreshTrigger={liveStateRefreshTrigger} />
              </div>
            </div>

            <div className="shrink-0 bg-background px-4 sm:px-6 py-3">
              <div className="mx-auto w-full max-w-[var(--content-max-width)]">
                {hydrated && status != null && status.gateway !== "online" ? (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-3 text-[13px] text-foreground">
                    <p className="font-medium mb-0.5">Gateway not connected</p>
                    <p className="text-muted-foreground text-[12px]">
                      Run <code className="text-[12px] font-[family-name:var(--font-geist-mono)] bg-surface-2 px-1.5 py-0.5 rounded">pnpm dev</code> from the workspace root to start the gateway.
                    </p>
                  </div>
                ) : hydrated && status?.gateway === "online" && status?.ai?.enabled === false ? (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 mb-3 text-[13px] text-foreground">
                    <p className="font-medium mb-0.5">AI not configured</p>
                    <p className="text-muted-foreground text-[12px]">
                      Add your API keys in{" "}
                      <Link href="/settings" className="text-primary hover:underline font-medium">Settings → Environment & Keys</Link>
                      {" "}(Raw view) to enable AI chat. The gateway is running but needs at least one provider key.
                    </p>
                  </div>
                ) : null}

                {pastedImages.length > 0 ? (
                  <div className="flex gap-2 pb-2 overflow-x-auto">
                    {pastedImages.map((img, idx) => (
                      <div key={idx} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-1">
                        <img src={img} alt={`Pasted ${idx + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <form onSubmit={onSubmit} className="relative">
                  {showSlashMenu && filteredSlashCommands.length > 0 ? (
                    <div ref={slashMenuRef} className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-10 max-h-[240px] overflow-y-auto">
                      {filteredSlashCommands.map((cmd) => (
                        <button key={cmd.command} type="button" onClick={() => selectSlashCommand(cmd.command)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                          <span className="shrink-0 text-[12px] font-[family-name:var(--font-geist-mono)] text-muted-foreground">/{cmd.command.trim()}</span>
                          <span className="text-[12px] text-muted-foreground truncate">{cmd.description}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {showMentionMenu && filteredMentionTargets.length > 0 ? (
                    <div ref={mentionMenuRef} className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-10 max-h-[240px] overflow-y-auto">
                      {filteredMentionTargets.map((target) => {
                        const Icon = target.icon;
                        return (
                          <button key={target.prefix} type="button" onClick={() => selectMention(target.prefix)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                            <Icon size={14} className="shrink-0 text-muted-foreground" />
                            <span className="text-[13px] text-foreground font-medium">{target.label}</span>
                            <span className="text-[12px] text-muted-foreground truncate">{target.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border bg-surface-1 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      placeholder="Ask Claws anything…"
                      title="Enter to send · Shift+Enter for new line"
                      rows={1}
                      disabled={loading}
                      className="w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3 pb-1 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 font-[family-name:var(--font-geist-sans)] min-h-[44px] max-h-[var(--composer-max-height)]"
                    />
                    <div className="flex items-center justify-between px-3 pb-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setShowSlashMenu(!showSlashMenu); setShowMentionMenu(false); if (!showSlashMenu) { setMessage("/"); inputRef.current?.focus(); } }}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Slash commands"
                        >
                          <Slash size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowMentionMenu(!showMentionMenu); setShowSlashMenu(false); if (!showMentionMenu) { setMessage((prev) => prev + "@"); inputRef.current?.focus(); } }}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="@ mention"
                        >
                          <AtSign size={14} />
                        </button>
                        <label className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer" title="Attach image">
                          <ImageIcon size={14} />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result;
                              if (typeof dataUrl === "string") setPastedImages((prev) => [...prev, dataUrl]);
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }} />
                        </label>
                        <div className="h-4 w-px bg-border mx-1" />
                        <ChatModeSelector mode={chatMode} onChange={setChatMode} />
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !message.trim()}
                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-30 hover:opacity-90"
                        aria-label="Send message"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.2} />}
                      </button>
                    </div>
                  </div>
                </form>
                <p className="mt-1.5 text-[11px] text-muted-foreground/60 text-center">
                  Enter to send · Shift+Enter for new line · Type / for commands · @ to mention
                </p>
              </div>
            </div>
          </div>

          {artifactPanelOpen && selectedArtifactPath ? (
            <ArtifactPanel
              path={selectedArtifactPath}
              content={artifactContent}
              onClose={closeArtifact}
            />
          ) : null}
          {!artifactPanelOpen && contextPanelOpen ? (
            <ContextPanel
              contextTab={contextTab}
              setContextTab={setContextTab}
              latestTask={latestTask}
              latestProjectInfo={latestProjectInfo}
              touchedFiles={touchedFiles}
              approvals={approvals}
              memoryHits={memoryHits}
              traces={traces}
              activeWorkflows={activeWorkflows}
            />
          ) : null}
          {!artifactPanelOpen && contextPanelOpen ? (
            <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close context panel"
                onClick={() => setContextPanelOpen(false)}
              />
              <div className="relative w-full max-w-[340px] bg-surface-1 border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
                <ContextPanel
                  variant="drawer"
                  onClose={() => setContextPanelOpen(false)}
                  contextTab={contextTab}
                  setContextTab={setContextTab}
                  latestTask={latestTask}
                  latestProjectInfo={latestProjectInfo}
                  touchedFiles={touchedFiles}
                  approvals={approvals}
                  memoryHits={memoryHits}
                  traces={traces}
                  activeWorkflows={activeWorkflows}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

function ChatModeSelector({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const modes: { value: ChatMode; label: string; desc: string }[] = [
    { value: "agent", label: "Agent", desc: "Full tool access and actions" },
    { value: "plan", label: "Plan", desc: "Read-only planning mode" },
    { value: "chat", label: "Chat", desc: "Conversational, no tools" },
  ];
  const current = modes.find((m) => m.value === mode) ?? modes[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {current.label}
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute bottom-full left-0 mb-1 w-48 rounded-xl border border-border bg-background shadow-lg overflow-hidden z-20">
            {modes.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { onChange(m.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors",
                  mode === m.value && "bg-muted/40"
                )}
              >
                <div className="text-[12px] font-medium text-foreground">{m.label}</div>
                <div className="text-[11px] text-muted-foreground">{m.desc}</div>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SessionEmptyState({ onSend }: { onSend: (cmd: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="space-y-2 max-w-md">
          <p className="text-[20px] font-semibold text-foreground tracking-tight">What can I help with?</p>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            Chat, build, and ship in one place. Projects, tasks, memory, and tools—all connected.
          </p>
        </div>
      </div>
      <div className="w-full max-w-lg">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => onSend(prompt.command)}
              className="rounded-xl border border-border bg-surface-1 p-3.5 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="text-[13px] font-medium text-foreground">{prompt.label}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{prompt.note}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  entry,
  onEdit,
  onOpenArtifact,
  isEditing,
  editingContent,
  onEditChange,
  onEditSubmit,
  onEditCancel,
}: {
  entry: ChatEntry;
  onEdit: (() => void) | null;
  onOpenArtifact?: (path: string) => void;
  isEditing?: boolean;
  editingContent?: string;
  onEditChange?: (val: string) => void;
  onEditSubmit?: () => void;
  onEditCancel?: () => void;
}) {
  const isUser = entry.role === "user";
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(() => {
    if (!entry.content) return;
    navigator.clipboard.writeText(entry.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [entry.content]);

  if (isEditing && isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[var(--chat-message-max-width)] w-full space-y-2">
          <textarea
            value={editingContent}
            onChange={(e) => onEditChange?.(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSubmit?.(); } if (e.key === "Escape") onEditCancel?.(); }}
            className="w-full rounded-xl border border-border bg-surface-1 px-4 py-3 text-[14px] text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[60px]"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onEditCancel} className="px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="button" onClick={onEditSubmit} className="px-3 py-1.5 rounded-lg text-[12px] bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Submit</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("group relative", isUser ? "flex justify-end" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn("max-w-[var(--chat-message-max-width)] w-full", isUser ? "text-right" : "")}>
        {entry.images?.length ? (
          <div className={cn("flex gap-2 mb-2", isUser ? "justify-end" : "")}>
            {entry.images.map((img, idx) => (
              <img key={idx} src={img} alt={`Attachment ${idx + 1}`} className="max-w-[200px] max-h-[200px] rounded-xl border border-border object-cover" />
            ))}
          </div>
        ) : null}
        <div className="flex items-start gap-1.5">
          {isUser ? (
            <>
              {hovered && onEdit ? (
                <button type="button" onClick={onEdit} className="shrink-0 mt-2 p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all opacity-0 group-hover:opacity-100" title="Edit message">
                  <Pencil size={13} />
                </button>
              ) : null}
              <div className="inline-block rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap bg-muted text-foreground ml-auto">
                {entry.content}
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="text-[14px] leading-relaxed text-foreground">
                <ChatMarkdown content={entry.content} />
                {entry.streaming ? <span className="inline-block w-1.5 h-4 bg-foreground/40 ml-0.5 animate-pulse rounded-sm align-middle" /> : null}
              </div>
              {!entry.streaming && entry.content ? (
                <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={handleCopy} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all" title={copied ? "Copied" : "Copy"}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {entry.toolResults && entry.toolResults.length > 0 ? (
          <div className="mt-2 space-y-2">
            {entry.toolResults.map((tool, idx) => (
              <ToolResultBlock key={`${tool.toolName}-${idx}`} tool={tool} onOpenArtifact={onOpenArtifact} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StreamEventsList({ events, onOpenArtifact }: { events: StreamEvent[]; onOpenArtifact?: (path: string) => void }) {
  const toolRuns = useMemo(() => {
    const runs: Array<{ toolCallId: string; toolName: string; args: Record<string, unknown>; status: "pending" | "ok" | "error"; result?: unknown; error?: string }> = [];
    const byId = new Map<string, (typeof runs)[0]>();
    for (const e of events) {
      if (e.type === "tool_call") {
        const run = { toolCallId: e.toolCallId, toolName: e.toolName, args: e.args, status: "pending" as const };
        byId.set(e.toolCallId, run);
        runs.push(run);
      } else if (e.type === "tool_result") {
        const run = byId.get(e.toolCallId);
        if (run) { run.status = e.ok ? "ok" : "error"; run.result = e.result; run.error = e.error; }
        else runs.push({ toolCallId: e.toolCallId, toolName: e.toolName, args: {}, status: e.ok ? "ok" : "error", result: e.result, error: e.error });
      }
    }
    return runs;
  }, [events]);

  const approval = events.find((e): e is StreamEvent & { type: "approval_requested" } => e.type === "approval_requested");

  return (
    <div className="space-y-2">
      {toolRuns.map((run) => {
        const path = run.result != null && typeof run.result === "object" && typeof (run.result as Record<string, unknown>).path === "string"
          ? (run.result as Record<string, unknown>).path as string
          : null;
        const isFileWrite = (run.toolName === "fs.write" || run.toolName === "fs.append") && path != null && run.status === "ok";
        if (isFileWrite && onOpenArtifact) {
          const basename = path!.split("/").filter(Boolean).pop() ?? path!;
          return (
            <div key={run.toolCallId} className="rounded-xl border border-border bg-surface-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Wrench size={12} />
                <span>{run.toolName === "fs.write" ? "Created file" : "Appended to file"}</span>
                </div>
                <Badge variant="success" className="text-[10px]">Done</Badge>
              </div>
              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpenArtifact(path!)}
                  className="flex items-center gap-2 w-full text-left rounded-lg border border-border bg-surface-2/50 hover:bg-surface-2 transition-colors px-3 py-2.5 group"
                >
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-foreground truncate" title={path!}>
                    {basename}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        }
        return (
        <div key={run.toolCallId} className="rounded-xl border border-border bg-surface-1 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              {run.status === "pending" ? <Loader2 size={12} className="animate-spin shrink-0" /> : <Wrench size={12} className="shrink-0" />}
              <span>{getToolLabel(run.toolName, run.status)}</span>
            </div>
            {run.status !== "pending" && <Badge variant={run.status === "ok" ? "success" : "destructive"} className="text-[10px]">{run.status === "ok" ? "Done" : "Error"}</Badge>}
          </div>
          {run.status !== "pending" && (run.error || run.result !== undefined) && <StreamToolResultBody toolName={run.toolName} error={run.error} result={run.result} />}
        </div>
        );
      })}
      {approval ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-[12px] text-amber-700 dark:text-amber-400"><ShieldAlert size={12} /><span>Approval required</span></div>
            <Badge variant="warning" className="text-[10px]">Pending</Badge>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            <p className="text-[12px] text-muted-foreground">This action is paused. Resolve it in Approvals to continue.</p>
            <Link href="/approvals"><Button size="sm" variant="outline"><ShieldAlert size={12} />Open Approvals</Button></Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StreamToolResultBody({ toolName, error, result }: { toolName: string; error?: string; result?: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const summary = getToolResultSummary(toolName, result, error);
  if (!error && result === undefined) return null;
  return (
    <>
      {error ? <div className="px-3 py-2 text-[12px] text-destructive">{error}</div> : null}
      {result !== undefined && result !== null ? (
        <div className="px-3 py-2">
          <button type="button" onClick={() => setExpanded((e) => !e)} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? "Hide details" : summary}
          </button>
          {expanded ? <pre className="mt-2 rounded-lg border border-border bg-code-bg p-3 text-[11px] text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre> : null}
        </div>
      ) : null}
    </>
  );
}

function ToolResultBlock({ tool, onOpenArtifact }: { tool: ToolResult; onOpenArtifact?: (path: string) => void }) {
  const isApprovalNeeded = !tool.ok && tool.error?.includes("Approval required");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const label = getToolLabel(tool.toolName, tool.ok ? "ok" : "error");
  const summary = !isApprovalNeeded && tool.data != null ? getToolResultSummary(tool.toolName, tool.data, tool.error) : null;

  const path = tool.data != null && typeof tool.data === "object" && typeof (tool.data as Record<string, unknown>).path === "string"
    ? (tool.data as Record<string, unknown>).path as string
    : null;
  const isFileWrite = (tool.toolName === "fs.write" || tool.toolName === "fs.append") && path != null;

  if (isFileWrite && tool.ok && onOpenArtifact) {
    const basename = path.split("/").filter(Boolean).pop() ?? path;
    return (
      <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Wrench size={12} />
            <span>{tool.toolName === "fs.write" ? "Created file" : "Appended to file"}</span>
          </div>
          <Badge variant="success" className="text-[10px]">Done</Badge>
        </div>
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => onOpenArtifact(path)}
            className="flex items-center gap-2 w-full text-left rounded-lg border border-border bg-surface-2/50 hover:bg-surface-2 transition-colors px-3 py-2.5 group"
          >
            <FileText size={14} className="text-muted-foreground shrink-0" />
            <span className="text-[13px] font-[family-name:var(--font-geist-mono)] text-foreground truncate" title={path}>
              {basename}
            </span>
            <ChevronRight size={14} className="text-muted-foreground shrink-0 ml-auto group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          {isApprovalNeeded ? <ShieldAlert size={12} className="text-warning" /> : <Wrench size={12} />}
          <span>{isApprovalNeeded ? "Approval required" : label}</span>
        </div>
        {isApprovalNeeded ? <Badge variant="warning" className="text-[10px]">Pending</Badge> : <Badge variant={tool.ok ? "success" : "destructive"} className="text-[10px]">{tool.ok ? "Done" : "Error"}</Badge>}
      </div>
      {isApprovalNeeded ? (
        <div className="px-3 py-2 space-y-1.5">
          <p className="text-[12px] text-muted-foreground">Resolve in Approvals to continue.</p>
          <Link href="/approvals"><Button size="sm" variant="outline"><ShieldAlert size={12} />Open Approvals</Button></Link>
        </div>
      ) : (
        <>
          {tool.error ? <div className="px-3 py-2 text-[12px] text-destructive">{tool.error}</div> : null}
          {tool.data !== undefined && tool.data !== null ? (
            <div className="px-3 py-2">
              <button type="button" onClick={() => setDetailsExpanded((e) => !e)} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                {detailsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {detailsExpanded ? "Hide details" : summary ?? "View details"}
              </button>
              {detailsExpanded ? <pre className="mt-2 rounded-lg border border-border bg-code-bg p-3 text-[11px] text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] whitespace-pre-wrap">{JSON.stringify(tool.data, null, 2)}</pre> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function IntelligencePanel({
  intelligenceLoading,
  intelligenceData,
  creatingTasks,
  savingMemoryId,
  onClose,
  onCreateTasks,
  onSaveMemory,
}: {
  intelligenceLoading: boolean;
  intelligenceData: IntelligenceData | null;
  creatingTasks: boolean;
  savingMemoryId: string | null;
  onClose: () => void;
  onCreateTasks: () => void;
  onSaveMemory: (m: { text: string; source?: string }, id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/20" aria-label="Close intelligence panel" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold flex items-center gap-2"><ScanEye size={16} />Chat intelligence</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">×</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {intelligenceLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-[13px] py-8"><Loader2 size={14} className="animate-spin shrink-0" /><span>Analyzing conversation…</span></div>
          ) : !intelligenceData ? (
            <p className="text-[13px] text-muted-foreground py-4">No analysis yet. Send messages and the AI will detect tasks, memories, and insights.</p>
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
                    {intelligenceData.detected_tasks.map((t, i) => <li key={i}>{t.title}{t.project ? ` (${t.project})` : ""}</li>)}
                  </ul>
                  <Button size="sm" variant="outline" disabled={creatingTasks} onClick={onCreateTasks}>
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
                          <Button size="sm" variant="ghost" className="mt-1.5 text-[12px]" disabled={savingMemoryId === id} onClick={() => onSaveMemory(m, id)}>
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
                    {intelligenceData.key_insights.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextPanel({
  variant = "aside",
  onClose,
  contextTab,
  setContextTab,
  latestTask,
  latestProjectInfo,
  touchedFiles,
  approvals,
  memoryHits,
  traces,
  activeWorkflows,
}: {
  variant?: "aside" | "drawer";
  onClose?: () => void;
  contextTab: ContextTab;
  setContextTab: (t: ContextTab) => void;
  latestTask: { title: string; status: string; project: string | null } | null;
  latestProjectInfo: ProjectInfo | { name: string; slug: string; path: string; hasProjectMd: boolean; hasTasksMd: boolean; status: undefined } | null;
  touchedFiles: string[];
  approvals: ApprovalItem[];
  memoryHits: { path: string; excerpt: string }[];
  traces: TraceItem[];
  activeWorkflows: WorkflowRun[];
}) {
  const Wrapper = variant === "drawer" ? "div" : "aside";
  return (
    <Wrapper className={variant === "aside" ? "hidden xl:flex min-h-0 flex-col border-l border-border bg-surface-1/50" : "min-h-0 flex flex-col flex-1"}>
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Context</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">Live context from this session.</div>
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
          </div>
        </div>
        {variant === "drawer" && onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close context panel" className="shrink-0">
            <X size={16} />
          </Button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={contextTab} onValueChange={(v) => setContextTab(v as ContextTab)}>
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
            <SidecarCard icon={<ListChecks size={14} />} title="Current task" actionHref="/tasks" actionLabel="Full view">
              {latestTask ? (
                <div className="space-y-1">
                  <div className="text-[13px] text-foreground">{latestTask.title}</div>
                  <div className="text-[12px] text-muted-foreground">{latestTask.project ? `${latestTask.project} · ` : ""}{latestTask.status}</div>
                </div>
              ) : <EmptyCopy text="No task linked to this session yet." />}
            </SidecarCard>
            <SidecarCard icon={<FolderKanban size={14} />} title="Current project" actionHref="/projects" actionLabel="Full view">
              {latestProjectInfo ? (
                <div className="space-y-1">
                  <div className="text-[13px] text-foreground">{latestProjectInfo.name}</div>
                  <div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">{latestProjectInfo.path}</div>
                </div>
              ) : <EmptyCopy text="Create or mention a project in chat to see it here." />}
            </SidecarCard>
            <SidecarCard icon={<FileText size={14} />} title="Files touched" actionHref="/files" actionLabel="Full view">
              {touchedFiles.length > 0 ? (
                <ul className="space-y-1">{touchedFiles.slice(0, 4).map((f) => <li key={f} className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] break-all">{f}</li>)}</ul>
              ) : <EmptyCopy text="Files you read or write in chat will appear here." />}
            </SidecarCard>
          </TabsContent>

          <TabsContent value="project" className="space-y-3">
            <SidecarCard icon={<FolderKanban size={14} />} title="Project focus" actionHref="/projects" actionLabel="Full view">
              {latestProjectInfo ? (
                <div className="space-y-2">
                  <div><div className="text-[13px] text-foreground">{latestProjectInfo.name}</div><div className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">{latestProjectInfo.path}</div></div>
                  <div className="flex flex-wrap gap-1.5">
                    {latestProjectInfo.hasProjectMd ? <Badge variant="outline" className="text-[10px]">project.md</Badge> : null}
                    {latestProjectInfo.hasTasksMd ? <Badge variant="outline" className="text-[10px]">tasks.md</Badge> : null}
                    {latestProjectInfo.status ? <Badge variant="secondary" className="text-[10px]">{latestProjectInfo.status}</Badge> : null}
                  </div>
                </div>
              ) : <EmptyCopy text="Create or reference a project in chat to pin it here." />}
            </SidecarCard>
          </TabsContent>

          <TabsContent value="files" className="space-y-3">
            <SidecarCard icon={<FileText size={14} />} title="Touched files" actionHref="/files" actionLabel="Full view">
              {touchedFiles.length > 0 ? (
                <ul className="space-y-1">{touchedFiles.map((f) => <li key={f} className="text-[12px] text-muted-foreground font-[family-name:var(--font-geist-mono)] break-all">{f}</li>)}</ul>
              ) : <EmptyCopy text="No tracked file touches in this session yet." />}
            </SidecarCard>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-3">
            <SidecarCard icon={<ShieldAlert size={14} />} title="Approvals needed" actionHref="/approvals" actionLabel="Full view">
              {approvals.length > 0 ? (
                <div className="space-y-2">{approvals.slice(0, 4).map((a) => (
                  <div key={a.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <div className="text-[12px] font-medium text-foreground">{a.toolName}</div>
                    <div className="text-[11px] text-muted-foreground">{a.agentId} · {a.risk} risk</div>
                  </div>
                ))}</div>
              ) : <EmptyCopy text="All clear. When Claws needs your approval, it'll show here first." />}
            </SidecarCard>
          </TabsContent>

          <TabsContent value="memory" className="space-y-3">
            <SidecarCard icon={<Brain size={14} />} title="Memory hits" actionHref="/memory" actionLabel="Full view">
              {memoryHits.length > 0 ? (
                <div className="space-y-2">{memoryHits.map((h) => (
                  <div key={h.path} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <div className="text-[11px] text-foreground font-[family-name:var(--font-geist-mono)] break-all">{h.path}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">{h.excerpt}</div>
                  </div>
                ))}</div>
              ) : <EmptyCopy text="Search memory in chat to see results here." />}
            </SidecarCard>
          </TabsContent>

          <TabsContent value="traces" className="space-y-3">
            <SidecarCard icon={<Sparkles size={14} />} title="Trace timeline" actionHref="/traces" actionLabel="Full view">
              {traces.length > 0 ? (
                <div className="space-y-2">{traces.slice(0, 6).map((t) => (
                  <div key={t.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <div className="text-[12px] text-foreground">{t.summary}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{t.type} · {t.agentId}</div>
                  </div>
                ))}</div>
              ) : <EmptyCopy text="Tool calls and traces will appear here as you chat." />}
            </SidecarCard>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-3">
            <SidecarCard icon={<Workflow size={14} />} title="Workflow state" actionHref="/workflows" actionLabel="Full view">
              {activeWorkflows.length > 0 ? (
                <div className="space-y-2">{activeWorkflows.slice(0, 4).map((w) => (
                  <div key={w.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <div className="flex items-center gap-2"><StatusDot variant={w.status === "running" ? "running" : "neutral"} pulse={w.status === "running"} /><div className="text-[12px] text-foreground">{w.name}</div></div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{w.steps.filter((s) => s.status === "completed").length}/{w.steps.length} steps · {w.status}</div>
                  </div>
                ))}</div>
              ) : <EmptyCopy text="Long-running workflows will appear here when started." />}
            </SidecarCard>
          </TabsContent>
        </Tabs>
      </div>
    </Wrapper>
  );
}

function SidecarCard({ icon, title, children, actionHref, actionLabel }: { icon: React.ReactNode; title: string; children: React.ReactNode; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground"><span className="text-muted-foreground">{icon}</span>{title}</div>
        {actionHref && actionLabel ? <Link href={actionHref} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline">{actionLabel}</Link> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return <div className="text-[12px] text-muted-foreground">{text}</div>;
}
