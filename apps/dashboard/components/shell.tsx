"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { Nav } from "./nav";

export function Shell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isSessionRoute = pathname === "/" || pathname === "/chat";
  const isHomeRoute = pathname === "/home";

  const expandedPageTitle = !isSessionRoute && !isHomeRoute ? getExpandedPageTitle(pathname) : null;

  return (
    <div className="flex min-h-screen bg-background">
      <Nav />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {expandedPageTitle ? (
          <div className="shrink-0 border-b border-border bg-background px-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] text-muted-foreground">
                <span className="text-foreground font-medium">{expandedPageTitle}</span>
              </div>
              <Link
                href="/"
                className="text-[12px] text-foreground/80 hover:text-foreground transition-colors duration-150 no-underline font-medium"
              >
                {isHomeRoute ? "New chat" : "Back to Chat"}
              </Link>
            </div>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

function getExpandedPageTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const titles: Record<string, string> = {
    home: "Home",
    tasks: "Tasks",
    projects: "Projects",
    files: "Files",
    memory: "Memory",
    workflows: "Workflows",
    approvals: "Approvals",
    traces: "Traces",
    agents: "Agents",
    settings: "Settings",
  };
  return titles[segment] ?? (segment || "Workspace");
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-border bg-background px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-foreground tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function PageContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-6", className ?? "")}>
      {children}
    </div>
  );
}

export function PageSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-4", className ?? "")}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border border-dashed border-border bg-surface-1/50 gap-4 text-center max-w-md mx-auto">
      <div className="rounded-full bg-muted/40 p-4 text-muted-foreground">{icon}</div>
      <div className="space-y-1.5">
        <p className="text-[14px] font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
