/**
 * TUI application controller.
 * Manages layout, input, state, and render loop.
 */

import {
  initScreen, destroyScreen,
  rows, cols, w, flush,
  drawBox, fillArea, renderStatusBar, renderHeaderBar,
  writeLine, writeAt,
  style, pad, truncate, stripAnsi,
  RESET, BOLD, DIM, INVERSE,
  FG_CYAN, FG_GREEN, FG_YELLOW, FG_RED, FG_GRAY, FG_WHITE, FG_MAGENTA,
  BG_BLACK,
} from "./screen.mjs";
import { clearScreen, clearLine, moveTo } from "./ansi.mjs";
import { initDataLayer, fetchAll, checkHealth, resolveApproval, getSessionMessages } from "./data.mjs";
import {
  renderSessions, renderLiveState, renderApprovals,
  renderTasks, renderTraces, renderWorkflows, renderHelp,
} from "./panes.mjs";
import { rand, BOOT, DONE } from "../messages.mjs";
import { timeSinceCompact, approvalCountLabel, SECTION_NAMES } from "../vocab.mjs";

const PANES = ["sessions", "livestate", "approvals", "tasks", "traces", "workflows"];
const PANE_TITLES = {
  sessions: SECTION_NAMES.sessions,
  livestate: SECTION_NAMES.liveState,
  approvals: SECTION_NAMES.approvals,
  tasks: SECTION_NAMES.tasks,
  traces: SECTION_NAMES.traces,
  workflows: SECTION_NAMES.workflows,
};

const PANE_KEYS = { s: "sessions", l: "livestate", a: "approvals", t: "tasks", c: "traces", w: "workflows" };

