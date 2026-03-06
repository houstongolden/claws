/**
 * @deprecated Runtime state (traces, approvals, view-state) now uses @claws/runtime-db (PGlite).
 * This file is kept for reference only. Do not use in new code.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApprovalItem, TraceItem, ViewStack } from "@claws/shared/types";

export type RuntimeStore = {
  traces: TraceItem[];
  approvals: ApprovalItem[];
  viewState: ViewStack | null;
  updatedAt: number;
};

function defaultStore(): RuntimeStore {
  return {
    traces: [],
    approvals: [],
    viewState: null,
    updatedAt: Date.now()
  };
}

export function getRuntimeStorePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".claws", "runtime-store.json");
}

export async function loadRuntimeStore(workspaceRoot: string): Promise<RuntimeStore> {
  const filePath = getRuntimeStorePath(workspaceRoot);
  if (!existsSync(filePath)) return defaultStore();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeStore>;
    return {
      traces: parsed.traces ?? [],
      approvals: parsed.approvals ?? [],
      viewState: parsed.viewState ?? null,
      updatedAt: parsed.updatedAt ?? Date.now()
    };
  } catch {
    return defaultStore();
  }
}

export async function persistRuntimeStore(workspaceRoot: string, store: RuntimeStore): Promise<void> {
  const filePath = getRuntimeStorePath(workspaceRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: RuntimeStore = {
    ...store,
    updatedAt: Date.now()
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}
