"use client";

import { useEffect, useState } from "react";
import { PROTOCOL_VERSION, METHODS, EVENTS } from "@claws/sdk";

interface GatewayStatus {
  ok: boolean;
  status?: {
    gateway: string;
    workspaceRoot: string;
    mode: string;
    registeredTools: string[];
    agents: Array<{ id: string; description: string }>;
    ai?: {
      enabled: boolean;
      model?: string;
      provider?: string;
    };
    workflows?: { count: number };
    approvals?: { pending: number };
    traces?: { count: number };
  };
}

export function LivePanel() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>("");

  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL ?? "http://localhost:4317";
    setGatewayUrl(url);

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${url}/api/status`, {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GatewayStatus;
        if (!cancelled) {
          setStatus(data);
          setLastUpdate(Date.now());
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "unknown");
          setStatus(null);
        }
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const live = status?.ok === true;

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Live Gateway</h2>
        <StatusBadge live={live} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Protocol version" value={String(PROTOCOL_VERSION)} />
        <Stat label="SDK RPC methods" value={Object.keys(METHODS).length.toString()} />
        <Stat label="SDK events" value={Object.keys(EVENTS).length.toString()} />
      </div>

      {live && status?.status && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Stat
              label="Model"
              value={status.status.ai?.model ?? "unknown"}
              small
            />
            <Stat
              label="Provider"
              value={status.status.ai?.provider ?? "-"}
              small
            />
            <Stat
              label="Tools"
              value={(status.status.registeredTools?.length ?? 0).toString()}
              small
            />
            <Stat
              label="Agents"
              value={(status.status.agents?.length ?? 0).toString()}
              small
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Stat
              label="Workflows"
              value={(status.status.workflows?.count ?? 0).toString()}
              small
            />
            <Stat
              label="Pending approvals"
              value={(status.status.approvals?.pending ?? 0).toString()}
              small
              accent={(status.status.approvals?.pending ?? 0) > 0}
            />
            <Stat
              label="Traces"
              value={(status.status.traces?.count ?? 0).toString()}
              small
            />
          </div>
        </>
      )}

      {!live && (
        <div className="mt-4 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-6">
          <div className="text-sm text-[#a3a3a3]">
            Gateway not reachable at{" "}
            <code className="rounded bg-[#141414] px-1.5 py-0.5 text-[#737373]">
              {gatewayUrl || "http://localhost:4317"}
            </code>
            {error && (
              <>
                {" "}
                <span className="text-[#737373]">({error})</span>
              </>
            )}
          </div>
          <div className="mt-3 text-xs text-[#737373]">
            Start the experimental OS:{" "}
            <code className="rounded bg-[#141414] px-1.5 py-0.5 text-[#ff3344]">
              pnpm gateway
            </code>
          </div>
        </div>
      )}

      {lastUpdate > 0 && (
        <div className="mt-3 text-xs text-[#555]">
          Last update: {new Date(lastUpdate).toLocaleTimeString()} · Polling every 3s
        </div>
      )}
    </section>
  );
}

function StatusBadge({ live }: { live: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
        live
          ? "border-[#30a46c]/30 bg-[#30a46c]/10 text-[#30a46c]"
          : "border-[#1f1f1f] bg-[#0a0a0a] text-[#737373]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          live ? "bg-[#30a46c]" : "bg-[#737373]"
        }`}
        style={
          live
            ? {
                animation: "pulse 2s ease-in-out infinite",
              }
            : undefined
        }
      />
      {live ? "Connected" : "Offline"}
    </div>
  );
}

function Stat({
  label,
  value,
  small = false,
  accent = false,
}: {
  label: string;
  value: string;
  small?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-[#ff3344]/40 bg-[#ff3344]/5"
          : "border-[#1f1f1f] bg-[#141414]"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-[#737373]">
        {label}
      </div>
      <div
        className={`mt-2 font-mono ${small ? "text-lg" : "text-2xl"} ${
          accent ? "text-[#ff3344]" : "text-[#ededed]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
