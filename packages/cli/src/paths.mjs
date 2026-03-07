/**
 * Claws home directory layout and config resolution.
 *
 * Layout:
 *   ~/.claws/claws.json       — user config
 *   ~/.claws/workspace/       — default workspace root
 *   ~/.claws/runtime/          — PGlite + runtime state
 *   ~/.claws/logs/             — log files
 *
 * Env overrides:
 *   CLAWS_HOME            — override ~/.claws
 *   CLAWS_STATE_DIR       — override runtime dir
 *   CLAWS_CONFIG_PATH     — override config file path
 *   CLAWS_WORKSPACE_DIR   — override workspace dir
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function getClawsHome() {
  return process.env.CLAWS_HOME || path.join(homedir(), ".claws");
}

export function getConfigPath() {
  return (
    process.env.CLAWS_CONFIG_PATH ||
    path.join(getClawsHome(), "claws.json")
  );
}

export function getWorkspaceDir() {
  return (
    process.env.CLAWS_WORKSPACE_DIR ||
    path.join(getClawsHome(), "workspace")
  );
}

export function getRuntimeDir() {
  return (
    process.env.CLAWS_STATE_DIR || path.join(getClawsHome(), "runtime")
  );
}

export function getLogsDir() {
  return path.join(getClawsHome(), "logs");
}

export function clawsHomeExists() {
  return existsSync(getClawsHome());
}

export function configExists() {
  return existsSync(getConfigPath());
}

export function getAllPaths() {
  return {
    home: getClawsHome(),
    config: getConfigPath(),
    workspace: getWorkspaceDir(),
    runtime: getRuntimeDir(),
    logs: getLogsDir(),
  };
}
