import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS } from "../core/protocol";
import type { ChannelStatus } from "../core/types";

export function useChannels() {
  const { client } = useGatewayContext();
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<ChannelStatus[]>(METHODS.CHANNELS_STATUS, {});
      setChannels(result ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return { channels, loading, error, refetch: fetchChannels };
}
