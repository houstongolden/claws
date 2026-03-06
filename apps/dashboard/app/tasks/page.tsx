"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ListChecks,
  Search,
  LayoutList,
  Activity,
  FileText,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  EmptyState,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { Toolbar, ToolbarLabel } from "../../components/ui/toolbar";
import { Textarea } from "../../components/ui/textarea";
import {
  getTaskEventsPage,
  runTool,
  appendTaskEvent,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  moveTask as apiMoveTask,
  completeTask as apiCompleteTask,
  type TaskEvent,
} from "../../lib/api";

type BuildTask = {
  section: string;
  id: string;
  status: string;
  priority: string;
  owner: string;
  task: string;
  dependencies: string;
  files: string;
  acceptance: string;
};

function eventLabel(ev: TaskEvent): string {
  const type = ev.type ?? ev.event;
  return String(type ?? "unknown");
}

function eventNote(ev: TaskEvent): string | null {
  const note = ev.note ?? ev.summary;
  if (note != null && typeof note === "string") return note;
  const t = ev.task;
  if (t && typeof t === "object" && typeof (t as Record<string, unknown>).task === "string") {
    return (t as Record<string, unknown>).task as string;
  }
  return null;
}

function eventProject(ev: TaskEvent): string | null {
  const p = ev.project;
  if (!p || typeof p !== "object") return null;
  const proj = p as Record<string, unknown>;
  return typeof proj.name === "string" ? proj.name : null;
}

function eventCategory(ev: TaskEvent): string {
  const type = String(ev.event ?? "");
  if (type.startsWith("workspace.project")) return "project";
  if (type.startsWith("task.")) return "task";
  if (type.startsWith("milestone")) return "milestone";
  return "system";
}

function parseBuildQueue(markdown: string): BuildTask[] {
  const lines = markdown.split(/\r?\n/);
  const rows: BuildTask[] = [];
  let currentSection = "Build queue";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      currentSection = line.replace(/^##\s+/, "").trim();
      continue;
    }
    if (!line.startsWith("|")) continue;
    if (line.includes("| ID | Status | Priority | Owner | Task |")) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;

    const parts = line
      .split("|")
      .slice(1, -1)
      .map((part) => part.trim());

    if (parts.length < 8) continue;

    rows.push({
      section: currentSection,
      id: parts[0],
      status: parts[1],
      priority: parts[2],
      owner: parts[3],
      task: parts[4],
      dependencies: parts[5],
      files: parts[6],
      acceptance: parts[7],
    });
  }

  return rows;
}

