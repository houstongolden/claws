import { generateText, streamText, tool, stepCountIs, jsonSchema, type ToolSet } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { ToolRegistry } from "@claws/tools/index";

/** Read-only tools for Plan mode (no fs.write / sandbox / task mutations). */
export const PLAN_MODE_TOOL_NAMES = new Set([
  "fs.read",
  "fs.list",
  "memory.search",
  "memory.getEntry",
  "research.fetchUrl",
  "research.webSearch",
  "browser.extract",
  "browser.screenshot",
  "browser.navigate",
  "status.get",
]);

export function defaultMaxSteps(): number {
  const n = Number(process.env.CLAWS_AGENT_MAX_STEPS);
  if (Number.isFinite(n) && n >= 1 && n <= 128) return Math.floor(n);
  return 32;
}

export type AIHandlerOptions = {
  registry: ToolRegistry;
  guardedRunTool: (input: {
    name: string;
    args: Record<string, unknown>;
  }) => Promise<unknown>;
  identityContext?: Record<string, string>;
  systemPrompt?: string;
  /** Max model steps (tool rounds). Default CLAWS_AGENT_MAX_STEPS or 32. */
  maxSteps?: number;
  /** If set, only these tool names are registered (e.g. Plan mode). */
  allowedToolNames?: Set<string>;
  /** When true, no tools — conversation only. */
  disableTools?: boolean;
  /** Group chat: agent responding as */
  leadAgentId?: string;
  /** Group chat: other participants (for system prompt and delegation) */
  participantAgentIds?: string[];
  /** Group chat: agents @mentioned in the user message */
  mentionedAgentIds?: string[];
  /** Group chat: when lead delegates to another agent, run a sub-turn and return reply */
  delegateToAgent?: (
    agentId: string,
    message: string,
    history?: ChatHistoryTurn[]
  ) => Promise<{ summary: string }>;
};

export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_SYSTEM_PROMPT = `You are Claws — a local-first agent OS that rivals Lovable/v0 for **vibe coding** and Manus/Perplexity-style **research & computer use**.

## Vibe coding (UI / landing pages / apps)
- **Acknowledge instantly**: Start EVERY reply with 1–2 sentences that restate what the user asked in a clear, confident way. Example: "I'll create a stunning single-file HTML landing page about Claws with hero + features, bold typography, and dark theme."
- **Then plan, then execute**: Right after the acknowledgment, output a brief 2–4 bullet plan of steps you'll take. Only after stating your plan, call tools. Example: "I'll: 1) Create the HTML structure 2) Add typography and dark theme 3) Write to projects/claws-demos/claws-landing.html".
- **Always ship a working artifact**: use fs.write with a single self-contained HTML file (path like \`projects/claws-demos/<name>.html\` or \`assets/previews/<name>.html\`). Create parent dirs implicitly via path.
- **Quality bar**: distinctive typography (Google Fonts link), strong layout, CSS variables, one bold aesthetic (not generic purple gradients). Full page: <!DOCTYPE html>, viewport meta, responsive.
- **Preview**: the dashboard opens HTML in a live iframe — avoid broken external APIs; CDN scripts (e.g. tailwind via cdn) are OK. Prefer inline CSS for reliability.
- After fs.write, reply briefly: what you built + path. Do **not** paste the whole file in chat.

## Research & agentic tasks (non-coding)
- Start with a brief acknowledgment of what the user asked, then proceed.
- Use **research.webSearch** when the user wants current facts, comparisons, or “what is X” (requires Tavily key on server — if unavailable, say so and use fetchUrl on URLs they provide).
- Use **research.fetchUrl** to read public docs, articles, or spec pages (SSRF-safe; no localhost). Summarize with **linked sources** ([title](url)).
- Use **browser.extract** when a page is JS-heavy and fetch returns little text; **browser.screenshot** to capture evidence.
- Use **memory.flush** to persist durable findings; **tasks.createTask** for follow-ups.
- Answer in clear Markdown: headings, bullets, **citations** for every non-obvious claim from the web.

## General
- Call tools directly (no XML pseudo-calls). For coding tasks: acknowledge the request, then state your plan (as text), then execute.
- When demoPath is returned from browser tools, mention it so the user can open the screenshot.

Format: Markdown, **bold**, \`code\`, short lists. Be concise after tool runs.`;

