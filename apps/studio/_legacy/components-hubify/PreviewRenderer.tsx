"use client";

import { useState } from "react";
import type { StudioTemplate, PanelConfig } from "@/lib/studio/template-config";
import { getThemeById, type ThemeColors } from "@/lib/studio/themes";

type DeviceSize = "phone" | "tablet" | "desktop";

const DEVICE_WIDTHS: Record<DeviceSize, number> = {
  phone: 375,
  tablet: 768,
  desktop: 1200,
};

// Panel size to 12-col grid span
const SIZE_TO_SPAN: Record<string, number> = {
  sm: 4,
  md: 6,
  lg: 8,
  full: 12,
};

// Nav group definitions — Core is always shown; Observe / Automate only when
// at least one of their panels is visible in the template.
const NAV_GROUPS = [
  {
    label: "Core",
    always: true,
    items: [
      { id: "home", label: "Home" },
      { id: "chat", label: "Chat" },
      { id: "terminal", label: "Terminal" },
      { id: "files", label: "Files" },
    ],
  },
  {
    label: "Observe",
    always: false,
    items: [
      { id: "activity-feed", label: "Activity" },
      { id: "analytics", label: "Analytics" },
      { id: "memory", label: "Memory" },
    ],
  },
  {
    label: "Automate",
    always: false,
    items: [
      { id: "skills-panel", label: "Skills" },
      { id: "cron-panel", label: "Crons" },
    ],
  },
];

interface PreviewRendererProps {
  template: StudioTemplate;
  deviceSize?: DeviceSize;
}

