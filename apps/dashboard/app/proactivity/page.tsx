"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RefreshCw, Loader2, Zap, Bell, History } from "lucide-react";
import { Shell, PageHeader, PageContent, EmptyState } from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  getProactiveJobs,
  getProactiveNotifications,
  getProactiveRuns,
  pauseProactiveJob,
  resumeProactiveJob,
  runProactiveJobNow,
  markProactiveNotificationRead,
  type ProactiveJob,
  type ProactiveNotification,
  type ProactiveRun,
} from "../../lib/api";

export default function ProactivityPage() {
  const [jobs, setJobs] = useState<ProactiveJob[]>([]);
  const [notifications, setNotifications] = useState<ProactiveNotification[]>([]);
  const [runs, setRuns] = useState<ProactiveRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [tab, setTab] = useState("jobs");

  async function load() {
    try {
      const [jobsRes, notifRes, runsRes] = await Promise.all([
        getProactiveJobs(),
        getProactiveNotifications({ limit: 30 }),
        getProactiveRuns(undefined, 30),
      ]);
      setJobs(jobsRes.jobs ?? []);
      setNotifications(notifRes.notifications ?? []);
      setRuns(runsRes.runs ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  async function handlePause(id: string) {
    await pauseProactiveJob(id);
    await load();
  }
  async function handleResume(id: string) {
    await resumeProactiveJob(id);
    await load();
  }
  async function handleRunNow(id: string) {
    setRunningId(id);
    try {
      await runProactiveJobNow(id);
      await load();
    } finally {
      setRunningId(null);
    }
  }
  async function handleMarkRead(id: string) {
    await markProactiveNotificationRead(id);
    await load();
  }

  const activeJobs = jobs.filter((j) => j.status === "active");
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <Shell>
      <PageHeader
        title="Proactivity"
        description="Scheduled jobs, check-ins, and proactive notifications. The AI OS runs without constant babysitting."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />
      <PageContent>
        <div className="max-w-3xl space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
              <TabsTrigger value="notifications">
                Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
              </TabsTrigger>
              <TabsTrigger value="runs">Recent runs</TabsTrigger>
            </TabsList>

            <TabsContent value="jobs">
              <div className="rounded-lg border border-border bg-surface-1 p-4 text-[13px] text-muted-foreground mb-4">
                Built-in jobs (morning brief, EOD, approvals watchdog, stale project) run on schedule or on demand.
                Use <strong>Run now</strong> to trigger once; pause to stop recurring runs.
              </div>
              {loading && jobs.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                  <Loader2 size={14} className="animate-spin" />
                  Loading...
                </div>
              ) : null}
              {error ? (
                <div className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              ) : null}
              {!loading && jobs.length === 0 ? (
                <EmptyState
                  icon={<Zap size={28} strokeWidth={1.2} />}
                  title="No proactive jobs"
                  description="Jobs are seeded at gateway startup. Restart the gateway to create built-in jobs (Morning Brief, EOD, Approvals Watchdog, etc.)."
                />
              ) : null}
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-border bg-surface-1 flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{job.name}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {job.kind}
                        {job.scheduleCron ? ` · ${job.scheduleCron}` : null}
                        {job.intervalSec != null ? ` · every ${job.intervalSec}s` : null}
                        {job.lastRunAt ? ` · last run ${new Date(job.lastRunAt).toLocaleString()}` : " · never run"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={job.status === "active" ? "success" : "outline"} className="text-[10px]">
                        {job.status}
                      </Badge>
                      {job.status === "active" ? (
                        <Button variant="outline" size="sm" onClick={() => handlePause(job.id)}>
                          <Pause size={12} />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleResume(job.id)}>
                          <Play size={12} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleRunNow(job.id)}
                        disabled={runningId === job.id}
                      >
                        {runningId === job.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                        Run now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className="space-y-2">
                {notifications.length === 0 ? (
                  <EmptyState
                    icon={<Bell size={28} strokeWidth={1.2} />}
                    title="No notifications"
                    description="Proactive run results and check-ins will appear here."
                  />
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-lg border border-border bg-surface-1 px-4 py-3 ${!n.readAt ? "border-l-4 border-l-primary" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-medium">{n.title}</div>
                          <div className="text-[12px] text-muted-foreground mt-0.5">{n.body}</div>
                          <div className="text-[11px] text-muted-foreground/80 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                            {n.kind ? ` · ${n.kind}` : null}
                          </div>
                        </div>
                        {!n.readAt ? (
                          <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>
                            Mark read
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="runs">
              <div className="space-y-2">
                {runs.length === 0 ? (
                  <EmptyState
                    icon={<History size={28} strokeWidth={1.2} />}
                    title="No runs yet"
                    description="Run a job manually or wait for the next scheduled run."
                  />
                ) : (
                  runs.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-border bg-surface-1 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{r.summary ?? r.id}</div>
                          <div className="text-[12px] text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString()}
                            {r.finishedAt ? ` · ${((r.finishedAt - r.startedAt) / 1000).toFixed(1)}s` : null}
                          </div>
                        </div>
                        <Badge
                          variant={
                            r.status === "completed" ? "success" : r.status === "failed" ? "destructive" : "outline"
                          }
                          className="text-[10px]"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      {r.error ? (
                        <div className="text-[12px] text-destructive mt-1">{r.error}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </PageContent>
    </Shell>
  );
}