function buildSystemPrompt(options: AIHandlerOptions): string {
  const parts = [options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT];

  if (options.leadAgentId) {
    parts.push(
      `\nYou are responding as the agent: ${options.leadAgentId}.`
    );
  }
  if (options.participantAgentIds?.length) {
    const others = options.participantAgentIds.filter((id) => id !== options.leadAgentId);
    if (others.length) {
      parts.push(
        `\nOther participants in this chat: ${others.join(", ")}. You can delegate to them using the delegate_to_agent tool.`
      );
    }
  }
  if (options.mentionedAgentIds?.length) {
    parts.push(
      `\nThe user mentioned: ${options.mentionedAgentIds.join(", ")}.`
    );
  }

  if (options.identityContext) {
    for (const [file, content] of Object.entries(options.identityContext)) {
      if (content.trim()) {
        parts.push(`\n--- ${file} ---\n${content}`);
      }
    }
  }

  return parts.join("\n");
}

/** Default Claws proxy URL for free-tier AI access (no user API key needed). */
const CLAWS_PROXY_DEFAULT_URL = "https://claws.so/api/proxy";

export function isAIEnabled(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAWS_PROXY_URL ||
      true // free tier proxy is always available as last resort
  );
}

type ResolvedAIProvider = {
  provider: "gateway" | "openrouter" | "openai" | "anthropic";
  model: (modelId: string) => LanguageModelV3;
};

const NO_PROVIDER_CONFIG_ERROR = [
  "No AI provider configured.",
  "Set one of:",
  "OPENROUTER_API_KEY (recommended)",
  "AI_GATEWAY_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
].join("\n");

let loggedProvider: ResolvedAIProvider["provider"] | undefined;

/** Default when AI_MODEL unset — OpenRouter id (works with OpenRouter-first routing). */
export const DEFAULT_AI_MODEL = "openai/gpt-5.4";

export function getConfiguredAIProvider():
  | ResolvedAIProvider["provider"]
  | null {
  if (process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    return "gateway";
  }
  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }
  // Free tier proxy is always available — maps to openrouter provider type
  return "openrouter";
}

/** OpenRouter model ids use provider/model; map bare OpenAI-style ids */
function toOpenRouterModelId(modelId: string): string {
  if (modelId.includes("/")) {
    return modelId;
  }
  if (
    modelId.startsWith("gpt-") ||
    modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4")
  ) {
    return `openai/${modelId}`;
  }
  if (modelId.startsWith("claude")) {
    return `anthropic/${modelId}`;
  }
  return modelId;
}

function logActiveProvider(provider: ResolvedAIProvider["provider"]): void {
  if (loggedProvider === provider) {
    return;
  }

  loggedProvider = provider;
  if (provider === "gateway") {
    console.log("AI provider: Vercel AI Gateway");
    return;
  }
  if (provider === "openrouter") {
    console.log("AI provider: OpenRouter");
    return;
  }
  if (provider === "openai") {
    console.log("AI provider: OpenAI direct");
    return;
  }

  console.log("AI provider: Anthropic direct");
}

/** Vercel AI Gateway base for @ai-sdk/gateway v3 (do not use legacy /v1). */
export const AI_GATEWAY_DEFAULT_BASE = "https://ai-gateway.vercel.sh/v3/ai";

/**
 * Provider priority (first match wins):
 * 1) OPENROUTER_API_KEY — OpenRouter (default when set; use AI_MODEL=openai/gpt-5.4 etc.)
 * 2) AI_GATEWAY_API_KEY — Vercel AI Gateway (@ai-sdk v3/ai)
 * 3) OPENAI_API_KEY — direct OpenAI
 * 4) ANTHROPIC_API_KEY — direct Anthropic
 *
 * Set only OPENROUTER_API_KEY (+ AI_MODEL) to avoid Gateway "model not found" for openai:gpt-*.
 * Chat falls back to OpenAI direct on failures when OPENAI_API_KEY is set.
 */
