import { NextResponse } from "next/server";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_CLAWS_GATEWAY_URL || "http://localhost:4317";

type ChatBody = {
  messages?: Array<{ content?: string }>;
  message?: string;
  stream?: boolean;
  chatId?: string;
  threadId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  mode?: "agent" | "plan" | "chat";
  maxSteps?: number;
};

/**
 * POST /api/chat
 *
 * Proxies to Claws gateway. Forwards full body (history, chatId, threadId, mode, maxSteps)
 * so session continuity matches direct gateway calls.
 */
export async function POST(req: Request) {
  try {
    let body: ChatBody;
    try {
      body = (await req.json()) as ChatBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    const message = body?.messages?.at(-1)?.content ?? body?.message;
    const stream = body?.stream === true;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing message" },
        { status: 400 }
      );
    }

    const gatewayPayload = {
      message: message.trim(),
      chatId: body.chatId,
      threadId: body.threadId,
      history: body.history,
      mode: body.mode,
      maxSteps: body.maxSteps,
    };

    if (stream) {
      const gatewayRes = await fetch(`${GATEWAY_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(gatewayPayload),
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
          connection: "keep-alive",
        },
      });
    }

    const gatewayRes = await fetch(`${GATEWAY_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(gatewayPayload),
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
