import { useState, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";

export function useWorkspaceFiles() {
  const { toolsHttp } = useGatewayContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const readFile = useCallback(
    async (path: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        return await toolsHttp.readFile(path);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toolsHttp]
  );

  const writeFile = useCallback(
    async (path: string, content: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        return await toolsHttp.writeFile(path, content);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [toolsHttp]
  );

  return { readFile, writeFile, loading, error };
}
