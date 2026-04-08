/**
 * Typed event emitter for connection state and gateway events.
 * Framework-agnostic — no dependencies.
 */

type Listener<T = unknown> = (data: T) => void;

export class TypedEventEmitter<Events extends Record<string, unknown> = Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as Listener);

    // Return unsubscribe function
    return () => {
      set.delete(listener as Listener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[claws-sdk] Error in ${String(event)} listener:`, err);
      }
    }
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
