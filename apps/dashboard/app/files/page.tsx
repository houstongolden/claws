"use client";

import { useEffect, useState } from "react";
import {
  FolderOpen,
  Folder,
  FileText,
  Loader2,
  RefreshCw,
  PenLine,
  ChevronRight,
  HardDrive,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  PageSection,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { InlineCode } from "../../components/ui/code-block";
import { getStatus, runTool } from "../../lib/api";

const CANONICAL_DIRS = [
  {
    name: "prompt",
    desc: "System prompts, MEMORY.md, VIEWS.md, ROUTING.md",
    examplePath: "prompt/MEMORY.md",
  },
  { name: "identity", desc: "User profile, preferences, private identity files" },
  { name: "notes", desc: "Daily notes and topic notes" },
  { name: "projects", desc: "Project folders with project.md and tasks.md" },
  { name: "drafts", desc: "Work-in-progress documents and drafts" },
  { name: "assets", desc: "Media, demos, screenshots, uploads" },
  { name: "areas", desc: "Life/work areas and ongoing responsibilities" },
  { name: "skills", desc: "Installed agent skills and extensions" },
  { name: "agents", desc: "Agent configuration and custom agent definitions" },
  {
    name: "project-context",
    desc: "Build queue, roadmap, PRD, tasks.jsonl",
    examplePath: "project-context/tasks.md",
  },
];

const QUICK_READS = [
  {
    label: "Build queue",
    path: "project-context/tasks.md",
  },
  {
    label: "Next pass",
    path: "project-context/next-pass.md",
  },
  {
    label: "Current state",
    path: "project-context/current-state.md",
  },
  {
    label: "Human tasks",
    path: "project-context/human-tasks.md",
  },
];

type StatusInfo = {
  workspaceRoot?: string;
  registeredTools?: string[];
};

type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
};

