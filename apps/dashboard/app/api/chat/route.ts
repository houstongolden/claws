import { NextResponse } from "next/server";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || "http://localhost:4317";

/**
 * POST /api/chat
 *
 * Proxies chat messages to the Claws gateway.
 * Supports both streaming and non-streaming modes:
 * - With `stream: true` in the body, proxies SSE from `/api/chat/stream`
 * - Otherwise, proxies standard JSON from `/api/chat`
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.messages?.at(-1)?.content ?? body?.message;
    const stream = body?.stream === true;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing message" },
        { status: 400 }
      );
    }

    if (stream) {
      const gatewayRes = await fetch(`${GATEWAY_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!gatewayRes.ok || !gatewayRes.body) {
        const text = await gatewayRes.text();
        return NextResponse.json(
          { ok: false, error: `Gateway error: ${text}` },
          { status: gatewayRes.status }
        );
      }

      return new Response(gatewayRes.body, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          "connection": "keep-alive",
        },
      });
    }

    const gatewayRes = await fetch(`${GATEWAY_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!gatewayRes.ok) {
      const text = await gatewayRes.text();
      return NextResponse.json(
        { ok: false, error: `Gateway error: ${text}` },
        { status: gatewayRes.status }
      );
    }

    const data = await gatewayRes.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
