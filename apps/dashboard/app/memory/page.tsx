"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Brain, Search, Loader2, FileText, ArrowRight, Sparkles, ShieldCheck, FileEdit } from "lucide-react";
import {
  Shell,
  PageHeader,
  PageContent,
  PageSection,
  EmptyState,
} from "../../components/shell";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { InlineCode } from "../../components/ui/code-block";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { getTracesPage, runTool, getApprovals, createMemoryProposal, type TraceItem } from "../../lib/api";
import { CHAT_STORAGE_KEY } from "../../lib/session";

type MemoryResult = {
  path: string;
  score: number;
  excerpt: string;
  memoryId?: string;
  promoted?: boolean;
};

type SearchResponse = {
  query: string;
  results: MemoryResult[];
  sources: string[];
  note: string;
};

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("search");
  const [recentMemoryTraces, setRecentMemoryTraces] = useState<TraceItem[]>([]);
  const [pendingProposals, setPendingProposals] = useState<Array<{ id: string; args: Record<string, unknown>; reason?: string }>>([]);
  const [proposeBusy, setProposeBusy] = useState<string | null>(null);
  const [proposeSuccess, setProposeSuccess] = useState<string | null>(null);

  useEffect(() => {
    getTracesPage({ limit: 200, offset: 0 })
      .then((res) => {
        const traces = (res.traces ?? []) as TraceItem[];
        const memTraces = traces.filter(
          (t) =>
            t.type === "memory-flush" ||
            t.type === "memory-promote" ||
            t.type === "memory-search" ||
            t.type === "memory-proposal-created" ||
            t.type === "memory-promoted-to-durable" ||
            (t.summary ?? "").toLowerCase().includes("memory")
        );
        setRecentMemoryTraces(memTraces.slice(0, 20));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getApprovals()
      .then((res) => {
        const list = (res.approvals ?? []).filter((a) => a.toolName === "memory.promoteToDurable");
        setPendingProposals(list.map((a) => ({ id: a.id, args: a.args ?? {}, reason: a.reason })));
      })
      .catch(() => {});
  }, [tab]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setSearchResult(null);
    setError(null);
    setProposeSuccess(null);

    try {
      const res = await runTool("memory.search", { query: query.trim() });
      if (res.ok && res.result) {
        setSearchResult(res.result as SearchResponse);
      } else {
        setError(res.error ?? "Search failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function triggerFlush() {
    setLoading(true);
    setError(null);
    try {
      const sessionSummary = getSessionCheckpoint();
      const res = await runTool("memory.flush", {
        text: sessionSummary,
        source: "dashboard-session",
        tags: ["checkpoint"],
      });
      if (!res.ok) {
        setError(res.error ?? "Flush failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flush failed");
    } finally {
      setLoading(false);
    }
  }

  const results = searchResult?.results ?? [];

  function getSessionCheckpoint(): string {
    try {
      const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) {
        return "Session checkpoint requested from Memory screen.";
      }
      const history = JSON.parse(raw) as Array<{ role?: string; content?: string }>;
      const recentTurns = history
        .filter((entry) => typeof entry.content === "string" && entry.content.trim())
        .slice(-6)
        .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.content}`)
        .join("\n");
      return recentTurns || "Session checkpoint requested from Memory screen.";
    } catch {
      return "Session checkpoint requested from Memory screen.";
    }
  }

  async function promoteEntry(entryId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await runTool("memory.promote", { entryId });
      if (!res.ok) {
        setError(res.error ?? "Promote failed");
        return;
      }
      if (searchResult?.query) {
        const rerun = await runTool("memory.search", { query: searchResult.query });
        if (rerun.ok && rerun.result) {
          setSearchResult(rerun.result as SearchResponse);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setLoading(false);
    }
  }

  async function proposeToMEMORY(entryId: string) {
    setProposeBusy(entryId);
    setError(null);
    setProposeSuccess(null);
    try {
      const res = await createMemoryProposal({ entryId });
      if (!res.ok || !res.approvalId) {
        setError(res.error ?? "Proposal failed");
        return;
      }
      setProposeSuccess(res.approvalId);
      const list = await getApprovals();
      const proposals = (list.approvals ?? []).filter((a) => a.toolName === "memory.promoteToDurable");
      setPendingProposals(proposals.map((a) => ({ id: a.id, args: a.args ?? {}, reason: a.reason })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proposal failed");
    } finally {
      setProposeBusy(null);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Memory"
        description="Curated durable memory — search workspace files and promoted entries"
      />
      <PageContent>
        <PageSection>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="proposals">
                Proposals ({pendingProposals.length})
              </TabsTrigger>
              <TabsTrigger value="activity">
                Activity ({recentMemoryTraces.length})
              </TabsTrigger>
              <TabsTrigger value="about">How it works</TabsTrigger>
            </TabsList>

            <TabsContent value="search">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-md)] p-5">
                  <form onSubmit={search} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 min-w-0">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
                      />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search workspace files and memory store..."
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Search size={13} />
                      )}
                      Search
                    </Button>
                  </form>
                </div>

                {error ? (
                  <div className="text-[13px] text-destructive bg-destructive/[0.07] border border-destructive/15 rounded-2xl px-4 py-3 shadow-[var(--shadow-sm)]">
                    {error}
                  </div>
                ) : null}

                {proposeSuccess ? (
                  <div className="text-[13px] bg-success/[0.08] border border-success/25 text-foreground rounded-2xl px-4 py-3 flex items-center gap-2 flex-wrap shadow-[var(--shadow-sm)]">
                    <ShieldCheck size={14} />
                    Proposal created. Resolve in Approvals to append to <InlineCode>prompt/MEMORY.md</InlineCode>.
                    <Link href="/approvals">
                      <Button variant="outline" size="sm">Open Approvals</Button>
                    </Link>
                  </div>
                ) : null}

                {searchResult && results.length === 0 ? (
                  <EmptyState
                    icon={<Brain size={28} strokeWidth={1.2} />}
                    title="No results found"
                    description={searchResult.note}
                  />
                ) : null}

                {results.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[12px] text-muted-foreground">
                      {searchResult?.note}
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                      {results.map((entry, idx) => (
                        <div key={`${entry.path}-${idx}`} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText
                                size={12}
                                className="text-muted-foreground shrink-0"
                              />
                              <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-foreground truncate">
                                {entry.path}
                              </span>
                              {entry.promoted ? (
                                <Badge variant="default" className="text-[9px]">
                                  promoted
                                </Badge>
                              ) : null}
                              {entry.memoryId ? (
                                <Badge variant="outline" className="text-[9px]">
                                  store
                                </Badge>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)] shrink-0 ml-2">
                              {entry.score.toFixed(1)}
                            </span>
                          </div>
                          <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] leading-relaxed line-clamp-4">
                            {entry.excerpt}
                          </pre>
                          {entry.memoryId && !entry.promoted ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void promoteEntry(entry.memoryId!)}
                                disabled={loading}
                              >
                                <Sparkles size={12} />
                                Promote
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => void proposeToMEMORY(entry.memoryId!)}
                                disabled={loading || proposeBusy !== null}
                              >
                                {proposeBusy === entry.memoryId ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <FileEdit size={12} />
                                )}
                                Propose to MEMORY.md
                              </Button>
                            </div>
                          ) : entry.memoryId && entry.promoted ? (
                            <div className="mt-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => void proposeToMEMORY(entry.memoryId!)}
                                disabled={loading || proposeBusy !== null}
                              >
                                {proposeBusy === entry.memoryId ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <FileEdit size={12} />
                                )}
                                Propose to MEMORY.md
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {searchResult?.sources ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Sources searched: {searchResult.sources.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!searchResult ? (
                  <EmptyState
                    icon={<Brain size={28} strokeWidth={1.2} />}
                    title="Search workspace memory"
                    description="Find information across prompt/, notes/, projects/, identity/, and the memory store."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={triggerFlush}
                        disabled={loading}
                      >
                        <Brain size={13} />
                        Flush session checkpoint
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="proposals">
              <div className="space-y-4">
                <p className="text-[13px] text-muted-foreground">
                  Pending proposals to append to <InlineCode>prompt/MEMORY.md</InlineCode>. Approve or deny in Approvals to complete.
                </p>
                {pendingProposals.length === 0 ? (
                  <EmptyState
                    icon={<FileEdit size={28} strokeWidth={1.2} />}
                    title="No pending proposals"
                    description="Use “Propose to MEMORY.md” on a search result to create an approval-gated proposal. After you approve it, the content is appended to prompt/MEMORY.md."
                    action={
                      <Link href="/approvals">
                        <Button variant="outline" size="sm">Open Approvals</Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                    {pendingProposals.map((p) => (
                      <div key={p.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            memory.promoteToDurable
                          </Badge>
                          <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-muted-foreground">
                            {p.id}
                          </span>
                        </div>
                        {p.reason ? (
                          <p className="text-[12px] text-muted-foreground mb-1.5">{p.reason}</p>
                        ) : null}
                        {typeof p.args?.text === "string" ? (
                          <pre className="rounded-md border border-border bg-background p-2.5 text-[11px] text-muted-foreground whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] line-clamp-4">
                            {(p.args.text as string).slice(0, 400)}
                            {(p.args.text as string).length > 400 ? "…" : ""}
                          </pre>
                        ) : null}
                        <div className="mt-2">
                          <Link href="/approvals">
                            <Button variant="outline" size="sm">
                              <ShieldCheck size={12} />
                              Resolve in Approvals
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <div className="space-y-4">
                {recentMemoryTraces.length === 0 ? (
                  <EmptyState
                    icon={<Brain size={28} strokeWidth={1.2} />}
                    title="No memory activity yet"
                    description="Memory events appear here when flush, promote, or search operations run through the gateway."
                  />
                ) : (
                  <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] divide-y divide-border overflow-hidden">
                    {recentMemoryTraces.map((t) => (
                      <div key={t.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {t.type}
                            </Badge>
                            <span className="text-[13px] truncate">
                              {t.summary}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-geist-mono)] whitespace-nowrap ml-3">
                            {new Date(t.ts).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="about">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="text-[13px] font-medium">Memory Layers</div>
                  <div className="space-y-2 text-[13px] text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <ArrowRight size={12} className="mt-1 shrink-0" />
                      <div>
                        <InlineCode>prompt/USER.md</InlineCode> — curated user preferences and facts
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight size={12} className="mt-1 shrink-0" />
                      <div>
                        <InlineCode>prompt/MEMORY.md</InlineCode> — promoted durable memory from sessions
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight size={12} className="mt-1 shrink-0" />
                      <div>
                        <InlineCode>notes/daily/</InlineCode> — daily notes and observations
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight size={12} className="mt-1 shrink-0" />
                      <div>
                        <InlineCode>.claws/memory-store.json</InlineCode> — flushed memory entries (promoted entries score higher)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-surface-1 shadow-[var(--shadow-sm)] p-4 space-y-3">
                  <div className="text-[13px] font-medium">Operations</div>
                  <div className="space-y-2 text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-[family-name:var(--font-geist-mono)]">
                        memory.flush
                      </Badge>
                      Save session context to .claws/memory-store.json before compaction
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-[family-name:var(--font-geist-mono)]">
                        memory.promote
                      </Badge>
                      Mark a memory entry as promoted (higher search relevance in store)
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-[family-name:var(--font-geist-mono)]">
                        Propose to MEMORY.md
                      </Badge>
                      Create an approval-gated proposal. When you approve it in Approvals, the content is appended to{" "}
                      <InlineCode>prompt/MEMORY.md</InlineCode> with a traceable comment (entryId, source, timestamp). No direct write without approval.
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-[family-name:var(--font-geist-mono)]">
                        memory.search
                      </Badge>
                      Search across workspace files and memory store entries
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </PageSection>
      </PageContent>
    </Shell>
  );
}