export function resolveModelProvider(): ResolvedAIProvider {
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        ...(process.env.OPENROUTER_HTTP_REFERER
          ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
          : {}),
        ...(process.env.OPENROUTER_APP_TITLE
          ? { "X-Title": process.env.OPENROUTER_APP_TITLE }
          : { "X-Title": "Claws" }),
      },
    });
    return {
      provider: "openrouter",
      model: (modelId: string) => openrouter(toOpenRouterModelId(modelId)),
    };
  }

  if (process.env.AI_GATEWAY_API_KEY) {
    let gatewayUrl = process.env.AI_GATEWAY_URL?.trim();
    if (gatewayUrl && /ai-gateway\.vercel\.sh\/v1\/?$/i.test(gatewayUrl.replace(/\/+$/, ""))) {
      console.warn(
        "[claws] AI_GATEWAY_URL points at legacy /v1 — that breaks the current AI SDK. Using default v3 base. Remove AI_GATEWAY_URL or set it to https://ai-gateway.vercel.sh/v3/ai"
      );
      gatewayUrl = undefined;
    }
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: gatewayUrl || AI_GATEWAY_DEFAULT_BASE,
    });

    return {
      provider: "gateway",
      model: (modelId: string) =>
        gateway(
          modelId.includes(":")
            ? modelId
            : modelId.includes("/")
              ? `${modelId.split("/")[0]}:${modelId.split("/").slice(1).join("/")}`
              : `openai:${modelId}`
        ),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return {
      provider: "openai",
      model: (modelId: string) => openai(modelId),
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    return {
      provider: "anthropic",
      model: (modelId: string) => {
        const id = modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")
          ? "claude-sonnet-4-20250514"
          : modelId;
        return anthropic(id);
      },
    };
  }

  // Last resort: Claws free-tier proxy (rate-limited, free model)
  const proxyUrl = process.env.CLAWS_PROXY_URL?.trim() || CLAWS_PROXY_DEFAULT_URL;
  const proxyProvider = createOpenAI({
    apiKey: "claws-free-tier",
    baseURL: proxyUrl,
  });
  return {
    provider: "openrouter" as const,
    model: (modelId: string) => proxyProvider("free-tier"),
  };
}

export function validateAIProviderConfiguration(): void {
  try {
    const p = getConfiguredAIProvider();
    resolveModelProvider();
    const fallback = Boolean(process.env.OPENAI_API_KEY?.trim());
    const gwUrl = process.env.AI_GATEWAY_URL?.trim();
    if (p === "gateway") {
      const base =
        gwUrl && !/ai-gateway\.vercel\.sh\/v1\/?$/i.test(gwUrl.replace(/\/+$/, ""))
          ? gwUrl
          : AI_GATEWAY_DEFAULT_BASE;
      console.log(
        `[claws] AI: Vercel Gateway (${base}) · OpenAI fallback: ${fallback ? "on" : "off (set OPENAI_API_KEY)"} · model ${process.env.AI_MODEL || DEFAULT_AI_MODEL}`
      );
      if (gwUrl && /\/v1\b/i.test(gwUrl) && gwUrl.includes("ai-gateway.vercel")) {
        console.warn("[claws] AI_GATEWAY_URL uses legacy /v1 — overridden to v3/ai. Remove /v1 from .env.local to avoid confusion.");
      }
    } else if (p === "openrouter") {
      console.log(
        `[claws] AI: OpenRouter · OpenAI fallback: ${fallback ? "on" : "off"} · model ${process.env.AI_MODEL || DEFAULT_AI_MODEL}`
      );
    } else if (p === "openai") {
      console.log(`[claws] AI: OpenAI direct · model ${process.env.AI_MODEL || DEFAULT_AI_MODEL}`);
    } else if (p === "anthropic") {
      console.log(`[claws] AI: Anthropic direct · model ${process.env.AI_MODEL || DEFAULT_AI_MODEL}`);
    }
    // Check if using proxy (no direct API keys set)
    if (!process.env.OPENROUTER_API_KEY && !process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      const proxyUrl = process.env.CLAWS_PROXY_URL?.trim() || CLAWS_PROXY_DEFAULT_URL;
      console.log(`[claws] AI: Claws free tier (${proxyUrl}) · rate-limited · add your own API key for full access`);
    }
  } catch {
    console.warn("⚠️  No AI provider configured. Chat will not work until you set at least one API key in .env.local and restart.");
  }
}

export function createAIModel(): LanguageModelV3 {
  const provider = resolveModelProvider();
  logActiveProvider(provider.provider);

  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  return provider.model(modelId);
}

/** Direct OpenAI model for fallback when gateway/OpenRouter fails. */
export function createOpenAIDirectModel(): LanguageModelV3 | null {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let modelId = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  if (modelId.startsWith("openai/")) modelId = modelId.slice("openai/".length);
  return openai(modelId);
}

function isRetryableError(errMsg: string): boolean {
  const m = errMsg.toLowerCase();
  return (
    m.includes("gateway") ||
    m.includes("not found") ||
    m.includes("provider returned") ||
    m.includes("invalid error response") ||
    m.includes("request failed") ||
    m.includes("authentication") ||
    m.includes("401") ||
    m.includes("403") ||
    m.includes("429") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("network") ||
    m.includes("limit exceeded") ||
    m.includes("rate limit") ||
    m.includes("quota") ||
    m.includes("billing") ||
    m.includes("insufficient") ||
    m.includes("exceeded")
  );
}

function shouldFallbackToOpenAI(primary: ResolvedAIProvider["provider"], errMsg: string): boolean {
  if (primary !== "gateway" && primary !== "openrouter") return false;
  if (!process.env.OPENAI_API_KEY?.trim()) return false;
  return isRetryableError(errMsg);
}

