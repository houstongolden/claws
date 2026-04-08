/**
 * Worker Boot Lifecycle — explicit state machine for async agent workers.
 *
 * Ported from ultraworkers/claw-code rust/crates/runtime/src/worker_boot.rs
 * (MIT licensed). Simplified for TypeScript; full trust resolver, prompt
 * targeting, and recovery recipes are deferred.
 *
 * States (in typical order):
 *   spawning       → worker process started, handshake in progress
 *   trust_required → needs user approval for workspace trust (first boot)
 *   ready          → trust confirmed, ready to accept prompts
 *   running        → actively executing a turn
 *   blocked        → waiting on an approval, tool result, or external input
 *   finished       → clean exit
 *   failed         → errored out, captured in lastError
 *
 * Transitions are strict: only certain moves are legal. Illegal transitions
 * throw, so bugs surface immediately rather than drifting into weird states.
 */

export type WorkerStatus =
  | "spawning"
  | "trust_required"
  | "ready"
  | "running"
  | "blocked"
  | "finished"
  | "failed";

export type WorkerFailureKind =
  | "trust_gate"
  | "prompt_delivery"
  | "branch_divergence"
  | "compile"
  | "test"
  | "plugin_startup"
  | "network"
  | "cost_cap"
  | "unknown";

export interface WorkerFailure {
  kind: WorkerFailureKind;
  message: string;
  at: string; // ISO timestamp
  recoverable: boolean;
}

export interface WorkerStateSnapshot {
  workerId: string;
  status: WorkerStatus;
  currentTask?: string;
  currentApprovalId?: string;
  spawnedAt: string;
  lastUpdatedAt: string;
  lastError?: WorkerFailure;
  stepsExecuted: number;
}

// ───────────────────────────────────────────────────────────────
// Transition rules
// ───────────────────────────────────────────────────────────────

type Transition = { from: WorkerStatus; to: WorkerStatus };

const LEGAL_TRANSITIONS: Transition[] = [
  // From spawning
  { from: "spawning", to: "trust_required" },
  { from: "spawning", to: "ready" },
  { from: "spawning", to: "failed" },

  // From trust_required
  { from: "trust_required", to: "ready" },
  { from: "trust_required", to: "failed" },

  // From ready
  { from: "ready", to: "running" },
  { from: "ready", to: "finished" },
  { from: "ready", to: "failed" },

  // From running
  { from: "running", to: "ready" },
  { from: "running", to: "blocked" },
  { from: "running", to: "finished" },
  { from: "running", to: "failed" },

  // From blocked
  { from: "blocked", to: "running" },
  { from: "blocked", to: "ready" },
  { from: "blocked", to: "failed" },
  { from: "blocked", to: "finished" },

  // Terminal states — no transitions out
];

export function isLegalTransition(
  from: WorkerStatus,
  to: WorkerStatus
): boolean {
  if (from === to) return true; // idempotent updates allowed
  return LEGAL_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

// ───────────────────────────────────────────────────────────────
// WorkerState — the main tracker
// ───────────────────────────────────────────────────────────────

export interface WorkerStateListener {
  (snapshot: WorkerStateSnapshot): void;
}

export class WorkerState {
  private status: WorkerStatus;
  private currentTask?: string;
  private currentApprovalId?: string;
  private readonly spawnedAt: string;
  private lastUpdatedAt: string;
  private lastError?: WorkerFailure;
  private stepsExecuted = 0;
  private readonly listeners = new Set<WorkerStateListener>();

  constructor(public readonly workerId: string) {
    this.status = "spawning";
    const now = new Date().toISOString();
    this.spawnedAt = now;
    this.lastUpdatedAt = now;
  }

  snapshot(): WorkerStateSnapshot {
    return {
      workerId: this.workerId,
      status: this.status,
      currentTask: this.currentTask,
      currentApprovalId: this.currentApprovalId,
      spawnedAt: this.spawnedAt,
      lastUpdatedAt: this.lastUpdatedAt,
      lastError: this.lastError,
      stepsExecuted: this.stepsExecuted,
    };
  }

  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Transition to a new state. Throws if the transition is illegal.
   */
  transition(next: WorkerStatus, detail?: { task?: string; approvalId?: string }): void {
    if (!isLegalTransition(this.status, next)) {
      throw new Error(
        `Worker ${this.workerId}: illegal transition ${this.status} → ${next}`
      );
    }
    this.status = next;
    this.lastUpdatedAt = new Date().toISOString();
    if (detail?.task !== undefined) this.currentTask = detail.task;
    if (detail?.approvalId !== undefined) {
      this.currentApprovalId = detail.approvalId;
    }
    // Clear approval on resume
    if (next === "running" || next === "ready") {
      this.currentApprovalId = undefined;
    }
    this.emit();
  }

  /** Mark a step of work complete. */
  incrementStep(): void {
    this.stepsExecuted++;
    this.lastUpdatedAt = new Date().toISOString();
    this.emit();
  }

  /** Transition to failed with a structured error. */
  fail(kind: WorkerFailureKind, message: string, recoverable = false): void {
    this.lastError = {
      kind,
      message,
      at: new Date().toISOString(),
      recoverable,
    };
    if (this.status !== "failed") {
      this.transition("failed");
    } else {
      this.lastUpdatedAt = new Date().toISOString();
      this.emit();
    }
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: WorkerStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        // isolate listener errors
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────
// WorkerRegistry — track multiple workers
// ───────────────────────────────────────────────────────────────

export class WorkerRegistry {
  private readonly workers = new Map<string, WorkerState>();
  private readonly listeners = new Set<WorkerStateListener>();

  spawn(workerId: string): WorkerState {
    if (this.workers.has(workerId)) {
      throw new Error(`Worker ${workerId} already exists`);
    }
    const worker = new WorkerState(workerId);
    this.workers.set(workerId, worker);
    worker.subscribe((snapshot) => {
      for (const listener of this.listeners) {
        try {
          listener(snapshot);
        } catch {
          // isolate
        }
      }
    });
    // Emit initial snapshot
    for (const listener of this.listeners) {
      try {
        listener(worker.snapshot());
      } catch {
        // isolate
      }
    }
    return worker;
  }

  get(workerId: string): WorkerState | undefined {
    return this.workers.get(workerId);
  }

  remove(workerId: string): boolean {
    return this.workers.delete(workerId);
  }

  list(): WorkerStateSnapshot[] {
    return Array.from(this.workers.values()).map((w) => w.snapshot());
  }

  /** Workers whose status is NOT finished or failed. */
  listActive(): WorkerStateSnapshot[] {
    return this.list().filter(
      (s) => s.status !== "finished" && s.status !== "failed"
    );
  }

  /** Workers blocked on something (need user attention). */
  listBlocked(): WorkerStateSnapshot[] {
    return this.list().filter(
      (s) => s.status === "blocked" || s.status === "trust_required"
    );
  }

  /** Subscribe to ANY worker state change in the registry. */
  subscribe(listener: WorkerStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// ───────────────────────────────────────────────────────────────
// Singleton (convenient for single-process workers)
// ───────────────────────────────────────────────────────────────

let defaultRegistry: WorkerRegistry | undefined;

export function getDefaultRegistry(): WorkerRegistry {
  if (!defaultRegistry) defaultRegistry = new WorkerRegistry();
  return defaultRegistry;
}
