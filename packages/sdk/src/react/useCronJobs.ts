import { useState, useEffect, useCallback } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS, EVENTS } from "../core/protocol";
import type { CronJob, CronRunEvent } from "../core/types";

export function useCronJobs() {
  const { client } = useGatewayContext();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.send<CronJob[]>(METHODS.CRON_LIST, {});
      setJobs(result ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Subscribe to cron run events
  useEffect(() => {
    const unsub1 = client.subscribe(EVENTS.CRON_RUN_START, (payload) => {
      const event = payload as CronRunEvent;
      setJobs((prev) =>
        prev.map((j) => (j.id === event.cronId ? { ...j, lastRun: new Date(event.timestamp).toISOString() } : j))
      );
    });

    const unsub2 = client.subscribe(EVENTS.CRON_RUN_END, () => {
      // Refresh to get updated nextRun
      fetchJobs();
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [client, fetchJobs]);

  const create = useCallback(
    async (params: { name: string; schedule: string; command?: string; enabled?: boolean }) => {
      const result = await client.send<CronJob>(METHODS.CRON_CREATE, params);
      await fetchJobs();
      return result;
    },
    [client, fetchJobs]
  );

  const update = useCallback(
    async (params: { id: string; name?: string; schedule?: string; command?: string; enabled?: boolean }) => {
      await client.send(METHODS.CRON_UPDATE, params);
      await fetchJobs();
    },
    [client, fetchJobs]
  );

  const remove = useCallback(
    async (id: string) => {
      await client.send(METHODS.CRON_DELETE, { id });
      setJobs((prev) => prev.filter((j) => j.id !== id));
    },
    [client]
  );

  return { jobs, loading, error, refetch: fetchJobs, create, update, remove };
}
