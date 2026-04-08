import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS, EVENTS } from "../core/protocol";
import type { SessionInfo } from "../core/types";

export function useSessions() {
  const { client } = useGatewayContext();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<SessionInfo[]>(METHODS.SESSIONS_LIST, {});
      setSessions(result ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const unsub1 = client.subscribe(EVENTS.SESSION_CREATED, (payload) => {
      const session = payload as SessionInfo;
      setSessions((prev) => [...prev, session]);
    });
    const unsub2 = client.subscribe(EVENTS.SESSION_ENDED, (payload) => {
      const { key } = payload as { key: string };
      setSessions((prev) => prev.filter((s) => s.key !== key));
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [client]);

  return { sessions, loading, error, refetch: fetchSessions };
}
