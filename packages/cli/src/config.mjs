/**
 * Claws config file management (~/.claws/claws.json).
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfigPath, getWorkspaceDir, getRuntimeDir, getLogsDir, getClawsHome } from "./paths.mjs";

const DEFAULT_CONFIG = {
  version: 1,
  workspace: null, // resolved at setup
  runtime: null,   // resolved at setup
  gateway: {
    port: 4317,
    host: "localhost",
  },
  dashboard: {
    port: 4318,
  },
  ai: {
    model: "gpt-4o-mini",
    provider: null,
    gatewayUrl: null,
  },
  onboarding: {
    completed: false,
    completedAt: null,
    approvalMode: "smart",
    primaryView: "founder",
    overlays: [],
    visibility: "background",
  },
  channels: {
    telegram: { enabled: false },
    slack: { enabled: false },
  },
  daemon: {
    installed: false,
    method: null, // "launchd" | "systemd" | null
  },
};

export async function loadConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveConfig(config) {
  const configPath = getConfigPath();
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export function createDefaultConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    workspace: getWorkspaceDir(),
    runtime: getRuntimeDir(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export async function ensureClawsHome() {
  const dirs = [getClawsHome(), getWorkspaceDir(), getRuntimeDir(), getLogsDir()];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}
