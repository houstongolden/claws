"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MessageSquarePlus,
  ListChecks,
  FolderKanban,
  Files,
  Brain,
  Workflow,
  Zap,
  ShieldCheck,
  Activity,
  Bot,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { Shell } from "../../components/shell";
import { HomeErrorBoundary } from "../../components/home-error-boundary";
import { useChatList } from "../../components/chat-list-context";
import { cn } from "../../lib/utils";
import { getChatList, getChatListSorted } from "../../lib/chat-list";
import type { ChatListItem } from "../../lib/chat-list";

const SHORTCUTS = [
  { href: "/tasks", label: "Tasks", icon: ListChecks, description: "Build queue & events" },
  { href: "/projects", label: "Projects", icon: FolderKanban, description: "Workspace projects" },
  { href: "/files", label: "Files", icon: Files, description: "Touched files" },
  { href: "/memory", label: "Memory", icon: Brain, description: "Workspace memory" },
  { href: "/workflows", label: "Workflows", icon: Workflow, description: "Workflow runs" },
  { href: "/proactivity", label: "Proactivity", icon: Zap, description: "Scheduled jobs" },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, description: "Pending approvals" },
  { href: "/traces", label: "Traces", icon: Activity, description: "Trace timeline" },
  { href: "/agents", label: "Agents", icon: Bot, description: "Agents & tools" },
] as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 86400_000) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 604800_000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function HomePage() {
  return (
    <Shell>
      <HomeErrorBoundary>
        <HomeContent />
      </HomeErrorBoundary>
    </Shell>
  );
}

function HomeContent() {
  const router = useRouter();
  const { newChat, selectChat } = useChatList();
  const [recentSessions, setRecentSessions] = useState<ChatListItem[]>([]);

  useEffect(() => {
    const list = getChatList();
    const { starred, chats } = getChatListSorted(list);
    setRecentSessions([...starred, ...chats].slice(0, 8));
  }, []);

  const handleNewChat = () => {
    newChat();
    router.push("/");
  };

  const handleOpenChat = (chatId: string) => {
    selectChat(chatId);
    router.push("/");
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full session-canvas">
        {/* Hero */}
        <div className="shrink-0 border-b border-border/60 glass-bar px-6 py-12 md:py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 text-muted-foreground mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-muted/50 text-foreground shadow-sm">
                <MessageSquare size={16} strokeWidth={2} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Home</span>
            </div>
            <h1 className="text-[clamp(1.65rem,4.5vw,2.25rem)] font-semibold text-foreground tracking-tight leading-[1.15] text-balance">
              What do you want to work on?
            </h1>
            <p className="mt-4 text-[15px] text-muted-foreground max-w-lg leading-relaxed font-[450] text-pretty">
              Start a chat, resume a session, or jump into Tasks, Projects, and Memory.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleNewChat}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold shadow-[var(--shadow-sm)]",
                  "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99] motion-safe:transition-all"
                )}
              >
                <MessageSquarePlus size={17} strokeWidth={1.8} />
                New chat
              </button>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-medium border border-border/80 bg-surface-1 hover:bg-muted/40 hover:border-border text-foreground no-underline motion-safe:transition-all shadow-[var(--shadow-sm)]"
              >
                <ListChecks size={17} strokeWidth={1.6} />
                Tasks
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-medium border border-border/80 bg-surface-1 hover:bg-muted/40 hover:border-border text-foreground no-underline motion-safe:transition-all shadow-[var(--shadow-sm)]"
              >
                <FolderKanban size={17} strokeWidth={1.6} />
                Projects
              </Link>
            </div>
          </div>
        </div>

        {/* Main content: grid + recent sessions */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Shortcuts grid — Linear / Notion style */}
            <section>
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-4">
                Surfaces
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SHORTCUTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-[var(--shadow-sm)]",
                        "hover:shadow-[var(--shadow-md)] hover:border-border motion-safe:hover-lift no-underline text-left group"
                      )}
                    >
                      <div className="rounded-xl bg-muted/50 p-2.5 shrink-0 ring-1 ring-border/40 group-hover:bg-muted/70 motion-safe:transition-colors">
                        <Icon size={17} strokeWidth={1.5} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-medium text-foreground block truncate">
                          {item.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {item.description}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Recent sessions — ChatGPT style */}
            <section>
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-4">
                Recent sessions
              </h2>
              {recentSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center shadow-[var(--shadow-sm)]">
                  <MessageSquare className="mx-auto text-muted-foreground/45 mb-3" size={28} strokeWidth={1.2} />
                  <p className="text-[14px] font-medium text-foreground">No chats yet</p>
                  <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
                    Start a new chat to see sessions here.
                  </p>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="mt-5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-[13px] font-semibold hover:opacity-90 motion-safe:transition-opacity"
                  >
                    New chat
                  </button>
                </div>
              ) : (
                <ul className="rounded-2xl border border-border/80 bg-surface-1 divide-y divide-border/80 overflow-hidden shadow-[var(--shadow-sm)]">
                  {recentSessions.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleOpenChat(item.chatId)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 motion-safe:transition-colors focus-visible:bg-muted/30"
                      >
                        <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatTime(item.lastActivity)}
                        </span>
                        <ChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
    </div>
  );
}
