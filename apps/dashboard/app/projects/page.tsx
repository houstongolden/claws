"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Loader2,
  RefreshCw,
  FileText,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  EmptyState,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { InlineCode } from "../../components/ui/code-block";
import { Toolbar, ToolbarLabel } from "../../components/ui/toolbar";
import { getProjects, type ProjectInfo } from "../../lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getProjects();
      setProjects(res.projects ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("claws:refresh-context", handler);
    return () => window.removeEventListener("claws:refresh-context", handler);
  }, []);

  return (
    <Shell>
      <PageHeader
        title="Projects"
        description="Canonical project folders from projects/ in your workspace."
        actions={
          <Toolbar>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={13} />
              Refresh
            </Button>
            <ToolbarLabel>
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </ToolbarLabel>
          </Toolbar>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-4">
          {projects.length > 0 ? (
            <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
              Projects are workspace folders under <InlineCode>projects/</InlineCode>. Each folder can contain{" "}
              <InlineCode>project.md</InlineCode> (name, summary, status) and <InlineCode>tasks.md</InlineCode> (task
              list). Create a project from Chat with a clear name so the folder and files reflect intent.
            </div>
          ) : null}

          {loading && projects.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
              <Loader2 size={14} className="animate-spin" />
              Scanning workspace...
            </div>
          ) : null}

          {error ? (
            <div className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          {projects.length === 0 && !loading ? (
            <EmptyState
              icon={<FolderKanban size={28} strokeWidth={1.2} />}
              title="No projects yet"
              description="Projects are folders under projects/ with optional project.md and tasks.md. Create one from Chat (e.g. “create a project called My App”) so the folder name reflects your intent."
              action={
                <Link href="/">
                  <Button size="sm" variant="outline">
                    <MessageSquare size={13} />
                    Open Session
                  </Button>
                </Link>
              }
            />
          ) : null}

          {projects.length > 0 ? (
            <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
              {projects.map((project) => (
                <Link
                  key={project.slug}
                  href={`/projects/${encodeURIComponent(project.slug)}`}
                  className="flex items-stretch px-4 py-3.5 text-left hover:bg-surface-2/50 transition-colors duration-150 no-underline min-w-0 block"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderKanban
                          size={14}
                          className="text-muted-foreground shrink-0"
                        />
                        <span className="text-[13px] font-semibold truncate text-foreground">
                          {project.name}
                        </span>
                      </div>
                      {project.status ? (
                        <Badge
                          variant={project.status === "active" ? "success" : "secondary"}
                          className="text-[10px] shrink-0"
                        >
                          {project.status}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5 ml-6 font-[family-name:var(--font-geist-mono)]">
                      {project.path}
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-6">
                      {project.hasProjectMd ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <FileText size={9} />
                          project.md
                        </Badge>
                      ) : null}
                      {project.hasTasksMd ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <ListChecks size={9} />
                          tasks.md
                        </Badge>
                      ) : null}
                      {!project.hasProjectMd && !project.hasTasksMd ? (
                        <span className="text-[11px] text-muted-foreground">
                          No canonical files
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {projects.length > 0 && !loading ? (
            <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground">
              Projects are scanned from the <InlineCode>projects/</InlineCode> directory
              in your workspace. Each project should contain a{" "}
              <InlineCode>project.md</InlineCode> (name, summary, status) and{" "}
              <InlineCode>tasks.md</InlineCode> (task lanes).
            </div>
          ) : null}
        </div>
      </PageContent>
    </Shell>
  );
}
