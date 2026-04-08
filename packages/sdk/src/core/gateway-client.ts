/**
 * GatewayClient — WebSocket client for OpenClaw Gateway v3.
 *
 * Handles: connect, auth, send/receive, reconnect, pairing.
 */

import { TypedEventEmitter } from "./event-emitter";
import { ReconnectController } from "./reconnect";
import { PairingController } from "./pairing";
import { getDeviceId } from "./auth";
import { METHODS, EVENTS, PROTOCOL_VERSION } from "./protocol";
import type {
  ConnectionStatus,
  GatewayConfig,
  GatewayClientEvents,
  GatewayMessage,
  RpcRequest,
  RpcResponse,
  GatewayEvent,
} from "./types";

/** Timeout for connect challenge (ms) */
const CHALLENGE_TIMEOUT = 750;

/** Ping interval (ms) */
const PING_INTERVAL = 30_000;

interface PendingRpc {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class GatewayClient extends TypedEventEmitter<GatewayClientEvents> {
  private ws: WebSocket | null = null;
  private config: GatewayConfig;
  private status: ConnectionStatus = "disconnected";
  private reconnect: ReconnectController;
  private pairing: PairingController;
  private pendingRpcs = new Map<string, PendingRpc>();
  private eventSubscriptions = new Map<string, Set<(payload: unknown) => void>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private challengeTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
    this.reconnect = new ReconnectController({
      maxAttempts: config.maxReconnectAttempts,
    });
    this.pairing = new PairingController();
  }

  /** Current connection status */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Pairing controller (for UI integration) */
  getPairing(): PairingController {
    return this.pairing;
  }

  /** Connect to the gateway */
  connect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.intentionalClose = false;
    this.setStatus("connecting");

    const ws = new WebSocket(this.config.url);
    this.ws = ws;

    ws.onopen = () => {
      // Wait for connect.challenge event or timeout
      this.challengeTimer = setTimeout(() => {
        // No challenge received — send connect directly
        this.sendConnect();
      }, CHALLENGE_TIMEOUT);
    };

    ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    ws.onclose = (event) => {
      this.cleanup();

      // Check if pairing required (code 1008)
      if (this.pairing.handleClose(event.code, this.config.url)) {
        this.setStatus("needs_pairing");
        this.config.onPairingRequired?.();
        return;
      }

      if (this.intentionalClose) {
        this.setStatus("disconnected");
        return;
      }

      // Unexpected close — reconnect
      this.setStatus("reconnecting");
      const scheduled = this.reconnect.schedule(() => this.connect());
      if (!scheduled) {
        this.setStatus("disconnected");
        this.emit("error", new Error("Max reconnect attempts exceeded"));
      }
    };

    ws.onerror = () => {
      // Error events are followed by close events, so we handle reconnection there
      this.emit("error", new Error("WebSocket error"));
    };
  }

  /** Disconnect from the gateway */
  disconnect(): void {
    this.intentionalClose = true;
    this.reconnect.cancel();
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  /** Send an RPC request and await the response */
  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }

      const id = crypto.randomUUID();
      const request: RpcRequest = { type: "req", id, method, params };

      // Set timeout for RPC response (30s)
      const timer = setTimeout(() => {
        this.pendingRpcs.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30_000);

      this.pendingRpcs.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  /** Subscribe to a gateway event */
  subscribe(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventSubscriptions.has(event)) {
      this.eventSubscriptions.set(event, new Set());
    }
    this.eventSubscriptions.get(event)!.add(handler);

    return () => {
      const subs = this.eventSubscriptions.get(event);
      subs?.delete(handler);
      if (subs?.size === 0) this.eventSubscriptions.delete(event);
    };
  }

  /** Retry connection after pairing approval */
  retryAfterPairing(): void {
    this.pairing.markPairingPending();
    this.reconnect.reset();
    this.connect();
  }

  // ── Internal ──

  private handleMessage(raw: string | ArrayBuffer): void {
    let data: unknown;
    try {
      data = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      console.warn("[claws-sdk] Failed to parse message:", raw);
      return;
    }

    const msg = data as GatewayMessage;
    this.emit("message:raw", msg);

    if (msg.type === "res") {
      this.handleRpcResponse(msg as RpcResponse);
    } else if (msg.type === "event") {
      this.handleEvent(msg as GatewayEvent);
    }
  }

  private handleRpcResponse(res: RpcResponse): void {
    const pending = this.pendingRpcs.get(res.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRpcs.delete(res.id);

    if (res.ok) {
      pending.resolve(res.result);
    } else {
      pending.reject(
        new Error(res.error?.message ?? "RPC error", { cause: res.error })
      );
    }
  }

  private handleEvent(event: GatewayEvent): void {
    // Handle connect challenge
    if (event.event === EVENTS.CONNECT_CHALLENGE) {
      if (this.challengeTimer) {
        clearTimeout(this.challengeTimer);
        this.challengeTimer = null;
      }
      this.setStatus("challenged");
      this.sendConnect();
      return;
    }

    // Dispatch to typed event emitter
    const typedEventKey = `event:${event.event}` as keyof GatewayClientEvents;
    this.emit(typedEventKey, event.payload as GatewayClientEvents[typeof typedEventKey]);

    // Dispatch to runtime subscribers
    const subs = this.eventSubscriptions.get(event.event);
    if (subs) {
      for (const handler of subs) {
        try {
          handler(event.payload);
        } catch (err) {
          console.error(`[claws-sdk] Error in ${event.event} handler:`, err);
        }
      }
    }
  }

  private sendConnect(): void {
    const deviceId = getDeviceId();

    const params = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        ...this.config.client,
        id: deviceId,
      },
      role: this.config.role ?? "operator",
      scopes: this.config.scopes ?? ["operator.admin"],
      caps: this.config.caps ?? [],
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "claws-sdk",
      locale:
        typeof navigator !== "undefined"
          ? navigator.language
          : "en-US",
    };

    this.send(METHODS.CONNECT, params)
      .then(() => {
        this.setStatus("connected");
        this.reconnect.reset();
        this.pairing.markPaired(this.config.url);
        this.config.onPairingComplete?.();
        this.startPing();
      })
      .catch((err) => {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
        this.ws?.close();
      });
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send a lightweight ping RPC
        this.send("ping", {}).catch(() => {
          // Ping failure will trigger reconnect via onclose
        });
      }
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanup(): void {
    this.stopPing();
    if (this.challengeTimer) {
      clearTimeout(this.challengeTimer);
      this.challengeTimer = null;
    }
    // Reject all pending RPCs
    for (const [id, pending] of this.pendingRpcs) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRpcs.clear();
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.emit("status:change", newStatus);
  }
}
