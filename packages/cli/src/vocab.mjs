/**
 * Shared vocabulary, status terminology, and time formatting.
 * Used by both CLI commands and the TUI to ensure consistent language.
 */

// ─── Canonical status labels ─────────────────────────────────
// Every feature that displays a status should use these.

export const STATUS_LABELS = {
  active: "active",
  running: "running",
  completed: "completed",
  done: "done",
  approved: "approved",
  pending: "pending",
  waiting: "waiting",
  paused: "paused",
  failed: "failed",
  denied: "denied",
  error: "error",
  cancelled: "cancelled",
};

export function statusCategory(status) {
  if (!status) return "unknown";
  const s = String(status).toLowerCase();
  if (["active", "running", "approved", "completed", "done"].includes(s)) return "ok";
  if (["pending", "waiting", "paused"].includes(s)) return "warn";
  if (["failed", "denied", "error", "cancelled"].includes(s)) return "bad";
  return "neutral";
}

// ─── Time formatting ─────────────────────────────────────────
// One implementation, shared everywhere.

export function timeSince(isoDate) {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function timeSinceCompact(isoDate) {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Canonical section/pane names ────────────────────────────
// TUI panes, CLI sections, and dashboard tabs should use these.

export const SECTION_NAMES = {
  sessions: "Sessions",
  liveState: "Live State",
  approvals: "Approvals",
  tasks: "Tasks",
  traces: "Traces",
  workflows: "Workflows",
  proactive: "Proactive Jobs",
  config: "Config",
  filesystem: "Filesystem",
  runtime: "Runtime",
  services: "Services",
  environment: "Environment",
  execution: "Execution",
  integrations: "Integrations",
  activity: "Activity",
};

// ─── Approval terminology ────────────────────────────────────

export const APPROVAL_GRANT_LABELS = {
  once: "once",
  session: "for session",
  always: "always",
};

// ─── Service state labels ────────────────────────────────────

export function serviceLabel(isRunning, name, port) {
  if (isRunning) return { status: "ok", text: `${name} running (:${port})` };
  return { status: "bad", text: `${name} not running (:${port})` };
}

// ─── Approval count formatting ───────────────────────────────

export function approvalCountLabel(count) {
  if (count === 0) return "no pending approvals";
  return `${count} pending approval${count === 1 ? "" : "s"}`;
}
