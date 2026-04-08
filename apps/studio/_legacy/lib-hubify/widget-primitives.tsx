"use client";

import React from "react";

// ── Color constants (inline for dark preview panel) ──────────────────────────
const COLORS = {
  blue: "#6B8FCC",
  green: "#6BAF7A",
  purple: "#9B7FCC",
  amber: "#D4A574",
  red: "#CC6B6B",
  bg: "#111",
  border: "rgba(255,255,255,0.05)",
  text: "rgba(255,255,255,0.9)",
  textSecondary: "rgba(255,255,255,0.6)",
  textMuted: "rgba(255,255,255,0.4)",
} as const;

// ── MetricCard ───────────────────────────────────────────────────────────────

type MetricVariant = "blue" | "green" | "purple" | "amber" | "red";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: MetricVariant;
}

export function MetricCard({
  label,
  value,
  sublabel,
  variant = "blue",
}: MetricCardProps) {
  const accent = COLORS[variant];
  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── SignalPill ────────────────────────────────────────────────────────────────

type SignalStatus = "success" | "warning" | "error" | "info";

interface SignalPillProps {
  label: string;
  status: SignalStatus;
}

const SIGNAL_COLORS: Record<SignalStatus, string> = {
  success: COLORS.green,
  warning: COLORS.amber,
  error: COLORS.red,
  info: COLORS.blue,
};

export function SignalPill({ label, status }: SignalPillProps) {
  const color = SIGNAL_COLORS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: 9999,
        padding: "2px 8px",
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

// ── HealthRow ────────────────────────────────────────────────────────────────

interface HealthRowProps {
  label: string;
  value: number;
  showBar?: boolean;
}

export function HealthRow({ label, value, showBar = true }: HealthRowProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const barColor =
    clamped < 70 ? COLORS.green : clamped < 90 ? COLORS.amber : COLORS.red;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          fontSize: 10,
          color: COLORS.textSecondary,
          minWidth: 60,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      {showBar && (
        <div
          style={{
            flex: 1,
            height: 4,
            background: COLORS.border,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${clamped}%`,
              height: "100%",
              background: barColor,
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
      <div
        style={{
          fontSize: 10,
          color: barColor,
          fontWeight: 600,
          minWidth: 28,
          textAlign: "right",
        }}
      >
        {clamped}%
      </div>
    </div>
  );
}

// ── StatRow ──────────────────────────────────────────────────────────────────

interface StatRowProps {
  label: string;
  value: string | number;
  alert?: boolean;
}

export function StatRow({ label, value, alert }: StatRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0",
      }}
    >
      <span style={{ fontSize: 10, color: COLORS.textSecondary }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: alert ? COLORS.red : COLORS.text,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── LogRow ───────────────────────────────────────────────────────────────────

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogRowProps {
  level: LogLevel;
  message: string;
  timestamp?: string;
}

const LOG_DOT_COLORS: Record<LogLevel, string> = {
  info: COLORS.blue,
  warn: COLORS.amber,
  error: COLORS.red,
  debug: COLORS.purple,
};

export function LogRow({ level, message, timestamp }: LogRowProps) {
  const dotColor = LOG_DOT_COLORS[level];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        padding: "2px 0",
        fontSize: 10,
        fontFamily: "monospace",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
          marginTop: 3,
        }}
      />
      <span style={{ color: COLORS.textSecondary, flex: 1, lineHeight: 1.5 }}>
        {message}
      </span>
      {timestamp && (
        <span style={{ color: COLORS.textMuted, flexShrink: 0 }}>
          {timestamp}
        </span>
      )}
    </div>
  );
}

// ── QuickAction ──────────────────────────────────────────────────────────────

interface QuickActionProps {
  label: string;
  description?: string;
  onClick: () => void;
}

export function QuickAction({ label, description, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        padding: "6px 10px",
        cursor: "pointer",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.amber;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          COLORS.border;
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: COLORS.text }}>
        {label}
      </div>
      {description && (
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>
          {description}
        </div>
      )}
    </button>
  );
}

// ── WidgetHeader ─────────────────────────────────────────────────────────────

interface WidgetHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function WidgetHeader({ title, action }: WidgetHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.text,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── WidgetCard ───────────────────────────────────────────────────────────────

interface WidgetCardProps {
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({ children, className }: WidgetCardProps) {
  return (
    <div
      className={className}
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 12,
      }}
    >
      {children}
    </div>
  );
}
