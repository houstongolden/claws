/**
 * Exponential backoff with jitter for WebSocket reconnection.
 *
 * Pattern: min(1000 * 2^attempt, 30000) with +/-25% jitter
 */

export interface ReconnectConfig {
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Jitter factor 0-1 (default: 0.25) */
  jitter?: number;
  /** Max attempts, 0 = unlimited (default: 0) */
  maxAttempts?: number;
}

const DEFAULTS: Required<ReconnectConfig> = {
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: 0.25,
  maxAttempts: 0,
};

export class ReconnectController {
  private config: Required<ReconnectConfig>;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: ReconnectConfig) {
    this.config = { ...DEFAULTS, ...config };
  }

  /** Calculate next delay and increment attempt counter. Returns null if max attempts exceeded. */
  nextDelay(): number | null {
    if (this.config.maxAttempts > 0 && this.attempt >= this.config.maxAttempts) {
      return null;
    }

    const base = Math.min(
      this.config.baseDelay * Math.pow(2, this.attempt),
      this.config.maxDelay
    );

    // Apply jitter: +/- jitter%
    const jitterRange = base * this.config.jitter;
    const delay = base + (Math.random() * 2 - 1) * jitterRange;

    this.attempt++;
    return Math.round(delay);
  }

  /** Schedule a reconnect callback. Returns false if max attempts exceeded. */
  schedule(callback: () => void): boolean {
    this.cancel();
    const delay = this.nextDelay();
    if (delay === null) return false;

    this.timer = setTimeout(callback, delay);
    return true;
  }

  /** Reset attempt counter (call on successful connection) */
  reset(): void {
    this.attempt = 0;
    this.cancel();
  }

  /** Cancel any pending reconnect timer */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Current attempt number */
  get attempts(): number {
    return this.attempt;
  }
}
