/**
 * Client-side API keys storage for Integrations UI.
 * Keys are stored in localStorage. For the gateway to use them, add to .env.local and restart.
 */

export const API_KEYS_STORAGE_KEY = "claws-api-keys";

export type IntegrationId = "openai" | "anthropic" | "ai_gateway";

export type ApiKeysStore = Partial<Record<IntegrationId, string>>;

export function getApiKeys(): ApiKeysStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ApiKeysStore;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function setApiKey(provider: IntegrationId, value: string): void {
  const next = { ...getApiKeys(), [provider]: value };
  if (!value.trim()) delete next[provider];
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export const INTEGRATIONS: Array<{
  id: IntegrationId;
  name: string;
  envKey: string;
  domain: string;
  description: string;
}> = [
  {
    id: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    domain: "openai.com",
    description: "GPT-4, GPT-4o, and other models. Used when AI_GATEWAY_API_KEY is not set.",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    domain: "anthropic.com",
    description: "Claude models. Fallback when OpenAI is not configured.",
  },
  {
    id: "ai_gateway",
    name: "Vercel AI Gateway",
    envKey: "AI_GATEWAY_API_KEY",
    domain: "vercel.com",
    description: "Primary key for Vercel AI Gateway (routes all models through one key).",
  },
];

/** Google Favicon API URL for a domain */
export function getFaviconUrl(domain: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
