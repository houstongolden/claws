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
  const pendingApprovals = status?.status?.approvals?.pending ?? 0;

  return (
    <section className="mb-16">
      <div className="mb-4 flex items-center justify-between">
        <div
          className="mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          // live-gateway
        </div>
        <StatusBadge live={live} />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Stat
          label="protocol"
          value={String(PROTOCOL_VERSION)}
        />
        <Stat
          label="rpc methods"
          value={Object.keys(METHODS).length.toString()}
        />
        <Stat label="events" value={Object.keys(EVENTS).length.toString()} />
      </div>

      {live && status?.status && (
        <>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <Stat
              label="model"
              value={status.status.ai?.model ?? "-"}
              small
            />
            <Stat
              label="provider"
              value={status.status.ai?.provider ?? "-"}
              small
            />
            <Stat
              label="tools"
              value={(status.status.registeredTools?.length ?? 0).toString()}
              small
            />
            <Stat
              label="agents"
              value={(status.status.agents?.length ?? 0).toString()}
              small
            />
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <Stat
              label="workflows"
              value={(status.status.workflows?.count ?? 0).toString()}
              small
            />
            <Stat
              label="pending approvals"
              value={pendingApprovals.toString()}
              small
              accent={pendingApprovals > 0}
            />
            <Stat
              label="traces"
              value={(status.status.traces?.count ?? 0).toString()}
              small
            />
          </div>
        </>
      )}

      {!live && (
        <div
          className="mt-3 rounded-md border p-5"
          style={{
            borderColor: "var(--color-surface-3)",
            background: "var(--color-surface-1)",
          }}
        >
          <div
            className="text-[13px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Gateway not reachable at{" "}
            <code
              className="mono rounded px-1.5 py-0.5 text-[11px]"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-text-muted)",
              }}
            >
              {gatewayUrl || "http://localhost:4317"}
            </code>
            {error && (
              <>
                {" "}
                <span
                  className="mono text-[11px]"
                  style={{ color: "var(--color-text-ghost)" }}
                >
                  ({error})
                </span>
              </>
            )}
          </div>
          <div
            className="mono mt-3 text-[11px]"
            style={{ color: "var(--color-text-ghost)" }}
          >
            $ <span style={{ color: "var(--color-brand)" }}>pnpm gateway</span>
          </div>
        </div>
      )}

      {lastUpdate > 0 && (
        <div
          className="mono mt-3 text-[10px]"
          style={{ color: "var(--color-text-ghost)" }}
        >
          // last update: {new Date(lastUpdate).toLocaleTimeString()} · polling
          every 3s
        </div>
      )}
    </section>
  );
}

function StatusBadge({ live }: { live: boolean }) {
  return (
    <div
      className="mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider"
      style={{
        borderColor: live
          ? "color-mix(in srgb, var(--color-success) 35%, transparent)"
          : "var(--color-surface-3)",
        background: live
          ? "color-mix(in srgb, var(--color-success) 8%, transparent)"
          : "var(--color-surface-1)",
        color: live ? "var(--color-success)" : "var(--color-text-muted)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: live ? "var(--color-success)" : "var(--color-text-muted)",
          animation: live ? "agent-pulse 2s ease-in-out infinite" : undefined,
        }}
      />
      {live ? "online" : "offline"}
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
      className="rounded-md border p-4"
      style={{
        borderColor: accent
          ? "color-mix(in srgb, var(--color-brand) 40%, transparent)"
          : "var(--color-surface-3)",
        background: accent
          ? "color-mix(in srgb, var(--color-brand) 5%, var(--color-surface-1))"
          : "var(--color-surface-1)",
      }}
    >
      <div
        className="mono text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </div>
      <div
        className={`mono mt-1.5 font-semibold ${
          small ? "text-[16px]" : "text-[22px]"
        }`}
        style={{
          color: accent
            ? "var(--color-brand)"
            : "var(--color-text-primary)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