export default function FilesPage() {
  const [gs, setGs] = useState<StatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [readPath, setReadPath] = useState("");
  const [currentDir, setCurrentDir] = useState("project-context");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [listing, setListing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await getStatus();
      setGs((res.status ?? null) as StatusInfo | null);
    } catch {
      setGs(null);
    } finally {
      setLoading(false);
    }
  }

  async function listDirectory(dirPath: string) {
    setListing(true);
    setFileError(null);
    try {
      const res = await runTool("fs.list", { path: dirPath });
      if (res.ok && res.result && typeof res.result === "object") {
        const result = res.result as Record<string, unknown>;
        const nextEntries = Array.isArray(result.entries)
          ? (result.entries as FileEntry[])
          : [];
        setEntries(nextEntries);
        setCurrentDir(dirPath);
        setReadPath(dirPath);
      } else {
        setFileError(res.error ?? "Failed to list directory");
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to list directory");
    } finally {
      setListing(false);
    }
  }

  useEffect(() => {
    load();
    void listDirectory("project-context");
  }, []);

  async function readFileAtPath(path: string) {
    if (!path.trim() || reading) return;
    setReading(true);
    setFileContent(null);
    setFileError(null);
    try {
      const res = await runTool("fs.read", { path: path.trim() });
      if (res.ok && res.result) {
        const data = res.result as Record<string, unknown>;
        setFileContent(String(data.content ?? ""));
        setReadPath(path.trim());
      } else {
        setFileError(res.error ?? "Failed to read file");
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setReading(false);
    }
  }

  async function handleReadFile(e: React.FormEvent) {
    e.preventDefault();
    await readFileAtPath(readPath);
  }

  const fsTools = (gs?.registeredTools ?? []).filter((t) => t.startsWith("fs."));
  const breadcrumbs = currentDir.split("/").filter(Boolean);

  return (
    <Shell>
      <PageHeader
        title="Files"
        description="Browse workspace directories and files. Backed by the real filesystem (fs.list / fs.read via gateway)."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load();
              void listDirectory(currentDir);
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <PageSection>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </div>
          ) : null}

          {!loading && !gs?.workspaceRoot ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-[13px] text-foreground">
              <p className="font-medium mb-1">Gateway unavailable</p>
              <p className="text-muted-foreground">
                Workspace path and file tools (browse, read) require the Claws gateway. Start the gateway and refresh.
              </p>
            </div>
          ) : null}

          {gs?.workspaceRoot ? (
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive size={14} className="text-muted-foreground" />
                <span className="text-[13px] font-medium">Workspace</span>
                <InlineCode>{gs.workspaceRoot}</InlineCode>
              </div>
              {fsTools.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {fsTools.map((tool) => (
                    <Badge
                      key={tool}
                      variant="outline"
                      className="text-[10px] font-[family-name:var(--font-geist-mono)]"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={14} className="text-muted-foreground" />
                <span className="text-[13px] font-medium">Workspace browser</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {CANONICAL_DIRS.map((dir) => (
                  <button
                    key={dir.name}
                    type="button"
                    onClick={() => void listDirectory(dir.name)}
                    className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] hover:bg-background transition-colors"
                  >
                    {dir.name}/
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                <button
                  type="button"
                  className="hover:text-foreground transition-colors"
                  onClick={() => void listDirectory(breadcrumbs[0] ?? currentDir)}
                >
                  /
                </button>
                {breadcrumbs.map((crumb, idx) => {
                  const path = breadcrumbs.slice(0, idx + 1).join("/");
                  return (
                    <span key={path} className="flex items-center gap-1">
                      <ChevronRight size={10} />
                      <button
                        type="button"
                        className="hover:text-foreground transition-colors"
                        onClick={() => void listDirectory(path)}
                      >
                        {crumb}
                      </button>
                    </span>
                  );
                })}
              </div>

              <div className="mt-3 rounded-md border border-border overflow-hidden">
                {listing ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-muted-foreground">
                    <Loader2 size={13} className="animate-spin" />
                    Listing {currentDir}
                  </div>
                ) : entries.length > 0 ? (
                  <div className="divide-y divide-border">
                    {entries.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() =>
                          entry.type === "directory"
                            ? void listDirectory(entry.path)
                            : void readFileAtPath(entry.path)
                        }
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                      >
                        {entry.type === "directory" ? (
                          <Folder size={13} className="text-muted-foreground shrink-0" />
                        ) : (
                          <FileText size={13} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="min-w-0 truncate text-[12px] text-foreground">
                          {entry.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-[12px] text-muted-foreground">
                    No entries found in this directory.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-muted-foreground" />
                <span className="text-[13px] font-medium">Inspector</span>
              </div>
              <form onSubmit={handleReadFile} className="flex gap-2">
                <Input
                  value={readPath}
                  onChange={(e) => setReadPath(e.target.value)}
                  placeholder="prompt/MEMORY.md"
                  disabled={reading}
                  className="flex-1 font-[family-name:var(--font-geist-mono)]"
                />
                <Button type="submit" size="default" disabled={reading || !readPath.trim()} aria-label="Read file">
                  {reading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <FileText size={13} />
                  )}
                  Read
                </Button>
              </form>

              <div className="mt-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Quick reads
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_READS.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => void readFileAtPath(item.path)}
                      className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-left hover:bg-surface-2/80 transition-colors"
                    >
                      <div className="text-[11px] text-foreground">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                        {item.path}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {fileError ? (
                <div className="mt-3 text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {fileError}
                </div>
              ) : null}
              {fileContent !== null ? (
                <pre className="mt-3 rounded-md border border-border bg-code-bg p-3 text-[12px] text-muted-foreground overflow-x-auto font-[family-name:var(--font-geist-mono)] leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                  {fileContent || "(empty file)"}
                </pre>
              ) : (
                <div className="mt-3 rounded-md border border-dashed border-border px-3 py-6 text-[12px] text-muted-foreground">
                  Select a file from the workspace browser or enter a path to inspect it here.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
              Workspace Structure
            </div>
            <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
              {CANONICAL_DIRS.map((dir) => (
                <button
                  key={dir.name}
                  type="button"
                  onClick={() => void listDirectory(dir.name)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <Folder
                    size={14}
                    className="text-muted-foreground mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium font-[family-name:var(--font-geist-mono)]">
                      {dir.name}/
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {dir.desc}
                    </div>
                    {dir.examplePath ? (
                      <div className="mt-1 text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)]">
                        Example: {dir.examplePath}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-2 mb-1.5 text-foreground font-medium">
              <PenLine size={14} />
              Creating and editing files
            </div>
            Use{" "}
            <InlineCode>create draft my-doc</InlineCode>{" "}
            or{" "}
            <InlineCode>create project my-project</InlineCode>{" "}
            in Session. File browsing uses <InlineCode>fs.list</InlineCode> and reads
            use <InlineCode>fs.read</InlineCode> directly through the gateway.
          </div>
        </PageSection>
      </PageContent>
    </Shell>
  );
}