export async function runTui() {
  const { config, gatewayUrl } = await initDataLayer();

  const health = await checkHealth();
  if (!health.ok) {
    console.error(`\n  Gateway not running at ${gatewayUrl}`);
    console.error(`  Start it with: claws gateway\n`);
    process.exitCode = 1;
    return;
  }

  // State
  const state = {
    focusedPane: "sessions",
    showHelp: false,
    sessionIdx: 0,
    approvalIdx: 0,
    taskIdx: 0,
    traceIdx: 0,
    workflowIdx: 0,
    detailView: null,
    detailData: null,
    lastRefresh: 0,
    refreshing: false,
  };

  let data = null;

  // Screen setup
  initScreen();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let alive = true;

  function cleanup() {
    if (!alive) return;
    alive = false;
    destroyScreen();
    process.stdin.setRawMode(false);
    process.exit(0);
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Initial data load
  await refreshData();

  // Input handler
  process.stdin.on("data", async (key) => {
    if (!alive) return;

    if (key === "\x03") { cleanup(); return; }

    if (key === "?") {
      state.showHelp = !state.showHelp;
      render();
      return;
    }

    if (state.showHelp && key !== "?") {
      state.showHelp = false;
      render();
      return;
    }

    // Detail view: Escape / Backspace / q / Left to close
    if (state.detailView) {
      if (key === "\x1b" || key === "\x7f" || key === "q" || key === "\x1b[D") {
        state.detailView = null;
        state.detailData = null;
        render();
        return;
      }
      return;
    }

    if (key === "q") { cleanup(); return; }
    if (key === "r") { await refreshData(); render(); return; }

    // Pane navigation
    if (key === "\t") { cycleFocus(1); render(); return; }
    if (key === "\x1b[Z") { cycleFocus(-1); render(); return; }

    if (PANE_KEYS[key]) { state.focusedPane = PANE_KEYS[key]; render(); return; }

    // Arrow keys / j / k
    if (key === "\x1b[A" || key === "k") { moveSelection(-1); render(); return; }
    if (key === "\x1b[B" || key === "j") { moveSelection(1); render(); return; }

    // Enter — inspect
    if (key === "\r" || key === "\n") {
      await handleEnter();
      render();
      return;
    }

    // Approval actions (only in approvals pane)
    if (state.focusedPane === "approvals" && data?.approvals?.length > 0) {
      const approval = data.approvals[state.approvalIdx];
      if (!approval) return;
      const reqId = approval.requestId || approval.request_id || approval.id;
      if (!reqId) return;

      if (key === "y") {
        await resolveApproval(reqId, "approved", "once");
        await refreshData(); render(); return;
      }
      if (key === "n") {
        await resolveApproval(reqId, "denied");
        await refreshData(); render(); return;
      }
      if (key === "Y") {
        await resolveApproval(reqId, "approved", "session");
        await refreshData(); render(); return;
      }
      if (key === "A") {
        await resolveApproval(reqId, "approved", "always");
        await refreshData(); render(); return;
      }
    }
  });

  // Auto-refresh timer
  const refreshInterval = setInterval(async () => {
    if (!alive) return;
    if (Date.now() - state.lastRefresh > 8000) {
      await refreshData();
      render();
    }
  }, 10000);

  // Resize handler
  process.stdout.on("resize", () => { if (alive) render(); });

  // First render
  render();

  // ─── Internal functions ─────────────────────────────────────

  async function refreshData() {
    state.refreshing = true;
    try {
      data = await fetchAll();
      state.lastRefresh = Date.now();
    } catch {
      // keep stale data
    }
    state.refreshing = false;
  }

  function cycleFocus(dir) {
    const idx = PANES.indexOf(state.focusedPane);
    const next = (idx + dir + PANES.length) % PANES.length;
    state.focusedPane = PANES[next];
  }

  function moveSelection(dir) {
    const pane = state.focusedPane;
    if (pane === "sessions") {
      const max = (data?.sessions?.length || 1) - 1;
      state.sessionIdx = Math.max(0, Math.min(max, state.sessionIdx + dir));
    } else if (pane === "approvals") {
      const max = (data?.approvals?.length || 1) - 1;
      state.approvalIdx = Math.max(0, Math.min(max, state.approvalIdx + dir));
    } else if (pane === "tasks") {
      const max = (data?.tasks?.length || 1) - 1;
      state.taskIdx = Math.max(0, Math.min(max, state.taskIdx + dir));
    } else if (pane === "traces") {
      const max = (data?.traces?.length || 1) - 1;
      state.traceIdx = Math.max(0, Math.min(max, state.traceIdx + dir));
    } else if (pane === "workflows") {
      const max = Math.max(0, (data?.workflows?.length || 0) + (data?.jobs?.length || 0) - 1);
      state.workflowIdx = Math.max(0, Math.min(max, state.workflowIdx + dir));
    }
  }

  async function handleEnter() {
    if (state.focusedPane === "sessions" && data?.sessions?.length > 0) {
      const session = data.sessions[state.sessionIdx];
      if (session) {
        const messages = await getSessionMessages(session.id, 20);
        state.detailView = "session";
        state.detailData = { session, messages };
      }
    } else if (state.focusedPane === "traces" && data?.traces?.length > 0) {
      const trace = data.traces[state.traceIdx];
      if (trace) {
        state.detailView = "trace";
        state.detailData = { trace };
      }
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  function render() {
    if (!alive) return;
    const R = rows();
    const C = cols();

    w(clearScreen());

    // Header
    const pending = data?.approvals?.length || 0;
    const pendingBadge = pending > 0 ? style(` ${approvalCountLabel(pending)} `, FG_YELLOW, BOLD) : "";
    const refreshIndicator = state.refreshing ? style(" ◐ ", FG_CYAN) : "";
    renderHeaderBar(`🦞 Claws  ${pendingBadge}${refreshIndicator}`);

    // Status bar (bottom)
    const tabHint = PANES.map((p) =>
      p === state.focusedPane ? style(PANE_TITLES[p], BOLD, FG_CYAN) : style(PANE_TITLES[p], DIM)
    ).join(style(" │ ", DIM));
    const helpHint = style("  ? help  q quit  r refresh", DIM);
    renderStatusBar(R, `${tabHint}${helpHint}`);

    const contentTop = 2;
    const contentH = R - 2;

    if (state.detailView) {
      renderDetail(contentTop, 1, C, contentH);
      flush();
      return;
    }

    if (state.showHelp) {
      const helpW = Math.min(52, C - 4);
      const helpH = Math.min(28, contentH - 2);
      const helpC = Math.floor((C - helpW) / 2);
      const helpR = contentTop + Math.floor((contentH - helpH) / 2);
      fillArea(helpR, helpC, helpW, helpH);
      drawBox(helpR, helpC, helpW, helpH, "Help", true);
      renderHelp({ r: helpR + 1, c: helpC + 1, w: helpW - 2, h: helpH - 2 });
      flush();
      return;
    }

    if (C >= 100) {
      renderTwoColumn(contentTop, C, contentH);
    } else {
      renderSingleColumn(contentTop, C, contentH);
    }

    flush();
  }

  function renderTwoColumn(top, width, height) {
    const leftW = Math.floor(width * 0.38);
    const rightW = width - leftW;

    const sessH = Math.floor(height * 0.55);
    const liveH = height - sessH;

    drawBox(top, 1, leftW, sessH, PANE_TITLES.sessions, state.focusedPane === "sessions");
    renderSessions(data || {}, { r: top + 1, c: 2, w: leftW - 2, h: sessH - 2 }, state);

    drawBox(top + sessH, 1, leftW, liveH, PANE_TITLES.livestate, state.focusedPane === "livestate");
    renderLiveState(data || {}, { r: top + sessH + 1, c: 2, w: leftW - 2, h: liveH - 2 }, state);

    const paneH = Math.floor(height / 4);
    const lastPaneH = height - paneH * 3;

    drawBox(top, leftW + 1, rightW, paneH, PANE_TITLES.approvals, state.focusedPane === "approvals");
    renderApprovals(data || {}, { r: top + 1, c: leftW + 2, w: rightW - 2, h: paneH - 2 }, state);

    drawBox(top + paneH, leftW + 1, rightW, paneH, PANE_TITLES.tasks, state.focusedPane === "tasks");
    renderTasks(data || {}, { r: top + paneH + 1, c: leftW + 2, w: rightW - 2, h: paneH - 2 }, state);

    drawBox(top + paneH * 2, leftW + 1, rightW, paneH, PANE_TITLES.traces, state.focusedPane === "traces");
    renderTraces(data || {}, { r: top + paneH * 2 + 1, c: leftW + 2, w: rightW - 2, h: paneH - 2 }, state);

    drawBox(top + paneH * 3, leftW + 1, rightW, lastPaneH, PANE_TITLES.workflows, state.focusedPane === "workflows");
    renderWorkflows(data || {}, { r: top + paneH * 3 + 1, c: leftW + 2, w: rightW - 2, h: lastPaneH - 2 }, state);
  }

  function renderSingleColumn(top, width, height) {
    const paneH = height;
    const pane = state.focusedPane;
    const title = PANE_TITLES[pane];

    drawBox(top, 1, width, paneH, title, true);
    const box = { r: top + 1, c: 2, w: width - 2, h: paneH - 2 };

    switch (pane) {
      case "sessions": renderSessions(data || {}, box, state); break;
      case "livestate": renderLiveState(data || {}, box, state); break;
      case "approvals": renderApprovals(data || {}, box, state); break;
      case "tasks": renderTasks(data || {}, box, state); break;
      case "traces": renderTraces(data || {}, box, state); break;
      case "workflows": renderWorkflows(data || {}, box, state); break;
    }
  }

  function renderDetail(top, left, width, height) {
    if (state.detailView === "session") {
      renderSessionDetail(top, left, width, height);
    } else if (state.detailView === "trace") {
      renderTraceDetail(top, left, width, height);
    }
  }

  function renderSessionDetail(top, left, width, height) {
    const { session, messages } = state.detailData || {};
    const title = session?.title || session?.id?.slice(0, 16) || "Session";
    drawBox(top, left, width, height, `Session: ${title}`, true);

    const box = { r: top + 1, c: left + 1, w: width - 2, h: height - 2 };
    let row = box.r;

    writeAt(row++, box.c, style(`ID: ${session?.id || "?"}`, DIM));
    if (session?.created_at) {
      writeAt(row++, box.c, style(`Created: ${new Date(session.created_at).toLocaleString()}`, DIM));
    }
    row++;

    writeAt(row++, box.c, style("Messages", BOLD));
    writeAt(row++, box.c, style("─".repeat(Math.min(40, box.w)), DIM));

    if (!messages || messages.length === 0) {
      writeAt(row++, box.c, style("No messages loaded", FG_GRAY));
    } else {
      for (const msg of messages) {
        if (row >= box.r + box.h - 2) break;
        const role = msg.role || "?";
        const roleColor = role === "user" ? FG_GREEN : role === "assistant" ? FG_CYAN : FG_GRAY;
        const text = msg.content || msg.message || "";
        const prefix = style(role.padEnd(10), roleColor, BOLD);
        writeAt(row++, box.c, `${prefix} ${truncate(text, box.w - 12)}`);
      }
    }

    writeAt(top + height - 2, left + 1, style("← Esc/q to go back", DIM));
  }

  function renderTraceDetail(top, left, width, height) {
    const { trace } = state.detailData || {};
    const kind = trace?.kind || trace?.type || "trace";
    drawBox(top, left, width, height, `Trace: ${kind}`, true);

    const box = { r: top + 1, c: left + 1, w: width - 2, h: height - 2 };
    let row = box.r;

    const fields = [
      ["Kind", trace?.kind || trace?.type],
      ["ID", trace?.id],
      ["Session", trace?.session_id || trace?.chat_id],
      ["Created", trace?.created_at ? new Date(trace.created_at).toLocaleString() : null],
      ["Summary", trace?.summary || trace?.description],
      ["Content", trace?.content],
    ];

    for (const [label, value] of fields) {
      if (row >= box.r + box.h - 2) break;
      if (!value) continue;
      const labelStr = style(label.padEnd(12), DIM);
      writeAt(row++, box.c, `${labelStr} ${truncate(String(value), box.w - 14)}`);
    }

    if (trace?.data) {
      row++;
      if (row < box.r + box.h - 3) {
        writeAt(row++, box.c, style("Data", BOLD));
        const json = JSON.stringify(trace.data, null, 2);
        const lines = json.split("\n");
        for (const l of lines) {
          if (row >= box.r + box.h - 2) break;
          writeAt(row++, box.c, style(truncate(l, box.w - 2), DIM));
        }
      }
    }

    writeAt(top + height - 2, left + 1, style("← Esc/q to go back", DIM));
  }
}
