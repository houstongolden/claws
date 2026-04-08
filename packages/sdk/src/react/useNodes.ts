import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { EVENTS } from "../core/protocol";
import type { NodeInfo } from "../core/types";

export function useNodes() {
  const { client } = useGatewayContext();
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<NodeInfo[]>("nodes.list", {});
      setNodes(result ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Subscribe to presence changes for live updates
  useEffect(() => {
    const unsub = client.subscribe(EVENTS.SYSTEM_PRESENCE, () => {
      fetchNodes();
    });
    return unsub;
  }, [client, fetchNodes]);

  return { nodes, loading, error, refetch: fetchNodes };
}
