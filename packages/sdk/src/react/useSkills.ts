import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS } from "../core/protocol";
import type { SkillInfo } from "../core/types";

export function useSkills() {
  const { client } = useGatewayContext();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<SkillInfo[]>(METHODS.SKILLS_LIST, {});
      setSkills(result ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const enable = useCallback(
    async (id: string) => {
      await client.send(METHODS.SKILLS_ENABLE, { id });
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: true } : s)));
    },
    [client]
  );

  const disable = useCallback(
    async (id: string) => {
      await client.send(METHODS.SKILLS_DISABLE, { id });
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: false } : s)));
    },
    [client]
  );

  return { skills, loading, error, refetch: fetchSkills, enable, disable };
}
