/**
 * Device pairing state machine.
 *
 * Flow: WS connects → if device not approved, server closes with code 1008
 * → client shows pairing UI → user runs `openclaw devices approve` in terminal
 * → client reconnects → connection succeeds
 */

export type PairingState =
  | "unknown"
  | "paired"
  | "needs_pairing"
  | "pairing_pending";

const PAIRED_DEVICES_KEY = "claws-paired-devices";

export class PairingController {
  private state: PairingState = "unknown";
  private gatewayUrl = "";
  private listeners = new Set<(state: PairingState) => void>();

  /** Get current pairing state */
  getState(): PairingState {
    return this.state;
  }

  /** Subscribe to state changes */
  onStateChange(listener: (state: PairingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Mark this device as paired for a gateway */
  markPaired(gatewayUrl: string): void {
    this.gatewayUrl = gatewayUrl;
    this.setState("paired");
    this.persistPairedStatus(gatewayUrl, true);
  }

  /** Handle WS close code — returns true if pairing is required */
  handleClose(code: number, gatewayUrl: string): boolean {
    this.gatewayUrl = gatewayUrl;

    if (code === 1008) {
      this.setState("needs_pairing");
      this.persistPairedStatus(gatewayUrl, false);
      return true;
    }

    return false;
  }

  /** Set state to pairing_pending (user has been shown pairing UI) */
  markPairingPending(): void {
    this.setState("pairing_pending");
  }

  /** Check if a gateway has been previously paired */
  isPreviouslyPaired(gatewayUrl: string): boolean {
    return this.loadPairedStatus(gatewayUrl);
  }

  /** Reset state */
  reset(): void {
    this.setState("unknown");
  }

  private setState(newState: PairingState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const listener of this.listeners) {
      try {
        listener(newState);
      } catch (err) {
        console.error("[claws-sdk] Error in pairing state listener:", err);
      }
    }
  }

  private persistPairedStatus(url: string, paired: boolean): void {
    if (typeof globalThis.localStorage === "undefined") return;
    try {
      const stored = JSON.parse(localStorage.getItem(PAIRED_DEVICES_KEY) || "{}");
      stored[url] = paired;
      localStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(stored));
    } catch {
      // Storage not available
    }
  }

  private loadPairedStatus(url: string): boolean {
    if (typeof globalThis.localStorage === "undefined") return false;
    try {
      const stored = JSON.parse(localStorage.getItem(PAIRED_DEVICES_KEY) || "{}");
      return stored[url] === true;
    } catch {
      return false;
    }
  }
}
