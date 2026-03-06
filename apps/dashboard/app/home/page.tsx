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
  Sparkles,
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
    <div className="flex flex-1 flex-col min-h-0 w-full">
        {/* Hero: Pulse / Notion style */}
        <div className="shrink-0 border-b border-border bg-gradient-to-b from-surface-1/60 to-background px-6 py-8 md:py-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Sparkles size={14} strokeWidth={1.8} />
              <span className="text-[12px] font-medium uppercase tracking-wider">Home</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              What do you want to work on?
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground max-w-lg">
              Start a new chat, pick up a recent session, or jump into Tasks, Projects, or Memory.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleNewChat}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium",
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                )}
              >
                <MessageSquarePlus size={16} strokeWidth={1.8} />
                New chat
              </button>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium border border-border bg-background hover:bg-surface-1 text-foreground no-underline transition-colors"
              >
                <ListChecks size={16} strokeWidth={1.6} />
                Tasks
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium border border-border bg-background hover:bg-surface-1 text-foreground no-underline transition-colors"
              >
                <FolderKanban size={16} strokeWidth={1.6} />
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
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Surfaces
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SHORTCUTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border bg-surface-1/50 p-3",
                        "hover:bg-surface-1 hover:border-border/80 transition-colors no-underline text-left"
                      )}
                    >
                      <div className="rounded-md bg-muted/60 p-2 shrink-0">
                        <Icon size={16} strokeWidth={1.5} className="text-muted-foreground" />
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
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Recent sessions
              </h2>
              {recentSessions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface-1/30 px-4 py-6 text-center">
                  <MessageSquare className="mx-auto text-muted-foreground/50 mb-2" size={24} strokeWidth={1.2} />
                  <p className="text-[13px] text-muted-foreground">No chats yet</p>
                  <p className="text-[12px] text-muted-foreground/80 mt-0.5">
                    Start a new chat to see sessions here.
                  </p>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="mt-3 text-[12px] font-medium text-primary hover:underline"
                  >
                    New chat
                  </button>
                </div>
              ) : (
                <ul className="rounded-lg border border-border bg-surface-1/30 divide-y divide-border overflow-hidden">
                  {recentSessions.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleOpenChat(item.chatId)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-1 transition-colors"
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
