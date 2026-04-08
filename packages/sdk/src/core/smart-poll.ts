// ── SmartPollController — framework-agnostic polling with backoff ────────────

export interface SmartPollOptions {
  /** Base polling interval in ms */
  interval: number;
  /** Max backoff multiplier on consecutive errors (default 3) */
  maxBackoffMultiplier?: number;
  /** Pause polling when the document is hidden (default true) */
  pauseOnHidden?: boolean;
}

export class SmartPollController {
  private callback: () => Promise<void>;
  private interval: number;
  private maxBackoff: number;
  private pauseOnHidden: boolean;

  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveErrors = 0;
  private manuallyPaused = false;
  private visibilityPaused = false;
  private running = false;

  private boundVisibilityHandler: (() => void) | null = null;

  constructor(callback: () => Promise<void>, options: SmartPollOptions) {
    this.callback = callback;
    this.interval = options.interval;
    this.maxBackoff = options.maxBackoffMultiplier ?? 3;
    this.pauseOnHidden = options.pauseOnHidden ?? true;
  }

  get isPaused(): boolean {
    return this.manuallyPaused || this.visibilityPaused;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.consecutiveErrors = 0;

    if (this.pauseOnHidden && typeof document !== "undefined") {
      this.boundVisibilityHandler = () => this.handleVisibilityChange();
      document.addEventListener(
        "visibilitychange",
        this.boundVisibilityHandler,
      );
    }

    this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    this.clearTimer();

    if (this.boundVisibilityHandler && typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this.boundVisibilityHandler,
      );
      this.boundVisibilityHandler = null;
    }
  }

  /** Trigger an immediate poll and reset the interval timer. */
  fire(): void {
    if (!this.running) return;
    this.clearTimer();
    this.tick();
  }

  pause(): void {
    this.manuallyPaused = true;
    this.clearTimer();
  }

  resume(): void {
    this.manuallyPaused = false;
    if (this.running && !this.isPaused) {
      this.scheduleTick();
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private handleVisibilityChange(): void {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      this.visibilityPaused = true;
      this.clearTimer();
    } else {
      this.visibilityPaused = false;
      if (this.running && !this.manuallyPaused) {
        this.scheduleTick();
      }
    }
  }

  private currentInterval(): number {
    if (this.consecutiveErrors === 0) return this.interval;
    const multiplier = Math.min(
      Math.pow(2, this.consecutiveErrors - 1),
      this.maxBackoff,
    );
    return this.interval * multiplier;
  }

  private scheduleTick(): void {
    this.clearTimer();
    if (!this.running || this.isPaused) return;
    this.timer = setInterval(() => this.tick(), this.currentInterval());
  }

  private async tick(): Promise<void> {
    if (this.isPaused) return;
    try {
      await this.callback();
      this.consecutiveErrors = 0;
    } catch {
      this.consecutiveErrors++;
    }
    // Reschedule to pick up any backoff change
    if (this.running && !this.isPaused) {
      this.scheduleTick();
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
