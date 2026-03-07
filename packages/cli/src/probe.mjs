/**
 * Shared network and runtime probe helpers for doctor/status.
 */

import { createConnection } from "node:net";

/**
 * Check if a TCP port is in use.
 */
export function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
  });
}

/**
 * Fetch JSON from a gateway endpoint. Returns { ok, data } or { ok: false, error }.
 */
export async function fetchGateway(baseUrl, path, timeoutMs = 4000) {
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || "unreachable" };
  }
}

/**
 * Resolve the gateway URL from config + env.
 */
export function resolveGatewayUrl(config) {
  return (
    process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL ||
    process.env.CLAWS_GATEWAY_URL ||
    `http://localhost:${config?.gateway?.port || 4317}`
  );
}

/**
 * Resolve the dashboard URL from config.
 */
export function resolveDashboardUrl(config) {
  return `http://localhost:${config?.dashboard?.port || 4318}`;
}
