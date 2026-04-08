/**
 * Permission Modes — tool-level access control for the Claws agent runtime.
 *
 * Ported from ultraworkers/claw-code rust/crates/runtime/src/permissions.rs
 * (MIT licensed). Simplified for TypeScript.
 *
 * Three levels, ordered by capability:
 *   1. read-only         — no writes, no destructive bash, no sandbox exec
 *   2. workspace-write   — file writes allowed inside workspace, bash allowed
 *   3. danger-full-access — everything, including destructive ops and network
 *
 * Every tool declares its required mode. The runtime denies any call whose
 * required mode exceeds the session's active mode. For interactive flows,
 * the prompter can be consulted to escalate (e.g., "Agent wants to run
 * `rm -rf node_modules`, allow once?").
 */

// ─────────────────────────────────────────────────────────────────
// Core types
// ─────────────────────────────────────────────────────────────────

export type PermissionMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export const PERMISSION_LEVELS: Record<PermissionMode, number> = {
  "read-only": 0,
  "workspace-write": 1,
  "danger-full-access": 2,
};

export function permissionRank(mode: PermissionMode): number {
  return PERMISSION_LEVELS[mode];
}

/**
 * Check whether `active` satisfies the `required` mode.
 * workspace-write satisfies read-only, danger-full satisfies everything.
 */
export function satisfies(
  active: PermissionMode,
  required: PermissionMode
): boolean {
  return permissionRank(active) >= permissionRank(required);
}

// ─────────────────────────────────────────────────────────────────
// Request / response
// ─────────────────────────────────────────────────────────────────

export interface PermissionRequest {
  toolName: string;
  activeMode: PermissionMode;
  requiredMode: PermissionMode;
  /** Serialized tool input for display to the user. */
  input?: Record<string, unknown>;
  /** Reason the tool requested elevated access. */
  reason?: string;
}

export type PermissionDecision =
  | { allow: true; reason?: string }
  | { allow: false; reason: string };

/** Interactive prompter interface — called when a tool needs escalation. */
export interface PermissionPrompter {
  decide(request: PermissionRequest): Promise<PermissionDecision>;
}

/** Hook-level override applied BEFORE normal policy evaluation. */
export type PermissionOverride = "allow" | "deny" | "ask";

export interface PermissionContext {
  /** Pre-policy hook override (plugins can set this). */
  override?: PermissionOverride;
  /** Reason for the override, for display. */
  overrideReason?: string;
}

// ─────────────────────────────────────────────────────────────────
// Tool permission declarations
// ─────────────────────────────────────────────────────────────────

/**
 * Built-in tool → minimum required permission mode.
 * Extend this via `registerToolPermission` for plugin tools.
 */
export const BUILTIN_TOOL_PERMISSIONS: Record<string, PermissionMode> = {
  // Read-only tools
  "fs.read": "read-only",
  "fs.list": "read-only",
  "memory.search": "read-only",
  "memory.getEntry": "read-only",
  "research.fetchUrl": "read-only",
  "research.webSearch": "read-only",
  "browser.extract": "read-only",
  "browser.screenshot": "read-only",
  "browser.navigate": "read-only",
  "status.get": "read-only",

  // Workspace-write tools
  "fs.write": "workspace-write",
  "fs.append": "workspace-write",
  "memory.flush": "workspace-write",
  "memory.promote": "workspace-write",
  "tasks.createTask": "workspace-write",
  "tasks.updateTask": "workspace-write",
  "tasks.moveTask": "workspace-write",
  "tasks.completeTask": "workspace-write",
  "tasks.appendEvent": "workspace-write",
  "demo.saveScreenshot": "workspace-write",
  "demo.saveMetadata": "workspace-write",
  "browser.click": "workspace-write",
  "browser.type": "workspace-write",

  // Danger-full tools
  "sandbox.exec": "danger-full-access",
};

const toolOverrides = new Map<string, PermissionMode>();

/** Register or override a tool's required permission mode. */
export function registerToolPermission(
  name: string,
  mode: PermissionMode
): void {
  toolOverrides.set(name, mode);
}

/** Look up the required permission mode for a tool. */
export function getRequiredMode(toolName: string): PermissionMode {
  return (
    toolOverrides.get(toolName) ??
    BUILTIN_TOOL_PERMISSIONS[toolName] ??
    // Unknown tools default to workspace-write (sane middle ground)
    "workspace-write"
  );
}

// ─────────────────────────────────────────────────────────────────
// Bash command pattern matching (sub-tool level for sandbox.exec)
// ─────────────────────────────────────────────────────────────────

const DESTRUCTIVE_BASH_PATTERNS = [
  /\brm\s+-rf?\b/i,
  /\brm\s+.*\s+\*/i,
  /\bdd\s+if=/i,
  /\bmkfs\./i,
  /\b:\s*\(\)\s*\{\s*:\|:&\s*\}/, // fork bomb
  /\bchmod\s+777\b/i,
  /\bchown\s+-R\b/i,
  /\bkillall\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bdrop\s+(table|database|schema)\b/i,
  /\btruncate\s+table\b/i,
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bcurl\s+.*\|\s*sh\b/i,
  /\bwget\s+.*\|\s*sh\b/i,
];

const WORKSPACE_WRITE_BASH_PATTERNS = [
  /\brm\b/i,
  /\bmv\b/i,
  /\bsed\s+-i\b/i,
  /\btee\b/i,
  /\bnpm\s+install\b/i,
  /\bpnpm\s+(add|install|remove)\b/i,
  /\bgit\s+(add|commit|branch|checkout|merge|rebase)\b/i,
];