/**
 * Build an ordered list of fallback models from all configured providers,
 * excluding the primary provider that already failed.
 */
function buildFallbackChain(excludeProvider: ResolvedAIProvider["provider"]): LanguageModelV3[] {
  const chain: LanguageModelV3[] = [];
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;

  // OpenAI direct
  if (excludeProvider !== "openai" && process.env.OPENAI_API_KEY?.trim()) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let id = modelId;
    if (id.startsWith("openai/")) id = id.slice("openai/".length);
    // If model is anthropic-style, use a sensible OpenAI default
    if (id.startsWith("claude") || id.startsWith("anthropic/")) id = "gpt-4o";
    chain.push(openai(id));
  }

  // Anthropic direct
  if (excludeProvider !== "anthropic" && process.env.ANTHROPIC_API_KEY?.trim()) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let id = modelId;
    if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("openai/")) {
      id = "claude-sonnet-4-20250514";
    }
    if (id.includes("/")) id = id.split("/").pop()!;
    chain.push(anthropic(id));
  }

  // Vercel AI Gateway
  if (excludeProvider !== "gateway" && process.env.AI_GATEWAY_API_KEY?.trim()) {
    let gatewayUrl = process.env.AI_GATEWAY_URL?.trim();
    if (gatewayUrl && /ai-gateway\.vercel\.sh\/v1\/?$/i.test(gatewayUrl.replace(/\/+$/, ""))) {
      gatewayUrl = undefined;
    }
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY!,
      baseURL: gatewayUrl || AI_GATEWAY_DEFAULT_BASE,
    });
    let id = modelId;
    if (!id.includes(":")) {
      id = id.includes("/")
        ? `${id.split("/")[0]}:${id.split("/").slice(1).join("/")}`
        : `openai:${id}`;
    }
    chain.push(gateway(id));
  }

  return chain;
}

/**
 * Explicit JSON Schema for every tool — OpenRouter / some providers reject Zod→JSON
 * conversion that yields invalid types (e.g. fs_read schema type None).
 */
const EMPTY_OBJECT_SCHEMA = { type: "object" as const, properties: {} as Record<string, unknown> };
const TOOL_JSON_SCHEMAS: Record<string, Record<string, unknown>> = {
  "fs.read": {
    type: "object",
    properties: { path: { type: "string", description: "File path to read" } },
    required: ["path"],
  },
  "fs.write": {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write" },
      content: { type: "string", description: "Content to write" },
    },
    required: ["path", "content"],
  },
  "fs.append": {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to append to" },
      content: { type: "string", description: "Content to append" },
    },
    required: ["path", "content"],
  },
  "fs.list": {
    type: "object",
    properties: { path: { type: "string", description: "Directory path to list" } },
  },
  "memory.search": {
    type: "object",
    properties: { query: { type: "string", description: "Search query" } },
    required: ["query"],
  },
  "memory.flush": {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to save to memory" },
      source: { type: "string", description: "Source label" },
    },
    required: ["text"],
  },
  "memory.promote": {
    type: "object",
    properties: { entryId: { type: "string", description: "Memory entry ID" } },
    required: ["entryId"],
  },
  "memory.getEntry": {
    type: "object",
    properties: { entryId: { type: "string", description: "Memory entry ID to retrieve" } },
    required: ["entryId"],
  },
  "browser.navigate": {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to navigate to" },
      mode: {
        type: "string",
        enum: ["background", "record-on-complete", "watch-live", "hybrid"],
        description: "Visibility mode",
      },
    },
    required: ["url"],
  },
  "browser.screenshot": {
    type: "object",
    properties: { url: { type: "string", description: "URL to screenshot" } },
    required: ["url"],
  },
  "browser.click": {
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS selector to click" },
      url: { type: "string", description: "URL context" },
    },
    required: ["selector"],
  },
  "browser.type": {
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS selector to type into" },
      text: { type: "string", description: "Text to type" },
      url: { type: "string", description: "URL context" },
    },
    required: ["selector", "text"],
  },
  "browser.extract": {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to extract content from" },
      selector: { type: "string", description: "CSS selector" },
    },
    required: ["url"],
  },
  "sandbox.exec": {
    type: "object",
    properties: {
      code: { type: "string", description: "Code to execute" },
      language: { type: "string", description: "Language runtime" },
    },
  },
  "status.get": EMPTY_OBJECT_SCHEMA,
  "tasks.appendEvent": {
    type: "object",
    properties: {
      event: { type: "object", description: "Task event payload", additionalProperties: true },
    },
    required: ["event"],
  },
  "tasks.createTask": {
    type: "object",
    properties: {
      task: { type: "string", description: "Task title" },
      section: { type: "string" },
      priority: { type: "string" },
      owner: { type: "string" },
    },
    required: ["task"],
  },
  "tasks.updateTask": {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
      patch: { type: "object", description: "Fields to update", additionalProperties: { type: "string" } },
    },
    required: ["taskId", "patch"],
  },
  "tasks.moveTask": {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
      status: { type: "string" },
      targetSection: { type: "string" },
    },
    required: ["taskId"],
  },
  "tasks.completeTask": {
    type: "object",
    properties: { taskId: { type: "string", description: "Task ID to complete" } },
    required: ["taskId"],
  },
  "demo.saveScreenshot": {
    type: "object",
    properties: {
      screenshot: { type: "string", description: "Base64-encoded PNG" },
      taskUrl: { type: "string" },
      agentId: { type: "string" },
    },
    required: ["screenshot"],
  },
  "demo.saveMetadata": {
    type: "object",
    properties: {
      metadata: { type: "object", description: "Demo metadata", additionalProperties: true },
      taskUrl: { type: "string" },
      agentId: { type: "string" },
    },
    required: ["metadata"],
  },
  "research.fetchUrl": {
    type: "object",
    properties: { url: { type: "string", description: "Public https URL to fetch" } },
    required: ["url"],
  },
  "research.webSearch": {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      maxResults: { type: "number", description: "Max results 3–8" },
    },
    required: ["query"],
  },
};

