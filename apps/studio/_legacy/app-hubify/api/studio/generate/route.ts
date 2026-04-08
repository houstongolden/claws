import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  VIBE_CODER_SYSTEM_PROMPT,
  VIBE_CODER_REFINE_PROMPT,
  parseGenerationResponse,
} from "@/lib/studio/generation-prompts";
import { validateTemplate } from "@/lib/studio/file-validator";

// Model priority: try cheap fast models first, fall back to stronger ones
const MODELS = [
  "anthropic/claude-haiku-4-5-20251001",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "google/gemini-2.5-flash",
];

const DAILY_FREE_LIMIT = 20;

// In-memory rate limit store (resets on deploy — fine for MVP)
const dailyUsage = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = dailyUsage.get(userId);

  if (!entry || now > entry.resetAt) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    dailyUsage.set(userId, { count: 1, resetAt: tomorrow.getTime() });
    return { allowed: true, remaining: DAILY_FREE_LIMIT - 1 };
  }

  if (entry.count >= DAILY_FREE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DAILY_FREE_LIMIT - entry.count };
}

function getApiConfig(): { apiKey: string; baseUrl: string } | null {
  // Priority: OpenRouter (has all models) > Anthropic > OpenAI
  if (process.env.OPENROUTER_API_KEY) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1", // Still use OpenRouter format for consistency
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { prompt, currentFiles, mode = "generate" } = body as {
    prompt: string;
    currentFiles?: { path: string; content: string }[];
    mode?: "generate" | "refine";
  };

  if (!prompt || prompt.trim().length < 3) {
    return NextResponse.json(
      { error: "Prompt must be at least 3 characters" },
      { status: 400 }
    );
  }

  if (prompt.length > 2000) {
    return NextResponse.json(
      { error: "Prompt must be under 2000 characters" },
      { status: 400 }
    );
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Daily free limit reached (20/day)", remaining: 0 },
      { status: 429 }
    );
  }

  const config = getApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "AI service not configured. Set OPENROUTER_API_KEY in environment." },
      { status: 503 }
    );
  }

  const systemPrompt =
    mode === "refine" ? VIBE_CODER_REFINE_PROMPT : VIBE_CODER_SYSTEM_PROMPT;

  const userMessage =
    mode === "refine" && currentFiles
      ? `Current template files:\n${JSON.stringify(currentFiles, null, 2)}\n\nUser request: ${prompt}`
      : prompt;

  // Try models in order until one succeeds
  for (const model of MODELS) {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": "https://hubify.com",
          "X-Title": "Hubify Claws Studio",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[studio/generate] ${model} failed:`, response.status, errorText);
        // Try next model
        continue;
      }

      // Stream OpenAI-format SSE response
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          let fullText = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                  // Generation complete — parse result
                  const files = parseGenerationResponse(fullText);
                  if (files) {
                    const validation = validateTemplate(files);
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "complete",
                          files,
                          valid: validation.valid,
                          validationError: validation.error,
                          remaining: rateLimit.remaining,
                          model,
                        })}\n\n`
                      )
                    );
                  } else {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "error",
                          error: "AI output was incomplete. Try again.",
                          remaining: rateLimit.remaining,
                        })}\n\n`
                      )
                    );
                  }
                  continue;
                }

                try {
                  const event = JSON.parse(data);
                  const delta = event.choices?.[0]?.delta?.content;
                  if (delta) {
                    fullText += delta;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`
                      )
                    );
                  }
                } catch {
                  // Skip malformed lines
                }
              }
            }

            // If stream ended without [DONE], parse what we have
            if (fullText && !fullText.includes('"files"')) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    error: "AI output was incomplete. Try again.",
                    remaining: rateLimit.remaining,
                  })}\n\n`
                )
              );
            } else if (fullText) {
              const files = parseGenerationResponse(fullText);
              if (files) {
                const validation = validateTemplate(files);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      files,
                      valid: validation.valid,
                      validationError: validation.error,
                      remaining: rateLimit.remaining,
                      model,
                    })}\n\n`
                  )
                );
              }
            }
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: "Stream interrupted" })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      console.error(`[studio/generate] ${model} error:`, err);
      continue; // Try next model
    }
  }

  // All models failed
  return NextResponse.json(
    { error: "All AI models are currently unavailable. Try again later." },
    { status: 502 }
  );
}