export function PreviewRenderer({ template, deviceSize = "desktop" }: PreviewRendererProps) {
  const width = DEVICE_WIDTHS[deviceSize];
  const showSidebar = deviceSize !== "phone";
  const visiblePanels = template.panels
    .filter((p) => p.visible)
    .sort((a, b) => a.position - b.position);
  const visibleSidebar = template.sidebarPanels
    .filter((p) => p.visible)
    .sort((a, b) => a.position - b.position);

  const visiblePanelIds = new Set(visiblePanels.map((p) => p.id));

  // Resolve theme — use template accent as override for the theme's accent
  const theme = getThemeById(template.themeId || "dark");
  const tc: ThemeColors = { ...theme.colors, accent: template.accent };

  // Interactive state — track active nav item ("home" = overview grid)
  const [activeNavId, setActiveNavId] = useState<string>("home");

  return (
    <div className="mx-auto transition-all duration-300" style={{ maxWidth: width }}>
      <div
        className="rounded-xl overflow-hidden shadow-2xl text-[13px]"
        style={{
          background: tc.bg,
          border: `1px solid $tc.border`,
        }}
      >
        {/* ── Main area ── */}
        <div
          className="flex"
          style={{ minHeight: deviceSize === "phone" ? 400 : 380 }}
        >
          {/* ── Nav Rail Sidebar ── */}
          {showSidebar && (
            <div
              className="flex flex-col shrink-0"
              style={{
                width: 160,
                background: tc.sidebar,
                borderRight: `1px solid $tc.border`,
              }}
            >
              {/* Top fixed: Monogram + Agent Status */}
              <div
                style={{
                  padding: "10px 10px 8px",
                  borderBottom: `1px solid $tc.border`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center rounded-md font-bold"
                    style={{
                      width: 24,
                      height: 24,
                      fontSize: 10,
                      background: template.accent,
                      color: "#0A0908",
                    }}
                  >
                    {template.monogram}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate font-medium"
                      style={{ fontSize: 10, color: tc.text }}
                    >
                      {template.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5" style={{ paddingLeft: 2 }}>
                  <div
                    className="rounded-full"
                    style={{ width: 5, height: 5, background: "#22c55e" }}
                  />
                  <span style={{ fontSize: 9, color: tc.textMuted }}>
                    {template.agentName} online
                  </span>
                </div>
              </div>

              {/* Middle scrollable: Grouped nav */}
              <div className="flex-1 overflow-y-auto" style={{ padding: "8px 6px" }}>
                {NAV_GROUPS.map((group) => {
                  // Check if any item in this group has a visible panel
                  const groupHasVisiblePanel = group.items.some((item) =>
                    visiblePanelIds.has(item.id)
                  );
                  if (!group.always && !groupHasVisiblePanel) return null;

                  return (
                    <div key={group.label} style={{ marginBottom: 10 }}>
                      <div
                        className="uppercase tracking-wider font-medium"
                        style={{
                          fontSize: 7,
                          color: tc.textMuted,
                          padding: "0 6px",
                          marginBottom: 3,
                        }}
                      >
                        {group.label}
                      </div>
                      <div className="space-y-px">
                        {group.items.map((item) => {
                          // For non-always groups, only show items with visible panels
                          if (!group.always && !visiblePanelIds.has(item.id)) return null;
                          const isActive = item.id === activeNavId;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded-r-sm cursor-pointer transition-all duration-150"
                              onClick={() => setActiveNavId(item.id)}
                              style={{
                                padding: "3px 8px",
                                fontSize: 10,
                                color: isActive
                                  ? template.accent
                                  : tc.textMuted,
                                background: isActive
                                  ? `${template.accent}12`
                                  : "transparent",
                                borderLeft: isActive
                                  ? `2px solid ${template.accent}`
                                  : "2px solid transparent",
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) e.currentTarget.style.background = `${template.accent}08`;
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <div
                                className="rounded-full"
                                style={{
                                  width: 4,
                                  height: 4,
                                  background: isActive
                                    ? template.accent
                                    : tc.textMuted,
                                }}
                              />
                              {item.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Sidebar panels (QuickActions, AgentStatus, etc.) */}
                {visibleSidebar.map((panel) => (
                  <SidebarPanel key={panel.id} panel={panel} accent={template.accent} />
                ))}
              </div>

              {/* Bottom fixed: User + Theme */}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  padding: "8px 10px",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="rounded-full flex items-center justify-center font-bold"
                      style={{
                        width: 18,
                        height: 18,
                        fontSize: 8,
                        background: `${template.accent}30`,
                        color: template.accent,
                      }}
                    >
                      U
                    </div>
                    <span
                      className="truncate"
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.5)",
                        maxWidth: 60,
                      }}
                    >
                      user
                    </span>
                  </div>
                  <div
                    className="flex gap-px rounded"
                    style={{ background: tc.border, padding: 1 }}
                  >
                    <div
                      className="rounded"
                      style={{
                        padding: "1px 4px",
                        fontSize: 7,
                        color: "rgba(255,255,255,0.7)",
                        background: "rgba(255,255,255,0.1)",
                      }}
                    >
                      D
                    </div>
                    <div
                      style={{
                        padding: "1px 4px",
                        fontSize: 7,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      L
                    </div>
                    <div
                      style={{
                        padding: "1px 4px",
                        fontSize: 7,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      S
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Main Content Area — switches between overview grid and single panel ── */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ padding: 6 }}>
            {visiblePanels.length === 0 ? (
              <div
                className="flex items-center justify-center h-full"
                style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}
              >
                No panels enabled
              </div>
            ) : activeNavId === "home" ? (
              /* ── Home/Overview: show all panels in grid ── */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gap: 6,
                }}
              >
                {visiblePanels.map((panel) => (
                  <div
                    key={panel.id}
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setActiveNavId(panel.id)}
                    style={{
                      gridColumn: `span ${SIZE_TO_SPAN[panel.size] || 6}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.outline = `1px solid ${template.accent}30`; e.currentTarget.style.borderRadius = "8px"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.outline = "none"; }}
                  >
                    <MainPanel
                      panel={panel}
                      accent={template.accent}
                      template={template}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* ── Single panel view: show selected panel full-width ── */
              (() => {
                const activePanel = visiblePanels.find((p) => p.id === activeNavId);
                return (
                  <div className="flex flex-col h-full">
                    {/* Breadcrumb / back to overview */}
                    <div
                      className="flex items-center gap-2 mb-1.5 cursor-pointer"
                      onClick={() => setActiveNavId("home")}
                      style={{ fontSize: 9, color: tc.textMuted, padding: "2px 0" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = template.accent; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; }}
                    >
                      <span>&#8592;</span>
                      <span>Overview</span>
                      <span style={{ color: tc.border }}>/</span>
                      <span style={{ color: tc.text, fontWeight: 500 }}>{activePanel?.label || activeNavId}</span>
                    </div>
                    {/* Panel rendered full-width */}
                    <div className="flex-1">
                      {activePanel ? (
                        <MainPanel
                          panel={{ ...activePanel, size: "full" }}
                          accent={template.accent}
                          template={template}
                          expanded
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center h-full rounded-lg"
                          style={{ background: "#111", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div style={{ textAlign: "center", color: tc.textMuted, fontSize: 10 }}>
                            <div style={{ fontSize: 16, marginBottom: 6 }}>
                              {activeNavId}
                            </div>
                            <div>This page will populate when the panel is enabled.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* ── Bottom Status Bar ── */}
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: "5px 12px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          <div
            className="rounded-full"
            style={{ width: 5, height: 5, background: "#22c55e" }}
          />
          <span>Connected</span>
          <span style={{ color: tc.textMuted }}>·</span>
          <span>{template.skills.length} skills</span>
          <span style={{ color: tc.textMuted }}>·</span>
          <span>{template.crons.length} crons</span>
          <span style={{ color: tc.textMuted }}>·</span>
          <span style={{ color: template.accent }}>{template.category}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ──

function MainPanel({
  panel,
  accent,
  template,
  expanded,
}: {
  panel: PanelConfig;
  accent: string;
  template: StudioTemplate;
  expanded?: boolean;
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${expanded ? "h-full flex flex-col" : ""}`}
      style={{
        background: "#111",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: expanded ? "8px 12px" : "5px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          className="font-medium uppercase tracking-wider"
          style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}
        >
          {panel.label}
        </span>
      </div>
      <div className={expanded ? "flex-1 overflow-y-auto" : ""} style={{ padding: expanded ? 10 : 6 }}>
        {panel.type === "chat" && (
          <ChatMock
            accent={accent}
            greeting={template.greeting}
            agentName={template.agentName}
          />
        )}
        {panel.type === "terminal" && <TerminalMock accent={accent} />}
        {panel.type === "activity" && <ActivityMock accent={accent} />}
        {panel.type === "files" && <FilesMock />}
        {panel.type === "memory" && <MemoryMock />}
        {panel.type === "skills" && (
          <SkillsMock skills={template.skills} accent={accent} />
        )}
        {panel.type === "crons" && <CronsMock crons={template.crons} />}
        {panel.type === "analytics" && <AnalyticsMock accent={accent} />}
      </div>
    </div>
  );
}

// ── Sidebar Panel ──

function SidebarPanel({
  panel,
  accent,
}: {
  panel: PanelConfig;
  accent: string;
}) {
  return (
    <div
      className="rounded-md"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.04)",
        padding: "6px 8px",
        marginBottom: 6,
      }}
    >
      <div
        className="uppercase tracking-wider font-medium"
        style={{
          fontSize: 8,
          color: "rgba(255,255,255,0.35)",
          marginBottom: 4,
        }}
      >
        {panel.label}
      </div>
      {panel.type === "actions" && (
        <div className="space-y-1">
          {["New chat", "Open terminal", "View files"].map((a) => (
            <div
              key={a}
              className="rounded cursor-pointer transition-colors"
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.45)",
                padding: "2px 6px",
                background: `${accent}08`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${accent}08`; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              {a}
            </div>
          ))}
        </div>
      )}
      {panel.type === "status" && (
        <div className="flex items-center gap-1">
          <div
            className="rounded-full"
            style={{ width: 5, height: 5, background: "#22c55e" }}
          />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>
            Online · 2m uptime
          </span>
        </div>
      )}
      {panel.type === "usage" && (
        <div className="space-y-1.5">
          {[
            { label: "CPU", pct: 12 },
            { label: "MEM", pct: 34 },
          ].map((u) => (
            <div key={u.label}>
              <div className="flex justify-between" style={{ fontSize: 9 }}>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>
                  {u.label}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>
                  {u.pct}%
                </span>
              </div>
              <div
                className="rounded-full"
                style={{
                  height: 3,
                  background: "rgba(255,255,255,0.05)",
                  marginTop: 2,
                }}
              >
                <div
                  className="rounded-full"
                  style={{
                    height: "100%",
                    width: `${u.pct}%`,
                    background: accent,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {panel.type === "sync" && (
        <div className="flex items-center gap-1">
          <div
            className="rounded-full"
            style={{ width: 4, height: 4, background: "#22c55e" }}
          />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
            Synced · 2s ago
          </span>
        </div>
      )}
    </div>
  );
}

// ── Panel Content Mocks ──

function ChatMock({
  accent,
  greeting,
  agentName,
}: {
  accent: string;
  greeting: string;
  agentName: string;
}) {
  const [chatMessages, setChatMessages] = useState<{role: string; text: string}[]>([
    { role: "agent", text: greeting || `Hi! I'm ${agentName}. How can I help you today?` },
    { role: "user", text: "Show me today's summary" },
    { role: "agent", text: "Here's your daily digest. 3 tasks completed, 2 pending review." },
  ]);
  const [chatInput, setChatInput] = useState("");

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: chatInput },
      { role: "agent", text: `Got it! I'll look into "${chatInput}" for you. This is a preview — in a live workspace, ${agentName} would respond here.` },
    ]);
    setChatInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
        {chatMessages.map((msg, i) => msg.role === "agent" ? (
          <div key={i} className="flex gap-1.5">
            <div
              className="rounded-full flex items-center justify-center shrink-0 font-bold"
              style={{ width: 16, height: 16, fontSize: 7, background: accent, color: "#0A0908" }}
            >
              {agentName.charAt(0)}
            </div>
            <div
              className="rounded-md rounded-tl-none"
              style={{ padding: "4px 8px", fontSize: 9, color: "rgba(255,255,255,0.7)", background: "#1A1A1A", maxWidth: "85%" }}
            >
              {msg.text}
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-end">
            <div
              className="rounded-md rounded-tr-none"
              style={{ padding: "4px 8px", fontSize: 9, color: "rgba(255,255,255,0.8)", background: `${accent}20`, maxWidth: "75%" }}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input bar — actually works */}
      <div
        className="flex items-center gap-1.5 rounded-md"
        style={{ padding: "4px 6px", background: "rgba(255,255,255,0.04)", marginTop: 6, border: `1px solid ${chatInput ? accent + "40" : "transparent"}` }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Type a message..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 9, color: "rgba(255,255,255,0.7)", fontFamily: "inherit" }}
        />
        <div
          className="flex items-center justify-center rounded cursor-pointer"
          onClick={handleSend}
          style={{ width: 14, height: 14, background: chatInput ? accent : `${accent}30` }}
        >
          <span style={{ fontSize: 8, color: chatInput ? "#0A0908" : accent }}>&#8593;</span>
        </div>
      </div>
    </div>
  );
}

function TerminalMock({ accent }: { accent: string }) {
  const [lines, setLines] = useState<{type: "cmd" | "out"; text: string}[]>([
    { type: "cmd", text: "openclaw status" },
    { type: "out", text: "Agent online. 3 skills loaded." },
    { type: "cmd", text: "openclaw run daily-digest" },
    { type: "out", text: "Executing skill: daily-digest... done (1.2s)" },
    { type: "cmd", text: "openclaw memory list" },
    { type: "out", text: "3 entries: project-notes.md, goals.md, week-12.md" },
  ]);
  const [termInput, setTermInput] = useState("");

  const responses: Record<string, string> = {
    "help": "Available: status, run <skill>, memory list, skills, crons, clear",
    "status": "Agent online. 3 skills loaded. Uptime: 2h 15m",
    "skills": "Installed: daily-digest, web-research, quick-capture",
    "crons": "heartbeat (*/30 * * * *) — enabled\nmorning-brief (0 9 * * *) — disabled",
    "clear": "",
    "ls": "SOUL.md  USER.md  HEARTBEAT.md  MEMORY.md  skills/  memory/  learnings/",
    "whoami": "workspace-agent (openclaw v3)",
  };

  const handleCmd = () => {
    if (!termInput.trim()) return;
    const cmd = termInput.trim();
    if (cmd === "clear") { setLines([]); setTermInput(""); return; }
    const out = responses[cmd] || responses[cmd.split(" ")[0]] || `command not found: ${cmd} (preview mode)`;
    setLines((prev) => [...prev, { type: "cmd", text: cmd }, { type: "out", text: out }]);
    setTermInput("");
  };

  return (
    <div style={{ fontFamily: "monospace", fontSize: 9 }} className="flex flex-col h-full">
      <div className="flex-1 space-y-1 overflow-y-auto" style={{ maxHeight: 300 }}>
        {lines.map((line, i) => line.type === "cmd" ? (
          <div key={i}>
            <span style={{ color: accent }}>$</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.5)" }}>{line.text}</span>
          </div>
        ) : (
          <div key={i} style={{ color: "rgba(74,222,128,0.7)", whiteSpace: "pre-wrap" }}>{line.text}</div>
        ))}
      </div>
      <div className="flex items-center gap-1" style={{ marginTop: 4 }}>
        <span style={{ color: accent }}>$</span>
        <input
          value={termInput}
          onChange={(e) => setTermInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCmd(); }}
          placeholder="_"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}
        />
      </div>
    </div>
  );
}

function ActivityMock({ accent }: { accent: string }) {
  const items = [
    { text: "Skill executed: daily-digest", time: "1m" },
    { text: "Memory updated: project-notes", time: "5m" },
    { text: "Agent connected", time: "12m" },
    { text: "Cron completed: morning-brief", time: "1h" },
    { text: "Skill installed: web-search", time: "3h" },
  ];

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5"
          style={{ fontSize: 9 }}
        >
          <div
            className="rounded-full shrink-0"
            style={{
              width: 4,
              height: 4,
              background: accent,
              opacity: 1 - i * 0.18,
            }}
          />
          <span
            className="truncate flex-1"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {item.text}
          </span>
          <span
            className="shrink-0"
            style={{ color: "rgba(255,255,255,0.2)", fontSize: 8 }}
          >
            {item.time}
          </span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsMock({ accent }: { accent: string }) {
  const bars = [30, 50, 25, 70, 45, 60, 80, 35, 55, 65];

  return (
    <div>
      {/* Mini bar chart */}
      <div className="flex items-end gap-1" style={{ height: 36 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${h}%`,
              background: accent,
              opacity: 0.25 + i * 0.06,
            }}
          />
        ))}
      </div>
      {/* Stats */}
      <div
        className="space-y-1"
        style={{
          marginTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: 5,
        }}
      >
        <div className="flex justify-between" style={{ fontSize: 9 }}>
          <span style={{ color: "rgba(255,255,255,0.35)" }}>Total tokens</span>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>12.4K</span>
        </div>
        <div className="flex justify-between" style={{ fontSize: 9 }}>
          <span style={{ color: "rgba(255,255,255,0.35)" }}>Avg latency</span>
          <span style={{ color: "rgba(255,255,255,0.6)" }}>230ms</span>
        </div>
      </div>
    </div>
  );
}

function MemoryMock() {
  const files = [
    { name: "memory/", indent: 0, isFolder: true },
    { name: "project-notes.md", indent: 1, isFolder: false },
    { name: "goals.md", indent: 1, isFolder: false },
    { name: "learnings/", indent: 0, isFolder: true },
    { name: "week-12.md", indent: 1, isFolder: false },
  ];

  return (
    <div className="space-y-0.5">
      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-1"
          style={{
            fontSize: 9,
            color: f.isFolder
              ? "rgba(255,255,255,0.55)"
              : "rgba(255,255,255,0.35)",
            paddingLeft: f.indent * 10,
          }}
        >
          <span style={{ fontSize: 7 }}>{f.isFolder ? "+" : " "}</span>
          <span>{f.name}</span>
        </div>
      ))}
    </div>
  );
}

function FilesMock() {
  const files = [
    "SOUL.md",
    "HUB.yaml",
    "memory/",
    "skills/",
    "learnings/",
  ];

  return (
    <div className="space-y-0.5">
      {files.map((f) => (
        <div
          key={f}
          style={{
            fontSize: 9,
            color: f.endsWith("/")
              ? "rgba(255,255,255,0.5)"
              : "rgba(255,255,255,0.35)",
            padding: "1px 4px",
          }}
        >
          {f}
        </div>
      ))}
    </div>
  );
}

function SkillsMock({
  skills,
  accent,
}: {
  skills: string[];
  accent: string;
}) {
  const displaySkills =
    skills.length > 0
      ? skills.slice(0, 6)
      : ["general-assist", "web-search", "file-ops", "summarize"];

  return (
    <div className="flex flex-wrap gap-1">
      {displaySkills.map((s) => (
        <span
          key={s}
          className="rounded"
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.55)",
            background: `${accent}18`,
            padding: "2px 6px",
          }}
        >
          {s}
        </span>
      ))}
      {skills.length > 6 && (
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>
          +{skills.length - 6}
        </span>
      )}
    </div>
  );
}

function CronsMock({ crons }: { crons: { name: string; schedule: string }[] }) {
  const displayCrons =
    crons.length > 0
      ? crons.slice(0, 3)
      : [
          { name: "morning-brief", schedule: "0 8 * * *" },
          { name: "daily-digest", schedule: "0 18 * * *" },
          { name: "weekly-review", schedule: "0 9 * * 1" },
        ];

  return (
    <div className="space-y-1">
      {displayCrons.map((c, i) => (
        <div key={i} className="flex justify-between" style={{ fontSize: 9 }}>
          <span style={{ color: "rgba(255,255,255,0.45)" }}>{c.name}</span>
          <span
            style={{
              color: "rgba(255,255,255,0.2)",
              fontFamily: "monospace",
              fontSize: 8,
            }}
          >
            {c.schedule}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Device Size Toggle ──

export function DeviceSizeToggle({
  size,
  onChange,
}: {
  size: DeviceSize;
  onChange: (size: DeviceSize) => void;
}) {
  const sizes: { key: DeviceSize; label: string }[] = [
    { key: "phone", label: "Phone" },
    { key: "tablet", label: "Tablet" },
    { key: "desktop", label: "Desktop" },
  ];

  return (
    <div className="flex gap-0.5 bg-surface-muted rounded-md p-0.5">
      {sizes.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
            size === s.key
              ? "bg-surface text-text shadow-sm"
              : "text-text-secondary hover:text-text"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
