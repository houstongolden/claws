"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal,
  Cloud,
  CloudOff,
  ArrowDownCircle,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Nav } from "./nav";
import { getStatus, getSystemInfo, openCli, type SystemInfo } from "../lib/api";

type GatewayState = "online" | "offline" | "connecting";

const SIDEBAR_COLLAPSED_KEY = "claws-sidebar-collapsed";

type SidebarContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
    };
  }
  return ctx;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSessionRoute = pathname === "/" || pathname === "/chat";
  const isHomeRoute = pathname === "/home";
  const showTopBar = !isSessionRoute && !isHomeRoute;

  const [sidebarCollapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored !== null) setCollapsedState(stored === "1");
    } catch {}
  }, []);

  const setSidebarCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
    } catch {}
  }, []);

  const [gwStatus, setGwStatus] = useState<GatewayState>("connecting");
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await getStatus();
        if (!cancelled) setGwStatus(res?.status?.gateway === "online" ? "online" : "offline");
      } catch {
        if (!cancelled) setGwStatus("offline");
      }
      try {
        const info = await getSystemInfo();
        if (!cancelled && info.ok) setSysInfo(info);
      } catch {}
    }
    poll();
    const id = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarCollapsed, setSidebarCollapsed }}>
      <div className="flex min-h-screen bg-background">
        <Nav />
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {showTopBar ? (
            <div className="shrink-0 border-b border-border bg-background px-4 py-1.5">
              <div className="flex items-center justify-end gap-2">
                <OpenCliButton />
                <Separator />
                <GatewayDot status={gwStatus} />
                <SyncIndicator info={sysInfo} />
                {sysInfo?.updateAvailable ? <UpdateBadge info={sysInfo} /> : null}
                {sysInfo?.dashboard?.isCustom ? <CustomDashBadge /> : null}
                <Separator />
                <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline whitespace-nowrap">
                  Back to Chat
                </Link>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}

function Separator() {
  return <span className="w-px h-3.5 bg-border shrink-0" />;
}

function OpenCliButton() {
  const [opening, setOpening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const launch = useCallback(async (cmd: string) => {
    setOpening(true);
    setMenuOpen(false);
    try { await openCli(cmd); } catch {}
    setTimeout(() => setOpening(false), 2000);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        disabled={opening}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          opening && "opacity-60 pointer-events-none"
        )}
        title="Open Claws CLI / TUI"
      >
        <Terminal size={12} />
        CLI
        <ChevronDown size={10} className={cn("transition-transform", menuOpen && "rotate-180")} />
      </button>
      {menuOpen ? (
        <div className="absolute top-full right-0 mt-1 z-50 w-44 rounded-lg border border-border bg-background shadow-lg py-1 text-[12px]">
          <button type="button" onClick={() => launch("tui")} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2">
            <Terminal size={12} className="text-muted-foreground" />
            <div>
              <div className="font-medium text-foreground">Open TUI</div>
              <div className="text-[10px] text-muted-foreground">Full-screen terminal UI</div>
            </div>
          </button>
          <button type="button" onClick={() => launch("chat")} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2">
            <Terminal size={12} className="text-muted-foreground" />
            <div>
              <div className="font-medium text-foreground">CLI Chat</div>
              <div className="text-[10px] text-muted-foreground">Agent chat in terminal</div>
            </div>
          </button>
          <button type="button" onClick={() => launch("status")} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center gap-2">
            <Terminal size={12} className="text-muted-foreground" />
            <div>
              <div className="font-medium text-foreground">Status</div>
              <div className="text-[10px] text-muted-foreground">Gateway &amp; runtime info</div>
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GatewayDot({ status }: { status: GatewayState }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap" title={`Gateway: ${status}`}>
      <span className="relative flex h-2 w-2">
        {status === "online" ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </>
        ) : status === "connecting" ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        )}
      </span>
      {status === "online" ? "Gateway" : status === "connecting" ? "Connecting" : "Offline"}
    </span>
  );
}

function SyncIndicator({ info }: { info: SystemInfo | null }) {
  if (!info) return null;
  const enabled = info.cloudSync.enabled;
  return (
    <Link
      href="/settings"
      className={cn(
        "flex items-center gap-1 text-[11px] no-underline whitespace-nowrap transition-colors",
        enabled ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
      )}
      title={enabled ? "Cloud sync: idle" : "Cloud sync disabled"}
    >
      {enabled ? <Cloud size={12} /> : <CloudOff size={12} />}
      {enabled ? "Synced" : "Local only"}
    </Link>
  );
}

function UpdateBadge({ info }: { info: SystemInfo }) {
  return (
    <Link
      href="/settings"
      className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline no-underline whitespace-nowrap animate-pulse"
      title={`Update available: v${info.latestVersion}`}
    >
      <ArrowDownCircle size={12} />
      v{info.latestVersion}
    </Link>
  );
}

function CustomDashBadge() {
  return (
    <Link
      href="/settings"
      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground no-underline whitespace-nowrap transition-colors"
      title="Dashboard has custom modifications — your changes are safe"
    >
      <ShieldCheck size={12} className="text-emerald-500" />
      Custom
    </Link>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="shrink-0 border-b border-border bg-background px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h1>
          {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto p-6", className ?? "")}>{children}</div>;
}

export function PageSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("max-w-3xl space-y-4", className ?? "")}>{children}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border border-dashed border-border bg-surface-1/50 gap-4 text-center max-w-md mx-auto">
      <div className="rounded-full bg-muted/40 p-4 text-muted-foreground">{icon}</div>
      <div className="space-y-1.5">
        <p className="text-[14px] font-medium text-foreground">{title}</p>
        {description ? <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
