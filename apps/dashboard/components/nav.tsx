"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  MessageSquarePlus,
  Search,
  Star,
  FolderKanban,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Hash,
  Plus,
  Bot,
  ListChecks,
  Files,
  Brain,
  Workflow,
  Zap,
  ShieldCheck,
  Activity,
  Home,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { useSidebar } from "./shell";
import { getProjects, getChannels, createChannel, type ProjectInfo, type ChannelInfo } from "../lib/api";
import { useChatList } from "./chat-list-context";
import { ensureChatInList } from "../lib/chat-list";
import type { ChatListItem } from "../lib/chat-list";

const SIDEBAR_COLLAPSED_KEY = "claws-sidebar-collapsed";
const SECTION_OPEN_KEY_PREFIX = "claws-nav-section-";

const PRIMARY_NAV_LINKS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/files", label: "Files", icon: Files },
  { href: "/memory", label: "Memory", icon: Brain },
] as const;

const MORE_LINKS = [
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/proactivity", label: "Proactivity", icon: Zap },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/traces", label: "Traces", icon: Activity },
  { href: "/agents", label: "Agents", icon: Bot },
] as const;

function getSectionOpen(storageKey: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  try {
    const v = localStorage.getItem(SECTION_OPEN_KEY_PREFIX + storageKey);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {}
  return defaultOpen;
}

function setSectionOpen(storageKey: string, open: boolean): void {
  try {
    localStorage.setItem(SECTION_OPEN_KEY_PREFIX + storageKey, open ? "1" : "0");
  } catch {}
}

function CollapsibleSection({
  label,
  storageKey,
  defaultOpen,
  collapsed,
  icon,
  children,
}: {
  label: string;
  storageKey: string;
  defaultOpen: boolean;
  collapsed: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  /** Always defaultOpen on first paint so SSR matches client (localStorage applied after hydrate). */
  const [open, setOpenState] = useState(defaultOpen);
  useLayoutEffect(() => {
    setOpenState(getSectionOpen(storageKey, defaultOpen));
  }, [storageKey, defaultOpen]);
  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      setSectionOpen(storageKey, next);
      return next;
    });
  }, [storageKey]);

  if (collapsed) return <>{children}</>;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-1.5 py-1 px-2 rounded text-sidebar-foreground/45 hover:text-sidebar-foreground/70 hover:bg-sidebar-hover/40 transition-colors text-left group"
        aria-expanded={open}
      >
        <ChevronDown
          size={9}
          className={cn("shrink-0 transition-transform opacity-60 group-hover:opacity-100", !open && "-rotate-90")}
          strokeWidth={2.2}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] truncate font-[family-name:var(--font-geist-mono)]">
          {label}
        </span>
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function formatChatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 86400_000) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 604800_000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const isChatRoute = pathname === "/" || pathname === "/chat";
  const { sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } = useSidebar();
  const {
    newChat,
    selectChat,
    toggleStar,
    updateChatTitle,
    searchQuery,
    setSearchQuery,
    starred,
    chats,
    currentMeta,
    refreshList,
  } = useChatList();

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [channelCreateOpen, setChannelCreateOpen] = useState(false);
  const [channelCreateName, setChannelCreateName] = useState("");
  const [channelCreateSubmitting, setChannelCreateSubmitting] = useState(false);
  const [projectsDropdownOpen, setProjectsDropdownOpen] = useState(false);
  const projectsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectsDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (projectsDropdownRef.current && !projectsDropdownRef.current.contains(e.target as Node)) setProjectsDropdownOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [projectsDropdownOpen]);

  useEffect(() => {
    getProjects()
      .then((res) => {
        setProjects(res?.projects ?? []);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    getChannels()
      .then((res) => {
        setChannels(res?.channels ?? []);
      })
      .catch(() => setChannels([]));
  }, []);

  const handleNewChat = useCallback(() => {
    newChat();
    if (!isChatRoute) router.push("/");
  }, [newChat, isChatRoute, router]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      selectChat(chatId);
      if (!isChatRoute) router.push("/");
    },
    [selectChat, isChatRoute, router]
  );

  const handleStarClick = useCallback(
    (e: React.MouseEvent, chatId: string) => {
      e.preventDefault();
      e.stopPropagation();
      toggleStar(chatId);
    },
    [toggleStar]
  );

  const handleSelectChannel = useCallback(
    (channel: ChannelInfo) => {
      const slug = channel.channel_slug || channel.title || "channel";
      ensureChatInList(channel.id, undefined, `#${slug}`);
      refreshList();
      selectChat(channel.id);
      if (!isChatRoute) router.push("/");
    },
    [refreshList, selectChat, isChatRoute, router]
  );

  const handleCreateChannel = useCallback(async () => {
    const name = channelCreateName.trim().replace(/^#+/, "");
    if (!name) return;
    setChannelCreateSubmitting(true);
    try {
      const res = await createChannel({ channel_slug: name, title: name });
      if (res?.channel) {
        setChannels((prev) => [res.channel!, ...prev]);
        setChannelCreateOpen(false);
        setChannelCreateName("");
        handleSelectChannel(res.channel);
      }
    } catch {
      // keep modal open on error
    } finally {
      setChannelCreateSubmitting(false);
    }
  }, [channelCreateName, handleSelectChannel]);

  return (
    <nav
      role="navigation"
      aria-label="Chat navigation"
      className={cn(
        "shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col h-screen sticky top-0 transition-[width] duration-200 ease-out",
        collapsed ? "w-[52px]" : "w-[240px]"
      )}
    >
      {/* Header: logo + collapse — Cursor-tight */}
      <div className={cn("shrink-0", collapsed ? "py-2 px-2" : "px-2.5 pt-2.5 pb-2")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1 justify-center" : "justify-between gap-1")}>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 no-underline rounded-md px-1.5 py-1 hover:bg-sidebar-hover transition-colors",
              collapsed && "justify-center px-0"
            )}
            title="Claws"
            aria-label="Claws home"
          >
            <span className="text-[16px] leading-none">🦞</span>
            {!collapsed && (
              <span className="text-[12px] font-semibold text-foreground tracking-tight">Claws</span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-hover rounded transition-colors shrink-0 focus-visible:outline-none"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeft size={14} strokeWidth={1.8} /> : <PanelLeftClose size={14} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      {/* New chat + Search — tighter, more Cursor-like */}
      <div className={cn("shrink-0", collapsed ? "px-2" : "px-2.5 pb-2")}>
        {!collapsed ? (
          <>
            <Link
              href="/"
              onClick={(e) => { if (isChatRoute) { e.preventDefault(); handleNewChat(); } }}
              className="w-full flex items-center gap-1.5 rounded-md py-1.5 px-2 text-sidebar-foreground hover:text-foreground hover:bg-sidebar-hover no-underline transition-colors text-[12px]"
            >
              <MessageSquarePlus size={13} strokeWidth={1.8} className="shrink-0" />
              <span>New chat</span>
              <span className="ml-auto text-[10px] text-sidebar-foreground/40 font-[family-name:var(--font-geist-mono)]">⌘N</span>
            </Link>
            <div className="relative mt-1">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md bg-sidebar-hover/40 pl-7 pr-2 py-1.5 text-[12px] text-foreground placeholder:text-sidebar-foreground/40 border border-transparent focus:outline-none focus:bg-sidebar-hover/60 focus:border-sidebar-border transition-colors"
                aria-label="Search chats"
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center p-1.5 rounded hover:bg-sidebar-hover text-sidebar-foreground"
            title="New chat"
            aria-label="New chat"
          >
            <MessageSquarePlus size={14} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Primary nav: Home, Tasks, Projects (dropdown), Files, Memory */}
      <div className={cn("shrink-0", collapsed ? "px-1 pb-1" : "px-2.5 pb-1.5")}>
        {PRIMARY_NAV_LINKS.map((item) => {
          const Icon = item.icon;
          const isProjects = item.href === "/projects";
          const isActive = item.href === "/home" ? pathname === "/home" : isProjects ? pathname.startsWith("/projects") : pathname.startsWith(item.href);
          if (isProjects && !collapsed) {
            return (
              <div key={item.href} className="relative" ref={projectsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setProjectsDropdownOpen((o) => !o)}
                  className={cn(
                    "w-full flex items-center gap-2 py-1 px-2 rounded transition-colors text-[12px]",
                    isActive ? "text-foreground bg-sidebar-hover" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
                  )}
                  title={item.label}
                >
                  <Icon size={13} strokeWidth={1.7} className="shrink-0" />
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  <ChevronDown size={11} className={cn("shrink-0 transition-transform opacity-50", projectsDropdownOpen && "rotate-180")} />
                </button>
                {projectsDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 py-1 rounded-md border border-sidebar-border bg-sidebar shadow-lg z-50 min-w-[180px]">
                    <Link
                      href="/projects"
                      onClick={() => setProjectsDropdownOpen(false)}
                      className="flex items-center gap-2 py-1.5 px-2.5 text-[12px] text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground no-underline"
                    >
                      <Plus size={11} strokeWidth={1.8} className="shrink-0" />
                      New project
                    </Link>
                    {projects.slice(0, 6).map((project) => (
                      <Link
                        key={project.slug}
                        href={`/projects/${encodeURIComponent(project.slug)}`}
                        onClick={() => setProjectsDropdownOpen(false)}
                        className="flex items-center gap-2 py-1.5 px-2.5 text-[12px] text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground no-underline truncate"
                        title={project.name}
                      >
                        <FolderOpen size={11} strokeWidth={1.8} className="shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center no-underline transition-colors rounded text-[12px]",
                collapsed ? "justify-center p-1.5" : "gap-2 py-1 px-2",
                isActive ? "text-foreground bg-sidebar-hover" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
              )}
              title={item.label}
            >
              <Icon size={collapsed ? 14 : 13} strokeWidth={1.7} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Scroll: Channels, Surfaces, then Sessions at bottom (hidden when sidebar collapsed) */}
      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-2 pt-1">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
          {/* Channels (toggleable) */}
          <CollapsibleSection
            label="Channels"
            storageKey="channels"
            defaultOpen={false}
            collapsed={collapsed}
            icon={<Hash size={12} />}
          >
            {!collapsed && (
              <button
                type="button"
                onClick={() => setChannelCreateOpen(true)}
                className="w-full flex items-center gap-2 rounded-md py-1.5 px-2.5 text-[12px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-hover transition-colors text-left"
              >
                <Plus size={14} strokeWidth={1.6} className="shrink-0" />
                Create channel
              </button>
            )}
            {channels.map((channel) => {
              const slug = channel.channel_slug || channel.title || "channel";
              const displayName = `#${slug}`;
              const isActive = currentMeta?.chatId === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => handleSelectChannel(channel)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded py-1 px-2 text-left transition-colors text-[12px]",
                    collapsed ? "justify-center" : "",
                    isActive ? "bg-sidebar-hover text-foreground" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
                  )}
                  title={displayName}
                >
                  <Hash size={11} strokeWidth={1.8} className="shrink-0 opacity-60" />
                  {!collapsed && <span className="flex-1 min-w-0 truncate font-[family-name:var(--font-geist-mono)]">{slug}</span>}
                </button>
              );
            })}
            {channelCreateOpen && !collapsed && (
              <div className="px-2.5 py-1.5 border-t border-sidebar-border/50 mt-1 space-y-1.5">
                <input
                  type="text"
                  value={channelCreateName}
                  onChange={(e) => setChannelCreateName(e.target.value)}
                  placeholder="general"
                  className="w-full rounded border border-sidebar-border bg-background/50 px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateChannel}
                    disabled={channelCreateSubmitting || !channelCreateName.trim()}
                    className="rounded bg-sidebar-active-bg px-2.5 py-1 text-[12px] text-sidebar-active disabled:opacity-50"
                  >
                    {channelCreateSubmitting ? "…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setChannelCreateOpen(false); setChannelCreateName(""); }}
                    className="rounded px-2.5 py-1 text-[12px] text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Surfaces: Workflows, Proactivity, Approvals, Traces, Agents (toggleable, default closed) */}
          <CollapsibleSection
            label="Surfaces"
            storageKey="more"
            defaultOpen={false}
            collapsed={false}
            icon={<MoreHorizontal size={12} />}
          >
            {MORE_LINKS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded py-1 px-2 text-[12px] no-underline transition-colors",
                    collapsed ? "justify-center" : "",
                    isActive
                      ? "text-foreground bg-sidebar-hover"
                      : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-hover"
                  )}
                  title={item.label}
                >
                  <Icon size={12} strokeWidth={1.7} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </CollapsibleSection>

          {/* Sessions at bottom (toggleable) */}
          <CollapsibleSection
            label="Sessions"
            storageKey="sessions"
            defaultOpen={true}
            collapsed={collapsed}
            icon={<MessageSquare size={12} />}
          >
            {starred.length === 0 && chats.length === 0 ? (
              !collapsed && (
                <p className="px-2.5 py-1 text-[11px] text-sidebar-foreground/50">No chats yet</p>
              )
            ) : (
              <>
                {starred.map((item) => (
                  <ChatRow
                    key={item.id}
                    item={item}
                    isActive={currentMeta?.chatId === item.chatId}
                    collapsed={collapsed}
                    onSelect={() => handleSelectChat(item.chatId)}
                    onStarClick={(e) => handleStarClick(e, item.chatId)}
                    onRename={(title) => updateChatTitle(item.chatId, title)}
                    formatTime={formatChatTime}
                  />
                ))}
                {chats.map((item) => (
                  <ChatRow
                    key={item.id}
                    item={item}
                    isActive={currentMeta?.chatId === item.chatId}
                    collapsed={collapsed}
                    onSelect={() => handleSelectChat(item.chatId)}
                    onStarClick={(e) => handleStarClick(e, item.chatId)}
                    onRename={(title) => updateChatTitle(item.chatId, title)}
                    formatTime={formatChatTime}
                  />
                ))}
              </>
            )}
          </CollapsibleSection>
        </div>
      </div>
      )}

      {/* Footer: theme + settings */}
      <div className="shrink-0 border-t border-sidebar-border/60 px-2 py-1.5">
        <div className={cn("flex items-center gap-0.5", collapsed ? "justify-center flex-col" : "")}>
          <ThemeToggle />
          {!collapsed && (
            <Link
              href="/settings"
              className="flex items-center gap-2 py-1 px-2 rounded text-sidebar-foreground hover:text-foreground hover:bg-sidebar-hover text-[12px] no-underline transition-colors"
              title="Settings"
            >
              <Settings size={12} strokeWidth={1.7} />
              Settings
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function Section({
  label,
  collapsed,
  icon,
  children,
}: {
  label: string;
  collapsed: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  if (collapsed) return <>{children}</>;
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2.5 pb-1">
        <span className="text-sidebar-foreground/50">{icon}</span>
        <span className="text-[11px] font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ChatRow({
  item,
  isActive,
  collapsed,
  onSelect,
  onStarClick,
  onRename,
  formatTime,
}: {
  item: ChatListItem;
  isActive: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onStarClick: (e: React.MouseEvent) => void;
  onRename: (title: string) => void;
  formatTime: (ts: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(item.title);
  }, [item.title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveRename = useCallback(() => {
    const t = editValue.trim();
    if (t && t !== item.title) onRename(t);
    setEditing(false);
  }, [editValue, item.title, onRename]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full flex items-center justify-center rounded-xl py-2 px-2 text-left motion-safe:transition-colors",
          isActive ? "bg-sidebar-active-bg text-sidebar-active ring-1 ring-sidebar-border" : "text-sidebar-foreground hover:bg-sidebar-hover"
        )}
        title={item.title}
      >
        <MessageSquare size={15} strokeWidth={1.6} className="shrink-0" />
      </button>
    );
  }

  if (editing) {
    return (
      <div className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") {
              setEditValue(item.title);
              setEditing(false);
            }
          }}
          className="w-full rounded-xl border border-sidebar-border bg-background px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full flex items-center gap-1 rounded py-1 px-2 text-left transition-colors group",
        isActive
          ? "bg-sidebar-hover text-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-hover/60 hover:text-foreground"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 flex items-center gap-2 text-left focus-visible:outline-none"
        title={item.title}
      >
        <span className="flex-1 min-w-0 text-[12px] truncate leading-snug">{item.title}</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStarClick(e); }}
        className={cn(
          "p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-sidebar-hover transition-opacity shrink-0",
          item.starred && "opacity-100 text-amber-500"
        )}
        aria-label={item.starred ? "Unstar" : "Star"}
        title={item.starred ? "Unstar" : "Star"}
      >
        <Star size={10} fill={item.starred ? "currentColor" : "none"} />
      </button>
      <span className="text-[9px] tabular-nums text-sidebar-foreground/40 shrink-0 font-[family-name:var(--font-geist-mono)]">
        {formatTime(item.lastActivity)}
      </span>
    </div>
  );
}
