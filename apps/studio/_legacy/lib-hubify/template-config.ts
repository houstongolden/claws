/**
 * Studio template configuration — the structured data model for
 * building workspace templates visually.
 *
 * A template is NOT a set of markdown files. It's a complete
 * workspace configuration: dashboard layout, theme, agent personality,
 * skills, panels, and onboarding.
 */

import type { TemplateCategory } from "@/lib/template-data";

export interface StudioTemplate {
  // ── Identity ──
  name: string;
  slug: string;
  tagline: string;
  description: string;
  monogram: string;
  accent: string;
  category: TemplateCategory;
  /** Theme ID from themes.ts (default: "dark") */
  themeId: string;

  // ── Agent ──
  agentName: string;
  personality: string; // SOUL.md content
  greeting: string;
  voice: {
    tone: "formal" | "casual" | "professional" | "friendly" | "technical" | "creative";
    style: "verbose" | "concise" | "structured" | "narrative";
  };

  // ── Dashboard Layout ──
  panels: PanelConfig[];
  sidebarPanels: PanelConfig[];

  // ── Skills & Integrations ──
  skills: string[];
  integrations: string[];

  // ── Sections (marketing / template card display) ──
  sections: SectionConfig[];

  // ── Memory Seeds ──
  memorySeeds: MemorySeed[];

  // ── Cron Jobs ──
  crons: CronConfig[];
}

export interface PanelConfig {
  id: string;
  label: string;
  type: string;
  visible: boolean;
  position: number;
  size: "sm" | "md" | "lg" | "full";
}

export interface SectionConfig {
  title: string;
  icon: string;
  description: string;
  features: string[];
}

export interface MemorySeed {
  key: string;
  content: string;
  type: "episodic" | "semantic" | "procedural";
}

export interface CronConfig {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
}

// ── Available Dashboard Panels ──

export const AVAILABLE_PANELS: PanelConfig[] = [
  { id: "chat", label: "Chat", type: "chat", visible: true, position: 0, size: "lg" },
  { id: "terminal", label: "Terminal", type: "terminal", visible: true, position: 1, size: "md" },
  { id: "activity-feed", label: "Activity Feed", type: "activity", visible: true, position: 2, size: "md" },
  { id: "files", label: "Files", type: "files", visible: false, position: 3, size: "md" },
  { id: "memory", label: "Memory", type: "memory", visible: false, position: 4, size: "md" },
  { id: "skills-panel", label: "Skills", type: "skills", visible: false, position: 5, size: "sm" },
  { id: "cron-panel", label: "Cron Jobs", type: "crons", visible: false, position: 6, size: "sm" },
  { id: "analytics", label: "Analytics", type: "analytics", visible: false, position: 7, size: "md" },
];

export const AVAILABLE_SIDEBAR_PANELS: PanelConfig[] = [
  { id: "quick-actions", label: "Quick Actions", type: "actions", visible: true, position: 0, size: "sm" },
  { id: "agent-status", label: "Agent Status", type: "status", visible: true, position: 1, size: "sm" },
  { id: "usage-stats", label: "Usage Stats", type: "usage", visible: true, position: 2, size: "sm" },
  { id: "sync-status", label: "Sync Status", type: "sync", visible: false, position: 3, size: "sm" },
];

// ── Preset Accent Colors ──

export const ACCENT_PRESETS = [
  { name: "Amber", value: "#D4A574" },
  { name: "Blue", value: "#6B8FCC" },
  { name: "Green", value: "#6BAF7A" },
  { name: "Purple", value: "#9B7FCC" },
  { name: "Rose", value: "#CC7F8F" },
  { name: "Teal", value: "#6BAFAF" },
  { name: "Orange", value: "#CC8F5A" },
  { name: "Slate", value: "#8F9BAF" },
];

// ── Section Icons ──

export const SECTION_ICONS = ["◈", "◉", "◎", "◆", "◇", "▦", "☑", "☆", "⚡", "🧠", "📊", "💬", "🔧", "📁"];

// ── Default Template ──

export function createBlankTemplate(): StudioTemplate {
  return {
    name: "My Template",
    slug: "my-template",
    tagline: "A custom AI OS template",
    description: "",
    monogram: "M",
    accent: "#D4A574",
    category: "personal",
    themeId: "dark",
    agentName: "Agent",
    personality: "",
    greeting: "Hello! How can I help you today?",
    voice: { tone: "friendly", style: "concise" },
    panels: AVAILABLE_PANELS.map((p) => ({ ...p })),
    sidebarPanels: AVAILABLE_SIDEBAR_PANELS.map((p) => ({ ...p })),
    skills: [],
    integrations: [],
    sections: [],
    memorySeeds: [],
    crons: [],
  };
}
