/**
 * WebCrypto challenge/nonce signing for device authentication.
 *
 * Requires HTTPS or localhost (WebCrypto constraint).
 */

const DEVICE_ID_KEY = "claws-device-id";

/** Generate or retrieve a persistent device ID */
export function getDeviceId(): string {
  if (typeof globalThis.localStorage !== "undefined") {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;

    const id = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  }

  // Non-browser: generate ephemeral ID
  return generateDeviceId();
}

function generateDeviceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Sign a challenge nonce with WebCrypto HMAC-SHA256 */
export async function signChallenge(
  nonce: string,
  secretKey?: string
): Promise<string | null> {
  // If no secret key provided, skip signing (server may not require it)
  if (!secretKey) return null;

  if (typeof globalThis.crypto?.subtle === "undefined") {
    console.warn("[claws-sdk] WebCrypto not available — challenge signing disabled");
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(nonce));

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Detect if we're in a secure context (required for WebCrypto) */
export function isSecureContext(): boolean {
  if (typeof globalThis.isSecureContext !== "undefined") {
    return globalThis.isSecureContext;
  }
  if (typeof globalThis.location !== "undefined") {
    return (
      globalThis.location.protocol === "https:" ||
      globalThis.location.hostname === "localhost" ||
      globalThis.location.hostname === "127.0.0.1"
    );
  }
  // Node.js / non-browser: assume secure
  return true;
}
