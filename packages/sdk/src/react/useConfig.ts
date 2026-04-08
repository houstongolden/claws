import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import type { ConfigValue, ConfigSchema } from "../core/types";

export function useConfig(key?: string) {
  const { configClient } = useGatewayContext();
  const [value, setValue] = useState<ConfigValue | null>(null);
  const [schema, setSchema] = useState<ConfigSchema[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch value if key is provided
  const fetchValue = useCallback(
    async (configKey?: string) => {
      const k = configKey ?? key;
      if (!k) return null;

      setLoading(true);
      setError(null);
      try {
        const result = await configClient.get(k);
        setValue(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [configClient, key]
  );

  // Fetch schema
  const fetchSchema = useCallback(async () => {
    try {
      const result = await configClient.getSchema();
      setSchema(result);
    } catch {
      // Schema fetch is best-effort
    }
  }, [configClient]);

  useEffect(() => {
    if (key) fetchValue();
    fetchSchema();
  }, [key, fetchValue, fetchSchema]);

  /** Set config value with base-hash safety */
  const set = useCallback(
    async (newValue: unknown) => {
      if (!value) {
        setError(new Error("Must fetch current value before setting"));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await configClient.set(value.key, newValue, value.baseHash);
        // Re-fetch to get new hash
        await fetchValue();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [configClient, value, fetchValue]
  );

  /** Safe read-modify-write */
  const update = useCallback(
    async <T = unknown>(transform: (current: T | undefined) => T) => {
      if (!key) return;
      setLoading(true);
      setError(null);
      try {
        await configClient.update(key, transform);
        await fetchValue();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [configClient, key, fetchValue]
  );

  return {
    value: value?.value,
    baseHash: value?.baseHash,
    schema,
    loading,
    error,
    get: fetchValue,
    set,
    update,
  };
}
