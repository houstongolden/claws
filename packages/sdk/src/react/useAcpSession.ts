import { useState, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS } from "../core/protocol";
import type { AcpSession, AcpSessionState } from "../core/types";

export function useAcpSession() {
  const { client } = useGatewayContext();
  const [session, setSession] = useState<AcpSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const state: AcpSessionState = session?.state ?? "idle";

  /** Spawn a new ACP coding session */
  const spawn = useCallback(
    async (prompt: string, sessionKey?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.send<AcpSession>(METHODS.ACP_SPAWN, {
          prompt,
          sessionKey,
        });
        setSession(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /** Steer a running ACP session */
  const steer = useCallback(
    async (instruction: string) => {
      if (!session) return;
      setLoading(true);
      setError(null);
      try {
        await client.send(METHODS.ACP_STEER, {
          sessionId: session.id,
          instruction,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [client, session]
  );

  /** Cancel a running ACP session */
  const cancel = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      await client.send(METHODS.ACP_CANCEL, { sessionId: session.id });
      setSession((s) => (s ? { ...s, state: "cancelled" } : null));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, session]);

  return {
    session,
    state,
    loading,
    error,
    spawn,
    steer,
    cancel,
    isIdle: state === "idle",
    isRunning: state === "running" || state === "spawning",
  };
}
