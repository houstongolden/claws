import { NextRequest, NextResponse } from "next/server";

/**
 * Claws AI Proxy — provides free-tier AI access for new users.
 *
 * The OpenRouter API key is stored as CLAWS_PROXY_OPENROUTER_KEY in Vercel env vars.
 * This proxy:
 *  1. Adds the key server-side (never exposed to the client)
 *  2. Enforces per-IP rate limiting (simple in-memory, resets on redeploy)
 *  3. Forces a free/cheap model for the free tier
 *  4. Forwards to OpenRouter's chat completions API
 */

const FREE_MODEL = "meta-llama/llama-4-maverick";
const MAX_REQUESTS_PER_HOUR = 20;
const MAX_TOKENS = 2048;

// Simple in-memory rate limiter (resets on cold start — good enough for free tier)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(key: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 3600_000 });
    return { ok: true, remaining: MAX_REQUESTS_PER_HOUR - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_HOUR) {
    return { ok: false, remaining: 0 };
  }

  entry.count++;
  return { ok: true, remaining: MAX_REQUESTS_PER_HOUR - entry.count };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CLAWS_PROXY_OPENROUTER_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Proxy not configured. Set CLAWS_PROXY_OPENROUTER_KEY." },
      { status: 503 }
    );
  }

  // Rate limit
  const clientKey = getRateLimitKey(req);
  const limit = checkRateLimit(clientKey);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "Free tier rate limit exceeded. Add your own API key in Settings for unlimited access.",
        retryAfter: 3600,
      },
      {
        status: 429,
        headers: { "Retry-After": "3600" },
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Force free model and cap tokens
  body.model = FREE_MODEL;
  body.max_tokens = Math.min(
    Number(body.max_tokens) || MAX_TOKENS,
    MAX_TOKENS
  );

  // Stream support
  const stream = body.stream === true;

  const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "Claws Free Tier",
      "HTTP-Referer": "https://claws.so",
    },
    body: JSON.stringify(body),
  });

  if (!openRouterRes.ok) {
    const errText = await openRouterRes.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: `Upstream error: ${errText}` },
      { status: openRouterRes.status }
    );
  }

  if (stream && openRouterRes.body) {
    return new Response(openRouterRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  }

  const data = await openRouterRes.json();
  return NextResponse.json(data, {
    headers: { "X-RateLimit-Remaining": String(limit.remaining) },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
