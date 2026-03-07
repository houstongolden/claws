/**
 * TUI data layer — fetches all data from the gateway API.
 * Reuses probe.mjs for gateway URL resolution.
 */

import { fetchGateway, resolveGatewayUrl } from "../probe.mjs";
import { loadConfig } from "../config.mjs";

let _gatewayUrl = null;

export async function initDataLayer() {
  const config = await loadConfig();
  _gatewayUrl = resolveGatewayUrl(config);
  return { config, gatewayUrl: _gatewayUrl };
}

function gw() { return _gatewayUrl || "http://localhost:4317"; }

async function get(path, timeout = 4000) {
  return fetchGateway(gw(), path, timeout);
}

async function post(path, body, timeout = 5000) {
  try {
    const res = await fetch(`${gw()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || "unreachable" };
  }
}

// ─── Health ───────────────────────────────────────────────────

export async function checkHealth() {
  return get("/health", 2000);
}

// ─── Status ───────────────────────────────────────────────────

export async function getStatus() {
  const res = await get("/api/status");
  return res.ok ? (res.data?.status ?? res.data) : null;
}

// ─── Sessions / Conversations ─────────────────────────────────

export async function getSessions(limit = 20) {
  const res = await get(`/api/conversations?type=session&limit=${limit}`);
  return res.ok ? (res.data?.conversations ?? []) : [];
}

export async function getSessionMessages(id, limit = 30) {
  const res = await get(`/api/conversations/${id}/messages?limit=${limit}`);
  return res.ok ? (res.data?.messages ?? []) : [];
}

export async function getSessionIntelligence(id) {
  const res = await get(`/api/conversations/${id}/intelligence`);
  return res.ok ? (res.data?.intelligence ?? null) : null;
}

// ─── Live State ───────────────────────────────────────────────

export async function getLiveState(chatId, threadId) {
  const params = new URLSearchParams();
  if (chatId) params.set("chatId", chatId);
  if (threadId) params.set("threadId", threadId);
  const qs = params.toString();
  const res = await get(`/api/live-state${qs ? "?" + qs : ""}`);
  return res.ok ? (res.data?.state ?? null) : null;
}

// ─── Approvals ────────────────────────────────────────────────

export async function getApprovals() {
  const res = await get("/api/approvals");
  return res.ok ? (res.data?.approvals ?? []) : [];
}

export async function resolveApproval(requestId, decision, grant) {
  return post(`/api/approvals/${requestId}/resolve`, { decision, grant });
}

// ─── Tasks ────────────────────────────────────────────────────

export async function getTaskEvents(limit = 50) {
  const res = await get(`/api/tasks/events?limit=${limit}`);
  return res.ok ? (res.data?.events ?? []) : [];
}

// ─── Traces ───────────────────────────────────────────────────

export async function getTraces(limit = 40) {
  const res = await get(`/api/traces?limit=${limit}`);
  return res.ok ? (res.data?.traces ?? []) : [];
}

// ─── Workflows ────────────────────────────────────────────────

export async function getWorkflows() {
  const res = await get("/api/workflows");
  return res.ok ? (res.data?.workflows ?? []) : [];
}

// ─── Proactive Jobs ───────────────────────────────────────────

export async function getProactiveJobs() {
  const res = await get("/api/proactive/jobs");
  return res.ok ? (res.data?.jobs ?? []) : [];
}

export async function getProactiveDecisions(limit = 10) {
  const res = await get(`/api/proactive/decisions?limit=${limit}`);
  return res.ok ? (res.data?.decisions ?? []) : [];
}

export async function getProactiveNotifications(limit = 10) {
  const res = await get(`/api/proactive/notifications?limit=${limit}`);
  return res.ok ? (res.data?.notifications ?? []) : [];
}

// ─── Projects ─────────────────────────────────────────────────

export async function getProjects() {
  const res = await get("/api/projects");
  return res.ok ? (res.data?.projects ?? []) : [];
}

// ─── Batch fetch for TUI refresh ──────────────────────────────

export async function fetchAll() {
  const [
    statusRes, sessions, approvals, tasks, traces,
    workflows, jobs, decisions, notifications,
  ] = await Promise.all([
    getStatus(),
    getSessions(25),
    getApprovals(),
    getTaskEvents(50),
    getTraces(40),
    getWorkflows(),
    getProactiveJobs(),
    getProactiveDecisions(10),
    getProactiveNotifications(10),
  ]);

  return {
    status: statusRes,
    sessions,
    approvals,
    tasks,
    traces,
    workflows,
    jobs,
    decisions,
    notifications,
    fetchedAt: Date.now(),
  };
}