export default function TasksPage() {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [buildQueue, setBuildQueue] = useState<BuildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(120);
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<"queue" | "activity">("queue");
  const [eventTab, setEventTab] = useState("all");
  const [query, setQuery] = useState("");
  const [appendBusy, setAppendBusy] = useState(false);
  const [appendEventType, setAppendEventType] = useState("task.created");
  const [appendProject, setAppendProject] = useState("");
  const [appendNote, setAppendNote] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createTaskDesc, setCreateTaskDesc] = useState("");
  const [createSection, setCreateSection] = useState("Build queue");
  const [createPriority, setCreatePriority] = useState("P2");
  const [createOwner, setCreateOwner] = useState("human");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editAcceptance, setEditAcceptance] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [eventsRes, queueRes] = await Promise.all([
        getTaskEventsPage({ limit, offset }),
        runTool("fs.read", { path: "project-context/tasks.md" }),
      ]);
      setEvents(eventsRes.events ?? []);
      if (queueRes.ok && queueRes.result && typeof queueRes.result === "object") {
        const content = String((queueRes.result as Record<string, unknown>).content ?? "");
        setBuildQueue(parseBuildQueue(content));
      } else {
        setBuildQueue([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [limit, offset]);

  async function handleAppendEvent(e: React.FormEvent) {
    e.preventDefault();
    if (appendBusy) return;
    setAppendBusy(true);
    setError(null);
    try {
      await appendTaskEvent({
        event: appendEventType,
        project: appendProject.trim() ? { name: appendProject.trim() } : undefined,
        note: appendNote.trim() || undefined,
        ts: new Date().toISOString(),
        owner: "dashboard",
      });
      setAppendNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Append failed");
    } finally {
      setAppendBusy(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (createBusy || !createTaskDesc.trim()) return;
    setCreateBusy(true);
    setError(null);
    try {
      const res = await apiCreateTask({
        task: createTaskDesc.trim(),
        section: createSection || "Build queue",
        priority: createPriority || "P2",
        owner: createOwner || "human",
      });
      if (!res.ok) throw new Error("Create failed");
      setCreateTaskDesc("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create task failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleComplete(taskId: string) {
    if (actionBusyId) return;
    setActionBusyId(taskId);
    setError(null);
    try {
      const res = await apiCompleteTask({ taskId });
      if (!res.ok) throw new Error("Complete failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleMoveStatus(taskId: string, status: string) {
    if (actionBusyId) return;
    setActionBusyId(taskId);
    setError(null);
    try {
      const res = await apiMoveTask({ taskId, status });
      if (!res.ok) throw new Error("Move failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setActionBusyId(null);
    }
  }

  function startEdit(task: BuildTask) {
    setEditingId(task.id);
    setEditTaskDesc(task.task);
    setEditAcceptance(task.acceptance || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTaskDesc("");
    setEditAcceptance("");
  }

  async function saveEdit(taskId: string) {
    if (actionBusyId) return;
    setActionBusyId(taskId);
    setError(null);
    try {
      const patch: Record<string, string> = {};
      if (editTaskDesc !== undefined) patch.task = editTaskDesc;
      if (editAcceptance !== undefined) patch.acceptance = editAcceptance;
      const res = await apiUpdateTask({ taskId, patch });
      if (!res.ok) throw new Error("Update failed");
      setEditingId(null);
      setEditTaskDesc("");
      setEditAcceptance("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionBusyId(null);
    }
  }

  const q = query.toLowerCase();
  const filteredQueue = buildQueue.filter((task) => {
    if (!q) return true;
    const searchable = `${task.id} ${task.status} ${task.priority} ${task.owner} ${task.task} ${task.section}`.toLowerCase();
    return searchable.includes(q);
  });

  const filteredEvents = events.filter((ev) => {
    const cat = eventCategory(ev);
    if (eventTab !== "all" && cat !== eventTab) return false;
    if (q) {
      const searchable = `${eventLabel(ev)} ${eventNote(ev) ?? ""} ${eventProject(ev) ?? ""} ${String(ev.owner ?? "")}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

  const categories = Array.from(new Set(events.map(eventCategory)));
  const counts: Record<string, number> = { all: events.length };
  for (const cat of categories) {
    counts[cat] = events.filter((ev) => eventCategory(ev) === cat).length;
  }
  const queueStatusCounts = filteredQueue.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const groupedQueue = filteredQueue.reduce<Record<string, BuildTask[]>>((acc, task) => {
    const key = task.status;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
  const queueGroups = ["todo", "in-progress", "blocked", "done"].filter((status) => groupedQueue[status]?.length);
  const otherQueueGroups = Object.keys(groupedQueue).filter((status) => !queueGroups.includes(status));

  return (
    <Shell>
      <PageHeader
        title="Tasks"
        description="Canonical build queue plus append-only task activity."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-4">
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
              Append task event
            </div>
            <p className="text-[13px] text-muted-foreground mb-3">
              Add an event to the append-only log (project-context/tasks.jsonl). Does not edit the canonical queue; use Session or Files to change tasks.md.
            </p>
            <form onSubmit={handleAppendEvent} className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <Select
                value={appendEventType}
                onChange={(e) => setAppendEventType(e.target.value)}
                className="w-full sm:w-auto min-w-[140px]"
                aria-label="Event type"
              >
                <option value="task.created">task.created</option>
                <option value="task.updated">task.updated</option>
                <option value="task.completed">task.completed</option>
                <option value="task.blocked">task.blocked</option>
                <option value="workspace.project.created">workspace.project.created</option>
                <option value="milestone.reached">milestone.reached</option>
              </Select>
              <Input
                value={appendProject}
                onChange={(e) => setAppendProject(e.target.value)}
                placeholder="Project (optional)"
                className="flex-1 min-w-[120px]"
              />
              <Input
                value={appendNote}
                onChange={(e) => setAppendNote(e.target.value)}
                placeholder="Note / summary"
                className="flex-1 min-w-[180px]"
              />
              <Button type="submit" size="sm" disabled={appendBusy}>
                {appendBusy ? <Loader2 size={13} className="animate-spin" /> : "Append"}
              </Button>
            </form>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
              Create task (updates project-context/tasks.md)
            </div>
            <p className="text-[13px] text-muted-foreground mb-3">
              Add a task to the canonical queue. It will appear in the first matching section and in the event log.
            </p>
            <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <Input
                  value={createTaskDesc}
                  onChange={(e) => setCreateTaskDesc(e.target.value)}
                  placeholder="Task description"
                  className="flex-1 min-w-[200px]"
                />
                <Input
                  value={createSection}
                  onChange={(e) => setCreateSection(e.target.value)}
                  placeholder="Section"
                  className="w-full sm:w-36"
                />
                <Select
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value)}
                  className="w-full sm:w-24"
                  aria-label="Priority"
                >
                  <option value="P0">P0</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                </Select>
                <Select
                  value={createOwner}
                  onChange={(e) => setCreateOwner(e.target.value)}
                  className="w-full sm:w-28"
                  aria-label="Owner"
                >
                  <option value="human">human</option>
                  <option value="agent">agent</option>
                </Select>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createBusy || !createTaskDesc.trim()}
                  title={!createTaskDesc.trim() ? "Enter a task description to create" : undefined}
                  aria-label={!createTaskDesc.trim() ? "Create task (enter a task description first)" : "Create task"}
                >
                  {createBusy ? <Loader2 size={13} className="animate-spin" /> : "Create"}
                </Button>
              </div>
            </form>
          </div>

          <Tabs value={mode} onValueChange={(value) => setMode(value as "queue" | "activity")}>
            <TabsList>
              <TabsTrigger value="queue">
                <LayoutList size={13} />
                Build queue
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity size={13} />
                Activity
              </TabsTrigger>
            </TabsList>

            <div className="mt-3">
              <Toolbar>
                <div className="relative flex-1 min-w-[180px]">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={mode === "queue" ? "Filter build queue..." : "Filter task events..."}
                    className="pl-8"
                  />
                </div>
                {mode === "activity" ? (
                  <>
                    <Select
                      value={String(limit)}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="w-auto"
                    >
                      <option value="50">50</option>
                      <option value="120">120</option>
                      <option value="250">250</option>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setOffset((c) => Math.max(0, c - limit))}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={13} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setOffset((c) => c + limit)}
                        disabled={events.length < limit}
                        aria-label="Next page"
                      >
                        <ChevronRight size={13} />
                      </Button>
                    </div>
                  </>
                ) : null}
                <ToolbarLabel>
                  {mode === "queue"
                    ? `${filteredQueue.length} task${filteredQueue.length === 1 ? "" : "s"}`
                    : `${filteredEvents.length} of ${events.length} · offset ${offset}`}
                </ToolbarLabel>
              </Toolbar>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-[13px] mt-4">
                <Loader2 size={14} className="animate-spin" />
                Loading...
              </div>
            ) : null}

            {error ? (
              <div className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mt-4">
                {error}
              </div>
            ) : null}

            <TabsContent value="queue">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Link
                  href="/files"
                  className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 no-underline"
                >
                  <FileText size={12} />
                  View canonical queue (project-context/tasks.md) in Files
                </Link>
              </div>
              {filteredQueue.length === 0 && !loading ? (
                <EmptyState
                  icon={<ListChecks size={28} strokeWidth={1.2} />}
                  title="No build queue tasks"
                  description="The canonical task plan is read from project-context/tasks.md."
                />
              ) : null}

              {filteredQueue.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {["todo", "in-progress", "blocked", "done"].map((status) => (
                      <div key={status} className="rounded-lg border border-border bg-surface-1 p-3">
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {status}
                        </div>
                        <div className="mt-1 text-[18px] font-semibold text-foreground">
                          {queueStatusCounts[status] ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>

                  {[...queueGroups, ...otherQueueGroups].map((status) => (
                    <div key={status} className="rounded-lg border border-border bg-surface-1 overflow-hidden">
                      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
                        <div className="text-[12px] font-medium uppercase tracking-widest text-muted-foreground">
                          {status}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {groupedQueue[status].length}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border">
                        {groupedQueue[status].map((task) => (
                          <div key={task.id} className="px-4 py-3">
                            {editingId === task.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editTaskDesc}
                                  onChange={(e) => setEditTaskDesc(e.target.value)}
                                  placeholder="Task description"
                                  rows={2}
                                  className="text-[13px]"
                                />
                                <Textarea
                                  value={editAcceptance}
                                  onChange={(e) => setEditAcceptance(e.target.value)}
                                  placeholder="Acceptance criteria"
                                  rows={2}
                                  className="text-[13px]"
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => saveEdit(task.id)}
                                    disabled={actionBusyId === task.id}
                                  >
                                    {actionBusyId === task.id ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-[10px] font-[family-name:var(--font-geist-mono)]">
                                    {task.id}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {task.priority}
                                  </Badge>
                                  <span className="text-[13px] font-medium text-foreground flex-1 min-w-0">
                                    {task.task}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Select
                                      value={task.status}
                                      onChange={(e) => handleMoveStatus(task.id, e.target.value)}
                                      disabled={actionBusyId !== null}
                                      className="w-[110px] h-7 text-[11px]"
                                    >
                                      <option value="todo">todo</option>
                                      <option value="in-progress">in-progress</option>
                                      <option value="blocked">blocked</option>
                                      <option value="done">done</option>
                                    </Select>
                                    {task.status !== "done" ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2"
                                        onClick={() => handleComplete(task.id)}
                                        disabled={actionBusyId !== null}
                                        title="Mark done"
                                      >
                                        {actionBusyId === task.id ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <CheckCircle2 size={12} />
                                        )}
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      onClick={() => startEdit(task)}
                                      title="Edit"
                                    >
                                      <Pencil size={12} />
                                    </Button>
                                  </div>
                                </div>
                                <div className="mt-1 text-[12px] text-muted-foreground">
                                  {task.section} · owner {task.owner}
                                </div>
                                {task.dependencies && task.dependencies !== "-" ? (
                                  <div className="mt-1 text-[12px] text-muted-foreground">
                                    Depends on: {task.dependencies}
                                  </div>
                                ) : null}
                                {task.acceptance && task.acceptance !== "-" ? (
                                  <div className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                                    {task.acceptance}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="activity">
              <Tabs value={eventTab} onValueChange={setEventTab}>
                <TabsList>
                  <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                  {categories.map((cat) => (
                    <TabsTrigger key={cat} value={cat}>
                      {cat} ({counts[cat] ?? 0})
                    </TabsTrigger>
                  ))}
                </TabsList>

                {!loading && filteredEvents.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={<ListChecks size={28} strokeWidth={1.2} />}
                      title={eventTab === "all" ? "No task events" : `No ${eventTab} events`}
                      description="Task activity is appended to project-context/tasks.jsonl by runtime actions."
                    />
                  </div>
                ) : null}

                <TabsContent value={eventTab}>
                  {filteredEvents.length > 0 ? (
                    <div className="rounded-lg border border-border bg-surface-1 divide-y divide-border overflow-hidden">
                      {filteredEvents.map((ev, i) => {
                        const label = eventLabel(ev);
                        const note = eventNote(ev);
                        const project = eventProject(ev);
                        const cat = eventCategory(ev);

                        return (
                          <div key={`${String(ev.ts)}-${i}`} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge
                                variant={cat === "milestone" ? "default" : "secondary"}
                                className="text-[10px] font-[family-name:var(--font-geist-mono)] shrink-0"
                              >
                                {label}
                              </Badge>
                              {project ? (
                                <span className="text-[12px] text-foreground font-medium truncate">
                                  {project}
                                </span>
                              ) : null}
                            </div>
                            {note ? (
                              <div className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">
                                {note}
                              </div>
                            ) : null}
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                              {ev.owner ? <span>{String(ev.owner)}</span> : null}
                              {ev.ts ? (
                                <span className="font-[family-name:var(--font-geist-mono)]">
                                  {String(ev.ts).slice(0, 19)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      </PageContent>
    </Shell>
  );
}
