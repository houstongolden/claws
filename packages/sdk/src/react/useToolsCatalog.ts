import { useState, useEffect, useCallback, useMemo } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS } from "../core/protocol";
import type { ToolDefinition } from "../core/types";

export function useToolsCatalog() {
  const { client } = useGatewayContext();
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<ToolDefinition[]>(METHODS.TOOLS_LIST, {});
      setTools(result ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  /** Tools grouped by provenance */
  const grouped = useMemo(() => {
    const groups: Record<string, ToolDefinition[]> = { core: [] };
    for (const tool of tools) {
      const key = tool.provenance;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tool);
    }
    return groups;
  }, [tools]);

  /** Core tools only */
  const coreTools = useMemo(() => tools.filter((t) => t.provenance === "core"), [tools]);

  /** Plugin tools only */
  const pluginTools = useMemo(() => tools.filter((t) => t.provenance !== "core"), [tools]);

  return {
    tools,
    grouped,
    coreTools,
    pluginTools,
    loading,
    error,
    refetch: fetchTools,
  };
}