/**
 * Classify a bash command string by the minimum permission mode required.
 * Conservative: if a pattern matches, require the higher mode.
 */
export function classifyBashCommand(command: string): PermissionMode {
  for (const pattern of DESTRUCTIVE_BASH_PATTERNS) {
    if (pattern.test(command)) return "danger-full-access";
  }
  for (const pattern of WORKSPACE_WRITE_BASH_PATTERNS) {
    if (pattern.test(command)) return "workspace-write";
  }
  return "read-only";
}

// ─────────────────────────────────────────────────────────────────
// Workspace path gate (for fs.write and friends)
// ─────────────────────────────────────────────────────────────────

/**
 * Check whether a file path is inside the workspace root.
 * In workspace-write mode, writes MUST stay inside the workspace.
 * In danger-full-access mode, any path is allowed.
 */
export function isInsideWorkspace(
  path: string,
  workspaceRoot: string
): boolean {
  // Normalize to avoid `..` escapes
  const normalized = path.split("/").filter(Boolean);
  const resolvedParts: string[] = [];
  for (const part of normalized) {
    if (part === "..") {
      if (resolvedParts.length === 0) return false;
      resolvedParts.pop();
    } else if (part !== ".") {
      resolvedParts.push(part);
    }
  }
  const resolved = "/" + resolvedParts.join("/");
  return resolved.startsWith(workspaceRoot);
}

// ─────────────────────────────────────────────────────────────────
// PermissionPolicy — the main evaluator
// ─────────────────────────────────────────────────────────────────

export interface PolicyOptions {
  activeMode: PermissionMode;
  workspaceRoot?: string;
  prompter?: PermissionPrompter;
  /** If true, deny+throw instead of returning a decision. */
  throwOnDeny?: boolean;
}

export class PermissionPolicy {
  constructor(private opts: PolicyOptions) {}

  get activeMode(): PermissionMode {
    return this.opts.activeMode;
  }

  setMode(mode: PermissionMode): void {
    this.opts.activeMode = mode;
  }

  setPrompter(prompter: PermissionPrompter | undefined): void {
    this.opts.prompter = prompter;
  }

  /**
   * Evaluate a tool call. Returns a decision; does NOT execute the tool.
   *
   * Flow:
   *   1. Look up required mode (tool declarations or bash classification)
   *   2. Apply context override if provided (allow/deny/ask)
   *   3. Check static rank (active >= required?)
   *   4. If shortfall, consult prompter (if provided) or deny
   */
  async evaluate(
    toolName: string,
    input?: Record<string, unknown>,
    context?: PermissionContext
  ): Promise<PermissionDecision> {
    // Determine required mode
    let required = getRequiredMode(toolName);

    // For bash-like tools, refine by command content
    if (
      (toolName === "sandbox.exec" ||
        toolName === "bash" ||
        toolName === "exec") &&
      typeof input?.code === "string"
    ) {
      const refined = classifyBashCommand(input.code);
      if (permissionRank(refined) > permissionRank(required)) {
        required = refined;
      }
    }

    const request: PermissionRequest = {
      toolName,
      activeMode: this.opts.activeMode,
      requiredMode: required,
      input,
    };

    // Context override
    if (context?.override === "allow") {
      return { allow: true, reason: context.overrideReason };
    }
    if (context?.override === "deny") {
      return {
        allow: false,
        reason: context.overrideReason ?? "Denied by hook override",
      };
    }
    if (context?.override === "ask" && this.opts.prompter) {
      return this.opts.prompter.decide(request);
    }

    // Workspace path gate for fs.write and friends
    if (
      (toolName === "fs.write" ||
        toolName === "fs.append" ||
        toolName === "fs.delete") &&
      this.opts.workspaceRoot &&
      typeof input?.path === "string"
    ) {
      if (
        !isInsideWorkspace(input.path, this.opts.workspaceRoot) &&
        this.opts.activeMode !== "danger-full-access"
      ) {
        return {
          allow: false,
          reason: `Path ${input.path} is outside workspace root ${this.opts.workspaceRoot}`,
        };
      }
    }

    // Static rank check
    if (satisfies(this.opts.activeMode, required)) {
      return { allow: true };
    }

    // Shortfall — consult prompter
    if (this.opts.prompter) {
      return this.opts.prompter.decide(request);
    }

    return {
      allow: false,
      reason: `Tool ${toolName} requires ${required} but session is in ${this.opts.activeMode}`,
    };
  }

  /** Throwing variant — useful in middleware. */
  async enforce(
    toolName: string,
    input?: Record<string, unknown>,
    context?: PermissionContext
  ): Promise<void> {
    const decision = await this.evaluate(toolName, input, context);
    if (!decision.allow) {
      const err = new Error(decision.reason) as Error & {
        code: string;
        toolName: string;
      };
      err.code = "PERMISSION_DENIED";
      err.toolName = toolName;
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompters
// ─────────────────────────────────────────────────────────────────

/** Always-allow prompter — for tests and danger-full sessions. */
export class AllowAllPrompter implements PermissionPrompter {
  async decide(): Promise<PermissionDecision> {
    return { allow: true, reason: "AllowAllPrompter" };
  }
}

/** Always-deny prompter — for strict sessions. */
export class DenyAllPrompter implements PermissionPrompter {
  async decide(request: PermissionRequest): Promise<PermissionDecision> {
    return {
      allow: false,
      reason: `Denied by DenyAllPrompter: ${request.toolName} requires ${request.requiredMode}`,
    };
  }
}
