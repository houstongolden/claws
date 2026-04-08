"use client";

import React from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type WidgetSize = "sm" | "md" | "lg" | "full";

export interface WidgetSlot {
  id: string;
  component: React.ReactNode;
  size: WidgetSize;
  visible: boolean;
}

interface WidgetGridProps {
  widgets: WidgetSlot[];
}

// ── Size → column span mapping ───────────────────────────────────────────────

const SIZE_TO_SPAN: Record<WidgetSize, number> = {
  sm: 4,
  md: 6,
  lg: 8,
  full: 12,
};

// ── WidgetGrid ───────────────────────────────────────────────────────────────

export function WidgetGrid({ widgets }: WidgetGridProps) {
  const visible = widgets.filter((w) => w.visible);

  // Row-flushing: assign widgets to rows so no row exceeds 12 cols
  const rows: WidgetSlot[][] = [];
  let currentRow: WidgetSlot[] = [];
  let currentCols = 0;

  for (const widget of visible) {
    const span = SIZE_TO_SPAN[widget.size];
    if (currentCols + span > 12 && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentCols = 0;
    }
    currentRow.push(widget);
    currentCols += span;
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: 8,
      }}
    >
      {rows.flat().map((widget) => (
        <div
          key={widget.id}
          style={{
            gridColumn: `span ${SIZE_TO_SPAN[widget.size]}`,
          }}
        >
          {widget.component}
        </div>
      ))}
    </div>
  );
}
