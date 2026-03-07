/**
 * TUI pane renderers.
 * Each pane function receives (data, box, state) and writes into the box area.
 * box = { r, c, w, h } — the content area (inside border).
 */

import {
  writeAt, w,
  style, truncate, pad, stripAnsi,
  RESET, BOLD, DIM, INVERSE,
  FG_CYAN, FG_GREEN, FG_YELLOW, FG_RED, FG_GRAY, FG_WHITE, FG_MAGENTA,
} from "./screen.mjs";
import { timeSinceCompact, statusCategory, approvalCountLabel, APPROVAL_GRANT_LABELS } from "../vocab.mjs";

// ─── Helpers ──────────────────────────────────────────────────

function line(row, col, text, maxW) {
  writeAt(row, col, truncate(text, maxW));
}

function statusIcon(status) {
  const cat = statusCategory(status);
  if (cat === "ok") return style("●", FG_GREEN);
  if (cat === "warn") return style("◐", FG_YELLOW);
  if (cat === "bad") return style("✗", FG_RED);
  return style("○", FG_GRAY);
}

function badge(text, color) {
  return style(text, color, BOLD);
}

// ═══════════════════════════════════════════════════════════════
// Sessions pane
// ═══════════════════════════════════════════════════════════════

export function renderSessions(data, box, state) {
  const sessions = data.sessions || [];
  const selected = state.sessionIdx ?? 0;

  if (sessions.length === 0) {
    line(box.r + 1, box.c + 1, style("No sessions", FG_GRAY), box.w - 2);
    line(box.r + 2, box.c + 1, style("Start one via chat or dashboard", DIM), box.w - 2);
    return;
  }

  const maxVisible = box.h - 2;
  const scrollOffset = Math.max(0, selected - maxVisible + 2);

  for (let i = 0; i < maxVisible && i + scrollOffset < sessions.length; i++) {
    const idx = i + scrollOffset;
    const s = sessions[idx];
    const isSelected = idx === selected;
    const row = box.r + i + 1;
    const maxW = box.w - 2;

    const title = s.title || s.id?.slice(0, 12) || "untitled";
    const age = timeSinceCompact(s.updated_at || s.created_at);
    const msgCount = s.message_count ?? "";

    let prefix = isSelected ? style("▸ ", FG_CYAN, BOLD) : "  ";
    let label = isSelected ? style(title, BOLD) : title;
    let meta = style(`${msgCount ? msgCount + "msg " : ""}${age}`, DIM);

    const labelMaxW = maxW - stripAnsi(prefix).length - stripAnsi(meta).length - 2;
    label = truncate(label, Math.max(8, labelMaxW));

    const gap = Math.max(1, maxW - stripAnsi(prefix).length - stripAnsi(label).length - stripAnsi(meta).length);
    line(row, box.c + 1, prefix + label + " ".repeat(gap) + meta, maxW + 10);
  }

  if (sessions.length > maxVisible) {
    const indicator = style(`↕ ${sessions.length} total`, DIM);
    line(box.r + box.h - 1, box.c + 1, indicator, box.w - 2);
  }
}

// ═══════════════════════════════════════════════════════════════
// Live State pane
// ═══════════════════════════════════════════════════════════════