/** Anthropic requires tool names matching ^[a-zA-Z0-9_-]+$ — no dots */
function sanitizeToolName(name: string): string {
  return name.replace(/\./g, "_");
}

function buildAITools(
  registry: ToolRegistry,
  guardedRunTool: AIHandlerOptions["guardedRunTool"],
  toolResults: Array<{
    toolName: string;
    ok: boolean;
    error?: string;
    data?: unknown;
  }>,
  options: Pick<
    AIHandlerOptions,
    "delegateToAgent" | "participantAgentIds" | "leadAgentId" | "allowedToolNames" | "disableTools"
  > = {}
): ToolSet {
  const tools: ToolSet = {};
  if (options.disableTools) {
    return tools;
  }

  for (const name of registry.listNames()) {
    if (options.allowedToolNames && !options.allowedToolNames.has(name)) {
      continue;
    }
    const spec = registry.get(name);
    if (!spec) continue;

    const paramSchema = TOOL_JSON_SCHEMAS[name] ?? EMPTY_OBJECT_SCHEMA;
    const safeName = sanitizeToolName(name);

    tools[safeName] = tool({
      description: spec.description || name,
      /* AI SDK v6 uses inputSchema; `parameters` is ignored → OpenRouter saw type None */
      inputSchema: jsonSchema(paramSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (args: Record<string, unknown>) => {
        try {
          const result = await guardedRunTool({ name, args });
          toolResults.push({
            toolName: name,
            ok: true,
            data: result,
          });
          return result;
        } catch (error) {
          toolResults.push({
            toolName: name,
            ok: false,
            error: error instanceof Error ? error.message : "Tool execution failed",
          });
          throw error;
        }
      },
    } as unknown as Parameters<typeof tool>[0]) as unknown as ToolSet[string];
  }

  if (options.delegateToAgent && !options.allowedToolNames) {
    const delegateToAgent = options.delegateToAgent;
    const allowedIds = options.participantAgentIds?.length
      ? options.participantAgentIds
      : ["orchestrator", "founder", "developer"];
    tools.delegate_to_agent = tool({
      description:
        "Delegate a question or task to another agent in this chat. Use when the user @mentioned someone or when another participant is better suited. Returns that agent's reply.",
      inputSchema: jsonSchema({
        type: "object",
        properties: {
          agentId: { type: "string", description: "Agent id to delegate to (e.g. developer, founder)" },
          message: { type: "string", description: "Message or task to send to that agent" },
        },
        required: ["agentId", "message"],
      } as Parameters<typeof jsonSchema>[0]),
      execute: async (args: Record<string, unknown>) => {
        const agentId = String(args.agentId ?? "").trim();
        const message = String(args.message ?? "").trim();
        if (!agentId || !message) {
          return { ok: false, error: "agentId and message are required" };
        }
        if (!allowedIds.includes(agentId)) {
          return { ok: false, error: `Unknown or not-participant agent: ${agentId}. Allowed: ${allowedIds.join(", ")}` };
        }
        try {
          const result = await delegateToAgent(agentId, message);
          toolResults.push({ toolName: "delegate_to_agent", ok: true, data: result });
          return result;
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          toolResults.push({ toolName: "delegate_to_agent", ok: false, error });
          return { ok: false, error };
        }
      },
    } as unknown as Parameters<typeof tool>[0]) as unknown as ToolSet[string];
  }

  return tools;
}

function renderConversationPrompt(message: string, history?: ChatHistoryTurn[]): string {
  const priorTurns = (history ?? [])
    .filter((turn) => turn.content.trim())
    .slice(-12)
    .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content.trim()}`)
    .join("\n\n");

  return priorTurns
    ? `${priorTurns}\n\nUser: ${message}\nAssistant:`
    : message;
}

export async function handleAIChat(
  input: {
    message: string;
    history?: ChatHistoryTurn[];
  },
  options: AIHandlerOptions
): Promise<{
  ok: boolean;
  agentId: string;
  summary: string;
  messages: string[];
  toolResults: Array<{
    toolName: string;
    ok: boolean;
    error?: string;
    data?: unknown;
  }>;
}> {
  const model = createAIModel();
  const system = buildSystemPrompt(options);
  const toolResults: Array<{
    toolName: string;
    ok: boolean;
    error?: string;
    data?: unknown;
  }> = [];
  const steps = options.maxSteps ?? defaultMaxSteps();
  const aiTools = buildAITools(options.registry, options.guardedRunTool, toolResults, {
    delegateToAgent: options.delegateToAgent,
    participantAgentIds: options.participantAgentIds,
    leadAgentId: options.leadAgentId,
    allowedToolNames: options.allowedToolNames,
    disableTools: options.disableTools,
  });

  const prompt = renderConversationPrompt(input.message, input.history);
  const primary = getConfiguredAIProvider();
  const runGenerate = async (m: LanguageModelV3) =>
    Object.keys(aiTools).length === 0
      ? generateText({ model: m, system, prompt })
      : generateText({
          model: m,
          system,
          prompt,
          tools: aiTools,
          stopWhen: stepCountIs(steps),
        });

  let result: Awaited<ReturnType<typeof runGenerate>>;
  try {
    result = await runGenerate(model);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (primary && isRetryableError(msg)) {
      const fallbacks = buildFallbackChain(primary);
      let fbResult: typeof result | undefined;
      for (const fb of fallbacks) {
        try {
          console.warn(`[claws] Primary AI (${primary}) failed; trying fallback:`, msg.slice(0, 120));
          fbResult = await runGenerate(fb);
          break;
        } catch (fbErr) {
          console.warn("[claws] Fallback also failed:", fbErr instanceof Error ? fbErr.message.slice(0, 120) : String(fbErr));
        }
      }
      if (!fbResult) throw e;
      result = fbResult;
    } else {
      throw e;
    }
  }

  return {
    ok: true,
    agentId: options.leadAgentId ?? "orchestrator",
    summary: result.text || "Task completed.",
    messages: result.text ? [result.text] : [],
    toolResults,
  };
}

/**
 * Streaming variant: returns a ReadableStream of SSE events.
 * Use with the gateway's /api/chat/stream endpoint.
 */
/**
 * @deprecated Prefer writeStreamToResponse for HTTP — this stream has no structured SSE.
 * Exposed for callers that need a raw text stream with the same tool policy as handleAIChat.
 */
export function handleAIChatStream(
  input: {
    message: string;
    history?: ChatHistoryTurn[];
  },
  options: AIHandlerOptions
): ReadableStream {
  const model = createAIModel();
  const system = buildSystemPrompt(options);
  const steps = options.maxSteps ?? defaultMaxSteps();
  const aiTools = buildAITools(options.registry, options.guardedRunTool, [], {
    delegateToAgent: options.delegateToAgent,
    participantAgentIds: options.participantAgentIds,
    leadAgentId: options.leadAgentId,
    allowedToolNames: options.allowedToolNames,
    disableTools: options.disableTools,
  });
  const prompt = renderConversationPrompt(input.message, input.history);
  const result =
    Object.keys(aiTools).length === 0
      ? streamText({ model, system, prompt })
      : streamText({ model, system, prompt, tools: aiTools, stopWhen: stepCountIs(steps) });
  return result.textStream as unknown as ReadableStream;
}

/**
 * Full streaming response for raw HTTP — writes structured SSE events to a ServerResponse.
 * Emits: thinking, text-delta, tool_call, tool_result, approval_requested, complete, error.
 */
export async function writeStreamToResponse(
  input: {
    message: string;
    history?: ChatHistoryTurn[];
    maxSteps?: number;
  },
  options: AIHandlerOptions & {
    /** When a tool throws an approval-required error, this is called before rethrowing. */
    onApprovalRequested?: (payload: {
      approvalId: string;
      toolName?: string;
      sessionKey?: {
        workspaceId: string;
        agentId: string;
        channel: string;
        chatId: string;
        threadId?: string;
      };
    }) => void;
    /** Called when stream completes successfully with final text and tool results (e.g. to persist session). */
    onComplete?: (
      fullText: string,
      toolResults: Array<{ toolName: string; ok: boolean; error?: string; data?: unknown }>
    ) => void | Promise<void>;
  },
  res: import("node:http").ServerResponse
): Promise<void> {
  const system = buildSystemPrompt(options);
  const toolResults: Array<{ toolName: string; ok: boolean; error?: string; data?: unknown }> = [];

  const guardedRunTool = options.guardedRunTool;
  const wrappedGuardedRunTool = async (input: { name: string; args: Record<string, unknown> }) => {
    try {
      return await guardedRunTool(input);
    } catch (err) {
      const e = err as Error & { approvalId?: string };
      if (e?.name === "ApprovalRequiredError" && typeof e.approvalId === "string") {
        const ex = e as Error & {
          approvalId: string;
          toolName?: string;
          sessionKey?: {
            workspaceId: string;
            agentId: string;
            channel: string;
            chatId: string;
            threadId?: string;
          };
        };
        options.onApprovalRequested?.({
          approvalId: ex.approvalId,
          toolName: ex.toolName,
          sessionKey: ex.sessionKey,
        });
      }
      throw err;
    }
  };

  const steps = input.maxSteps ?? options.maxSteps ?? defaultMaxSteps();
  const aiTools = buildAITools(options.registry, wrappedGuardedRunTool, toolResults, {
    delegateToAgent: options.delegateToAgent,
    participantAgentIds: options.participantAgentIds,
    leadAgentId: options.leadAgentId,
    allowedToolNames: options.allowedToolNames,
    disableTools: options.disableTools,
  });

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
  });

  const writeEvent = (payload: Record<string, unknown>) => {
    if (res.destroyed) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const prompt = renderConversationPrompt(input.message, input.history);
  const primaryProvider = getConfiguredAIProvider();
  const streamOpts = (m: LanguageModelV3) =>
    Object.keys(aiTools).length === 0
      ? streamText({ model: m, system, prompt })
      : streamText({
          model: m,
          system,
          prompt,
          tools: aiTools,
          stopWhen: stepCountIs(steps),
        });

  const primaryModel = createAIModel();
  let result = streamOpts(primaryModel);

  const streamErrorToString = (err: unknown): string => {
    if (err == null) return "Stream error";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  try {
    let fullText = "";
    for await (const part of result.fullStream) {
      if (res.destroyed) break;
      const p = part as Record<string, unknown>;
      const type = p.type as string;

      switch (type) {
        case "start":
        case "stream-start":
        case "start-step":
          writeEvent({ type: "thinking" });
          break;
        case "text-delta": {
          const delta = typeof p.text === "string" ? p.text : typeof p.delta === "string" ? p.delta : "";
          if (delta) {
            fullText += delta;
            writeEvent({ type: "text-delta", text: delta });
          }
          break;
        }
        case "tool-call":
          writeEvent({
            type: "tool_call",
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            args: (p.args as Record<string, unknown>) ?? (p.input as Record<string, unknown>) ?? {},
          });
          break;
        case "tool-result":
          writeEvent({
            type: "tool_result",
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            ok: true,
            result: p.output ?? p.result,
          });
          break;
        case "tool-error":
          writeEvent({
            type: "tool_result",
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            ok: false,
            error: streamErrorToString(p.error),
          });
          break;
        case "finish":
          break;
        case "error": {
          const errMsg =
            typeof p.errorText === "string"
              ? p.errorText
              : streamErrorToString(p.error);
          writeEvent({ type: "error", error: errMsg });
          break;
        }
        default:
          break;
      }
    }

    let finalText = fullText;
    try {
      const finalResult = await result;
      const t = await finalResult.text;
      if (typeof t === "string" && t.length > 0) finalText = t;
    } catch (finalizeErr) {
      const name = finalizeErr instanceof Error ? finalizeErr.name : "";
      const msg = finalizeErr instanceof Error ? finalizeErr.message : String(finalizeErr);
      const noOutput =
        name === "NoOutputGeneratedError" ||
        msg.includes("No output generated") ||
        msg.includes("Check the stream for errors");
      if (noOutput && !res.destroyed) {
        writeEvent({ type: "thinking" });
        const retryResult =
          Object.keys(aiTools).length === 0
            ? await generateText({ model: primaryModel, system, prompt })
            : await generateText({
                model: primaryModel,
                system,
                prompt,
                tools: aiTools,
                stopWhen: stepCountIs(steps),
              });
        finalText = retryResult.text || fullText || "Done.";
      } else if (primaryProvider && isRetryableError(msg) && !res.destroyed) {
        const fallbacks = buildFallbackChain(primaryProvider);
        let recovered = false;
        for (const fb of fallbacks) {
          try {
            writeEvent({ type: "thinking" });
            console.warn(`[claws] Stream finalize failed (${primaryProvider}); trying fallback:`, msg.slice(0, 120));
            const fbResult =
              Object.keys(aiTools).length === 0
                ? await generateText({ model: fb, system, prompt })
                : await generateText({
                    model: fb,
                    system,
                    prompt,
                    tools: aiTools,
                    stopWhen: stepCountIs(steps),
                  });
            finalText = fbResult.text || fullText || "Done.";
            recovered = true;
            break;
          } catch (fbErr) {
            console.warn("[claws] Fallback also failed:", fbErr instanceof Error ? fbErr.message.slice(0, 120) : String(fbErr));
          }
        }
        if (!recovered) throw finalizeErr;
      } else {
        throw finalizeErr;
      }
    }

    if (!res.destroyed) {
      let finishReason: string | undefined;
      try {
        const fr = await result;
        finishReason = await Promise.resolve(
          (fr as unknown as { finishReason?: string | Promise<string> }).finishReason
        );
        if (typeof finishReason !== "string") finishReason = String(finishReason ?? "");
      } catch {
        /* ignore */
      }
      const stepLimited =
        finishReason === "length" ||
        finishReason === "tool-calls" ||
        finishReason === "max-steps";
      if (stepLimited) {
        writeEvent({
          type: "step_limit",
          maxSteps: steps,
          finishReason,
          hint: "Reply Continue to run more steps with the same context.",
        });
      }
      await options.onComplete?.(finalText || "Done.", toolResults);
      writeEvent({
        type: "complete",
        text: finalText || "Done.",
        toolResults,
        finishReason,
        stepLimited,
        maxSteps: steps,
      });
    }
  } catch (error) {
    console.error("[claws] Chat stream error:", error);
    let msg = error instanceof Error ? error.message : "Stream error";
    const errObj = error as Error & { cause?: unknown; data?: unknown; responseBody?: string };
    if (msg === "Provider returned error" || msg.toLowerCase().includes("provider")) {
      const cause =
        errObj.cause instanceof Error
          ? errObj.cause.message
          : typeof errObj.cause === "string"
            ? errObj.cause
            : "";
      const data = typeof errObj.data === "object" && errObj.data !== null
        ? JSON.stringify(errObj.data).slice(0, 400)
        : "";
      const extra = [cause, data].filter(Boolean).join(" · ");
      if (extra) msg = `${msg}${extra ? ` — ${extra}` : ""}`;
      else
        msg = `${msg} — Check OPENROUTER_API_KEY, AI_MODEL (e.g. openai/gpt-5.4), and https://openrouter.ai/status. Or set OPENAI_API_KEY for fallback.`;
    }
    if (msg.includes("Failed after") && msg.includes("attempts")) {
      msg = `${msg} The AI provider may be rate-limited or down. Try again in a moment, or check Settings → AI keys and use a different model (e.g. OPENAI_API_KEY with gpt-4o).`;
    }
    if (
      primaryProvider &&
      isRetryableError(msg) &&
      !res.destroyed
    ) {
      const fallbacks = buildFallbackChain(primaryProvider);
      let recovered = false;
      for (const fb of fallbacks) {
        try {
          writeEvent({ type: "thinking" });
          console.warn(`[claws] Stream error (${primaryProvider}); trying fallback:`, msg.slice(0, 120));
          const fallbackResult =
            Object.keys(aiTools).length === 0
              ? await generateText({ model: fb, system, prompt })
              : await generateText({
                  model: fb,
                  system,
                  prompt,
                  tools: aiTools,
                  stopWhen: stepCountIs(steps),
                });
          await options.onComplete?.(fallbackResult.text || "Done.", toolResults);
          writeEvent({
            type: "complete",
            text: fallbackResult.text || "Done.",
            toolResults,
            fallback: true,
          });
          recovered = true;
          break;
        } catch (fbErr) {
          console.warn("[claws] Fallback also failed:", fbErr instanceof Error ? fbErr.message.slice(0, 120) : String(fbErr));
        }
      }
      if (!recovered) {
        writeEvent({ type: "error", error: msg });
      }
    } else {
      writeEvent({ type: "error", error: msg });
    }
  } finally {
    res.end();
  }
}
