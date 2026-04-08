import { useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";

/**
 * Low-level hook for gateway connection state and raw send/subscribe.
 */
export function useGateway() {
  const { client, status, error } = useGatewayContext();

  const send = useCallback(
    <T = unknown>(method: string, params: Record<string, unknown> = {}) =>
      client.send<T>(method, params),
    [client]
  );

  const subscribe = useCallback(
    (event: string, handler: (payload: unknown) => void) =>
      client.subscribe(event, handler),
    [client]
  );

  return {
    client,
    status,
    error,
    send,
    subscribe,
    isConnected: status === "connected",
    isReconnecting: status === "reconnecting",
    needsPairing: status === "needs_pairing",
  };
}
