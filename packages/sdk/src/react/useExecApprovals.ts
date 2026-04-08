import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS, EVENTS } from "../core/protocol";
import type { ExecApprovalRequest } from "../core/types";

export function useExecApprovals() {
  const { client } = useGatewayContext();
  const [pending, setPending] = useState<ExecApprovalRequest[]>([]);

  // Subscribe to approval request events
  useEffect(() => {
    const unsub = client.subscribe(
      EVENTS.EXEC_APPROVAL_REQUEST,
      (payload) => {
        const request = payload as ExecApprovalRequest;
        setPending((prev) => [...prev, request]);
      }
    );
    return unsub;
  }, [client]);

  const approve = useCallback(
    async (id: string) => {
      await client.send(METHODS.EXEC_APPROVE, { id });
      setPending((prev) => prev.filter((r) => r.id !== id));
    },
    [client]
  );

  const deny = useCallback(
    async (id: string, reason?: string) => {
      await client.send(METHODS.EXEC_DENY, { id, reason });
      setPending((prev) => prev.filter((r) => r.id !== id));
    },
    [client]
  );

  const clear = useCallback(() => {
    setPending([]);
  }, []);

  return { pending, approve, deny, clear, count: pending.length };
}
