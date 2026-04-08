"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Code, Eye, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export type ArtifactPanelProps = {
  path: string;
  content: string | null;
  onClose: () => void;
  variant?: "sidebar" | "drawer";
};

function getBasename(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function isHtml(path: string, content: string | null): boolean {
  if (!content) return path.toLowerCase().endsWith(".html");
  const trimmed = content.trimStart();
  return trimmed.startsWith("<!") || path.toLowerCase().endsWith(".html");
}

function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    py: "python",
    rs: "rust",
    go: "go",
  };
  return map[ext] ?? "text";
}

export function ArtifactPanel({ path, content, onClose, variant = "sidebar" }: ArtifactPanelProps) {
  const [tab, setTab] = useState<"code" | "preview">("preview");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const basename = getBasename(path);
  const showPreview = content != null && isHtml(path, content);

  useEffect(() => {
    if (content == null || tab !== "code") {
      setHighlighted(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const html = await codeToHtml(content, {
          lang: langFromPath(path),
          theme: "github-dark",
        });
        if (!cancelled) setHighlighted(html);
      } catch {
        if (!cancelled) setHighlighted(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, path, tab]);

  const openInBrowser = useCallback(() => {
    if (content == null || !isHtml(path, content)) return;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [content, path]);

  const shell = (inner: React.ReactNode) => (
    <aside
      className={cn(
        "flex flex-col border-l border-border bg-background min-h-0",
        variant === "drawer" ? "w-full h-full max-w-none" : "flex w-full min-w-0 shrink-0 h-full min-h-[min(50vh,360px)] md:min-h-0"
      )}
    >
      {inner}
    </aside>
  );

  if (content === null) {
    return shell(
      <>
        <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground truncate">{basename}</span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={14} />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-[13px]">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading…
        </div>
      </>
    );
  }

  return shell(
    <>
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 bg-muted/30">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground shrink-0">Preview</span>
          <span className="text-[13px] font-medium text-foreground truncate font-[family-name:var(--font-geist-mono)]" title={path}>
            {basename}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showPreview ? (
            <div className="flex rounded-xl border border-border/80 bg-muted/40 p-1 shadow-[var(--shadow-sm)]">
              <button
                type="button"
                onClick={() => setTab("code")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-150",
                  tab === "code" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code size={12} /> Code
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors duration-150",
                  tab === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye size={12} /> Preview
              </button>
            </div>
          ) : null}
          {showPreview && tab === "preview" ? (
            <Button variant="outline" size="sm" onClick={openInBrowser} className="text-[11px] h-7">
              <ExternalLink size={12} /> Open
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="h-7 w-7 p-0">
            <X size={14} />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === "code" ? (
          <div className="flex-1 overflow-auto p-4 sm:p-5 bg-muted/15 min-h-0">
            {highlighted ? (
              <div
                className="text-[12px] rounded-xl overflow-x-auto [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:!bg-transparent leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            ) : (
              <pre className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words text-foreground p-2">
                <code>{content || "(empty)"}</code>
              </pre>
            )}
          </div>
        ) : showPreview ? (
          <div className="flex-1 min-h-0 flex flex-col bg-muted/20 border-t border-border">
            <iframe
              title={`Preview: ${basename}`}
              srcDoc={content}
              className="w-full flex-1 min-h-[280px] border-0 bg-white"
              sandbox="allow-scripts"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
