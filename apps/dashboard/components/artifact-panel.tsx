"use client";

import { useCallback, useState } from "react";
import { X, Code, Eye, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export type ArtifactPanelProps = {
  path: string;
  content: string | null;
  onClose: () => void;
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

export function ArtifactPanel({ path, content, onClose }: ArtifactPanelProps) {
  const [tab, setTab] = useState<"code" | "preview">("code");
  const basename = getBasename(path);
  const showPreview = content != null && isHtml(path, content);

  const openInBrowser = useCallback(() => {
    if (content == null || !isHtml(path, content)) return;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [content, path]);

  if (content === null) {
    return (
      <aside className="hidden xl:flex w-[420px] shrink-0 flex-col border-l border-border bg-surface-1/50">
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
      </aside>
    );
  }

  return (
    <aside className="hidden xl:flex w-[420px] shrink-0 flex-col border-l border-border bg-surface-1/50 min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] font-medium text-foreground truncate" title={path}>
            {basename}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showPreview ? (
            <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setTab("code")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                  tab === "code" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code size={12} /> Code
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                  tab === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye size={12} /> Preview
              </button>
            </div>
          ) : null}
          {showPreview && tab === "preview" ? (
            <Button variant="outline" size="sm" onClick={openInBrowser} className="text-[11px] h-7">
              <ExternalLink size={12} /> Open in browser
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="h-7 w-7 p-0">
            <X size={14} />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === "code" ? (
          <div className="flex-1 overflow-auto p-3">
            <pre className="text-[12px] font-[family-name:var(--font-geist-mono)] leading-relaxed whitespace-pre-wrap break-words text-foreground">
              <code>{content || "(empty)"}</code>
            </pre>
          </div>
        ) : showPreview ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <iframe
              title={`Preview: ${basename}`}
              srcDoc={content}
              className="w-full flex-1 min-h-0 border-0 bg-white dark:bg-[#0a0a0a]"
              sandbox="allow-scripts"
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
