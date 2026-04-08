"use client";

import { useMemo } from "react";
import { Wrench, Loader2, X, Eye, FileCode2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export type LiveCanvasPanelProps = {
  open: boolean;
  onClose: () => void;
  streamEvents?: Array<
    | { type: "thinking" }
    | { type: "tool_call"; toolName: string; args?: Record<string, unknown> }
    | { type: "tool_result"; toolName: string; ok: boolean }
  >;
  loading: boolean;
  className?: string;
  variant?: "sidebar" | "drawer";
  previewHtml?: string | null;
  previewLabel?: string;
};

export function LiveCanvasPanel({
  open,
  onClose,
  streamEvents = [],
  loading,
  className,
  variant = "sidebar",
  previewHtml,
  previewLabel,
}: LiveCanvasPanelProps) {
  const tools = useMemo(() => {
    const names: string[] = [];
    for (const e of streamEvents) {
      if (e.type === "tool_call") names.push(e.toolName.replace(/^fs_/, "fs."));
    }
    return names.slice(-8);
  }, [streamEvents]);

  if (!open) return null;

  const showPreview = Boolean(previewHtml && previewHtml.trim().length > 0);

  return (
    <aside
      className={cn(
        "flex flex-col border-border min-h-0 min-w-0 overflow-hidden h-full md:h-full",
        variant === "drawer" ? "border-0" : "border-l",
        "bg-background text-foreground",
        "w-full shrink-0",
        className
      )}
      aria-label="Live preview"
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shrink-0">
            {showPreview ? <Eye size={14} strokeWidth={2} /> : <FileCode2 size={14} strokeWidth={2} />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium tracking-tight truncate text-foreground">
              {showPreview ? "Preview" : "Canvas"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {previewLabel ?? "Opens when the agent writes HTML"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 rounded-[10px] shrink-0"
          aria-label="Close panel"
        >
          <X size={16} strokeWidth={1.8} />
        </Button>
      </div>

      {showPreview ? (
        <div className="relative flex-1 min-h-[200px] flex flex-col bg-muted/20 border-b border-border">
          <iframe
            title="Live preview"
            srcDoc={previewHtml!}
            className="w-full flex-1 min-h-[260px] border-0 bg-white"
            sandbox="allow-scripts"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col items-center justify-center px-5 py-6 text-center bg-muted/10",
          showPreview ? "min-h-[88px] flex-none border-t border-border" : "flex-1 min-h-[160px]"
        )}
      >
        {loading && !showPreview ? (
          <>
            <Loader2 size={22} className="mb-3 animate-spin text-muted-foreground" strokeWidth={2} />
            <p className="text-[13px] font-medium text-foreground">Working…</p>
            <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-muted-foreground">
              Tool calls appear below. HTML preview shows when a page is saved.
            </p>
          </>
        ) : !showPreview ? (
          <p className="text-[12px] text-muted-foreground max-w-[220px] leading-relaxed">
            Send a message to run the agent. This panel shows preview and recent tools.
          </p>
        ) : null}

        {tools.length > 0 ? (
          <div className="mt-5 w-full max-w-[280px] space-y-2 text-left">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Recent tools</p>
            <ul className="space-y-1.5">
              {tools.map((name, i) => (
                <li key={`${name}-${i}`} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Wrench size={11} className="shrink-0 opacity-50" strokeWidth={1.8} />
                  <span className="truncate font-mono">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
