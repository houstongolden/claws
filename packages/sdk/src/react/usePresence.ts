import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS, EVENTS } from "../core/protocol";
import type { PresenceInfo } from "../core/types";

export function usePresence() {
  const { client } = useGatewayContext();
  const [presence, setPresence] = useState<PresenceInfo>({
    agentOnline: false,
    connectedDevices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPresence = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<PresenceInfo>(METHODS.SYSTEM_PRESENCE, {});
      if (result) setPresence(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchPresence();
  }, [fetchPresence]);

  // Subscribe to live presence events
  useEffect(() => {
    const unsub = client.subscribe(EVENTS.SYSTEM_PRESENCE, (payload) => {
      const info = payload as PresenceInfo;
      setPresence(info);
    });
    return unsub;
  }, [client]);

  return { ...presence, loading, error, refetch: fetchPresence };
}
