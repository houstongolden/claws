import { NextResponse } from "next/server";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || "http://localhost:4317";

type TestKeyBody = { provider: string; apiKey: string };

/**
 * POST /api/settings/test-key
 * Validates an API key for a given provider. Does not persist the key.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TestKeyBody;
    const { provider, apiKey } = body;
    if (!provider || typeof apiKey !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing provider or apiKey" },
        { status: 400 }
      );
    }
    const key = apiKey.trim();
    if (!key) {
      return NextResponse.json(
        { ok: false, error: "API key is empty" },
        { status: 400 }
      );
    }

    switch (provider) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models?limit=1", {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) {
          const text = await res.text();
          return NextResponse.json({
            ok: false,
            error: res.status === 401 ? "Invalid API key" : `OpenAI: ${text || res.status}`,
          });
        }
        return NextResponse.json({ ok: true });
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }],
          }),
        });
        if (res.status === 401) {
          return NextResponse.json({ ok: false, error: "Invalid API key" });
        }
        if (!res.ok) {
          const text = await res.text();
          return NextResponse.json({
            ok: false,
            error: `Anthropic: ${text || res.status}`,
          });
        }
        return NextResponse.json({ ok: true });
      }
      case "ai_gateway": {
        const res = await fetch(`${GATEWAY_URL}/api/status`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            error: "Gateway not reachable. Start the Claws gateway (pnpm gateway) and try again.",
          });
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json(
          { ok: false, error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