export function renderLiveState(data, box, state) {
  const st = data.status;
  let row = box.r + 1;
  const maxW = box.w - 2;

  if (!st) {
    line(row, box.c + 1, style("Gateway not running", FG_YELLOW), maxW);
    line(row + 1, box.c + 1, style("Start with: claws gateway", DIM), maxW);
    return;
  }

  // AI status
  if (st.ai) {
    const model = st.ai.model || "?";
    const provider = st.ai.provider || "?";
    line(row++, box.c + 1, `${style("AI", FG_CYAN)} ${provider} → ${style(model, BOLD)}`, maxW + 20);
  }

  // Approvals (using shared vocabulary)
  if (st.approvals?.pending > 0) {
    line(row++, box.c + 1, `${style("!", FG_YELLOW, BOLD)} ${approvalCountLabel(st.approvals.pending)}`, maxW + 20);
  }
  if (st.workflows) {
    line(row++, box.c + 1, `${style("⟳", FG_CYAN)} ${st.workflows.count ?? 0} workflows`, maxW + 10);
  }
  if (st.traces) {
    line(row++, box.c + 1, `${style("◇", FG_GRAY)} ${st.traces.count ?? 0} traces`, maxW + 10);
  }

  // Agents
  if (st.agents?.length > 0) {
    row++;
    line(row++, box.c + 1, style("Agents", DIM), maxW);
    for (const a of st.agents.slice(0, box.h - (row - box.r) - 1)) {
      line(row++, box.c + 1, `  ${style(a.id, FG_CYAN)} ${style(a.description || "", DIM)}`, maxW + 20);
    }
  }

  // Execution
  if (st.execution?.browser) {
    if (row < box.r + box.h - 1) {
      row++;
      line(row++, box.c + 1, `${style("Browser", DIM)} ${st.execution.browser.provider || "playwright"}`, maxW + 10);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Approvals pane
// ═══════════════════════════════════════════════════════════════

export function renderApprovals(data, box, state) {
  const approvals = data.approvals || [];
  const selected = state.approvalIdx ?? 0;

  if (approvals.length === 0) {
    line(box.r + 1, box.c + 1, style("No pending approvals", FG_GRAY), box.w - 2);
    return;
  }

  const maxVisible = box.h - 3;
  const scrollOffset = Math.max(0, selected - maxVisible + 1);

  for (let i = 0; i < maxVisible && i + scrollOffset < approvals.length; i++) {
    const idx = i + scrollOffset;
    const a = approvals[idx];
    const isSelected = idx === selected;
    const row = box.r + i + 1;
    const maxW = box.w - 2;

    const icon = statusIcon(a.status || "pending");
    const prefix = isSelected ? style("▸", FG_CYAN, BOLD) : " ";
    const tool = a.toolName || a.tool_name || a.action || "unknown";
    const age = timeSinceCompact(a.created_at || a.requestedAt);
    const status = a.status || "pending";

    let entry = `${prefix} ${icon} ${isSelected ? style(tool, BOLD) : tool}`;
    const meta = style(`${status} ${age}`, DIM);
    const gap = Math.max(1, maxW - stripAnsi(entry).length - stripAnsi(meta).length);
    line(row, box.c + 1, entry + " ".repeat(gap) + meta, maxW + 30);
  }

  // Action hints — using shared grant terminology
  const hintRow = box.r + box.h - 2;
  if (approvals.length > 0) {
    line(hintRow, box.c + 1,
      style("y", FG_GREEN, BOLD) + style(` ${APPROVAL_GRANT_LABELS.once}  `, DIM) +
      style("n", FG_RED, BOLD) + style(" deny  ", DIM) +
      style("Y", FG_GREEN, BOLD) + style(` ${APPROVAL_GRANT_LABELS.session}  `, DIM) +
      style("A", FG_CYAN, BOLD) + style(` ${APPROVAL_GRANT_LABELS.always}`, DIM),
      box.w - 2 + 60);
  }
}

// ═══════════════════════════════════════════════════════════════
// Tasks pane
// ═══════════════════════════════════════════════════════════════

export function renderTasks(data, box, state) {
  const events = data.tasks || [];
  const selected = state.taskIdx ?? 0;

  if (events.length === 0) {
    line(box.r + 1, box.c + 1, style("No tasks", FG_GRAY), box.w - 2);
    return;
  }

  const taskMap = new Map();
  for (const e of events) {
    const id = e.task_id || e.taskId || e.id;
    if (!id) continue;
    const existing = taskMap.get(id);
    if (!existing || (e.created_at || "") > (existing.created_at || "")) {
      taskMap.set(id, e);
    }
  }
  const tasks = [...taskMap.values()].slice(0, 50);

  const maxVisible = box.h - 2;
  const scrollOffset = Math.max(0, selected - maxVisible + 1);

  for (let i = 0; i < maxVisible && i + scrollOffset < tasks.length; i++) {
    const idx = i + scrollOffset;
    const t = tasks[idx];
    const isSelected = idx === selected;
    const row = box.r + i + 1;
    const maxW = box.w - 2;

    const status = t.status || t.event_type || "?";
    const icon = statusIcon(status);
    const prefix = isSelected ? style("▸", FG_CYAN, BOLD) : " ";
    const title = t.task || t.title || t.task_id || "untitled";
    const age = timeSinceCompact(t.created_at);

    let entry = `${prefix} ${icon} ${isSelected ? style(title, BOLD) : truncate(title, maxW - 16)}`;
    const meta = style(age, DIM);
    const gap = Math.max(1, maxW - stripAnsi(entry).length - stripAnsi(meta).length);
    line(row, box.c + 1, entry + " ".repeat(gap) + meta, maxW + 30);
  }
}

// ═══════════════════════════════════════════════════════════════
// Traces pane
// ═══════════════════════════════════════════════════════════════

export function renderTraces(data, box, state) {
  const traces = data.traces || [];
  const selected = state.traceIdx ?? 0;

  if (traces.length === 0) {
    line(box.r + 1, box.c + 1, style("No traces", FG_GRAY), box.w - 2);
    return;
  }

  const maxVisible = box.h - 2;
  const scrollOffset = Math.max(0, selected - maxVisible + 1);

  for (let i = 0; i < maxVisible && i + scrollOffset < traces.length; i++) {
    const idx = i + scrollOffset;
    const t = traces[idx];
    const isSelected = idx === selected;
    const row = box.r + i + 1;
    const maxW = box.w - 2;

    const kind = t.kind || t.type || t.event_type || "trace";
    const age = timeSinceCompact(t.created_at || t.timestamp);
    const summary = t.summary || t.content || t.description || "";
    const kindColor = kind.includes("error") ? FG_RED
      : kind.includes("approval") ? FG_YELLOW
      : kind.includes("tool") ? FG_MAGENTA
      : kind.includes("chat") ? FG_GREEN
      : FG_GRAY;

    const prefix = isSelected ? style("▸", FG_CYAN, BOLD) : " ";
    const kindLabel = style(kind.slice(0, 18).padEnd(18), kindColor);

    let entry = `${prefix} ${kindLabel} ${truncate(summary, maxW - 24)}`;
    const meta = style(age, DIM);
    const gap = Math.max(1, maxW - stripAnsi(entry).length - stripAnsi(meta).length);
    line(row, box.c + 1, entry + " ".repeat(gap) + meta, maxW + 40);
  }
}

// ═══════════════════════════════════════════════════════════════
// Workflows pane
// ═══════════════════════════════════════════════════════════════

export function renderWorkflows(data, box, state) {
  const workflows = data.workflows || [];
  const jobs = data.jobs || [];
  const selected = state.workflowIdx ?? 0;
  const maxW = box.w - 2;
  let row = box.r + 1;

  if (workflows.length > 0) {
    line(row++, box.c + 1, style("Workflows", BOLD), maxW);
    const maxWf = Math.min(workflows.length, Math.floor((box.h - 3) / 2));
    for (let i = 0; i < maxWf; i++) {
      const wf = workflows[i];
      const icon = statusIcon(wf.status);
      const name = wf.definition?.name || wf.id?.slice(0, 12) || "unnamed";
      const steps = wf.steps ? `${wf.steps.length} steps` : "";
      const age = timeSinceCompact(wf.updated_at || wf.created_at);
      line(row++, box.c + 1,
        `  ${icon} ${truncate(name, maxW - 20)} ${style(steps, DIM)} ${style(age, DIM)}`,
        maxW + 30);
    }
    row++;
  }

  if (jobs.length > 0 && row < box.r + box.h - 2) {
    line(row++, box.c + 1, style("Proactive Jobs", BOLD), maxW);
    const remaining = box.r + box.h - row - 1;
    const maxJobs = Math.min(jobs.length, remaining);
    for (let i = 0; i < maxJobs; i++) {
      const j = jobs[i];
      const icon = statusIcon(j.status);
      const name = j.name || j.kind || "job";
      const schedule = j.schedule_cron || (j.interval_sec ? `${j.interval_sec}s` : "");
      line(row++, box.c + 1,
        `  ${icon} ${truncate(name, maxW - 18)} ${style(schedule, DIM)}`,
        maxW + 20);
    }
  }

  if (data.decisions?.length > 0 && row < box.r + box.h - 2) {
    row++;
    line(row++, box.c + 1, style("Recent Decisions", BOLD), maxW);
    const remaining = box.r + box.h - row - 1;
    for (let i = 0; i < Math.min(data.decisions.length, remaining); i++) {
      const d = data.decisions[i];
      const outcomeColor = d.outcome === "ignore" ? FG_GRAY
        : d.outcome === "notify" ? FG_YELLOW
        : d.outcome === "act_silently" ? FG_GREEN
        : FG_CYAN;
      line(row++, box.c + 1,
        `  ${style(d.outcome || "?", outcomeColor)} ${style(timeSinceCompact(d.decided_at), DIM)}`,
        maxW + 20);
    }
  }

  if (workflows.length === 0 && jobs.length === 0) {
    line(box.r + 1, box.c + 1, style("No active workflows or jobs", FG_GRAY), maxW);
  }
}

// ═══════════════════════════════════════════════════════════════
// Help overlay
// ═══════════════════════════════════════════════════════════════

export function renderHelp(box) {
  const shortcuts = [
    ["Tab / Shift+Tab", "Cycle panes"],
    ["↑ / k", "Move up in list"],
    ["↓ / j", "Move down in list"],
    ["Enter", "Inspect / expand"],
    ["", ""],
    ["s", "Sessions"],
    ["l", "Live State"],
    ["a", "Approvals"],
    ["t", "Tasks"],
    ["c", "Traces"],
    ["w", "Workflows"],
    ["", ""],
    ["y", "Approve once"],
    ["n", "Deny"],
    ["Y", "Approve for session"],
    ["A", "Approve always"],
    ["", ""],
    ["r", "Refresh data"],
    ["q / Ctrl+C", "Quit"],
    ["?", "Toggle this help"],
  ];

  const maxW = box.w - 4;
  line(box.r + 1, box.c + 2, style("Keyboard Shortcuts", BOLD, FG_CYAN), maxW);
  line(box.r + 2, box.c + 2, style("─".repeat(Math.min(30, maxW)), DIM), maxW);

  let displayRow = 3;
  for (let i = 0; i < shortcuts.length && displayRow < box.h - 1; i++) {
    const [key, desc] = shortcuts[i];
    if (key === "" && desc === "") {
      displayRow++;
      continue;
    }
    const keyStr = style(key.padEnd(18), FG_CYAN);
    line(box.r + displayRow, box.c + 2, `${keyStr} ${desc}`, maxW + 20);
    displayRow++;
  }

  // Footer
  if (displayRow < box.h - 1) {
    displayRow++;
    line(box.r + displayRow, box.c + 2, style("Diagnostics: claws doctor   Quick: claws status", DIM), maxW);
  }
}
