import { useState, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import type { ToolInvokeRequest, ToolInvokeResponse } from "../core/tools-http";

export function useToolsInvoke() {
  const { toolsHttp } = useGatewayContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(
    async (request: ToolInvokeRequest): Promise<ToolInvokeResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await toolsHttp.invoke(request);
        if (!result.ok) {
          setError(new Error(result.error ?? "Tool invocation failed"));
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return { ok: false, error: error.message };
      } finally {
        setLoading(false);
      }
    },
    [toolsHttp]
  );

  return { invoke, loading, error };
}
