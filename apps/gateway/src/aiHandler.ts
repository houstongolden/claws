import { generateText, streamText, tool, stepCountIs, jsonSchema, type ToolSet } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { ToolRegistry } from "@claws/tools/index";

export type AIHandlerOptions = {
  registry: ToolRegistry;
  guardedRunTool: (input: {
    name: string;
    args: Record<string, unknown>;
  }) => Promise<unknown>;
  identityContext?: Record<string, string>;
  systemPrompt?: string;
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

const DEFAULT_SYSTEM_PROMPT = `You are Claws, a local-first AI agent OS assistant. You help users manage their workspace, projects, files, memory, and tasks.

You have access to tools for filesystem operations, memory management, browser automation, and more. Use them when the user's request requires action.

Be concise, helpful, and action-oriented. Prefer doing over explaining.`;

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

export function isAIEnabled(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY
  );
}

type ResolvedAIProvider = {
  provider: "gateway" | "openai" | "anthropic";
  model: (modelId: string) => LanguageModelV3;
};

const NO_PROVIDER_CONFIG_ERROR = [
  "No AI provider configured.",
  "Set one of:",
  "AI_GATEWAY_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
].join("\n");

let loggedProvider: ResolvedAIProvider["provider"] | undefined;

export function getConfiguredAIProvider():
  | ResolvedAIProvider["provider"]
  | null {
  if (process.env.AI_GATEWAY_API_KEY) {
    return "gateway";
  }
  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }
  return null;
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

  if (provider === "openai") {
    console.log("AI provider: OpenAI direct");
    return;
  }

  console.log("AI provider: Anthropic direct");
}

export function resolveModelProvider(): ResolvedAIProvider {
  if (process.env.AI_GATEWAY_API_KEY) {
    const gatewayUrl = process.env.AI_GATEWAY_URL;
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      ...(gatewayUrl ? { baseURL: gatewayUrl } : {}),
    });

    return {
      provider: "gateway",
      model: (modelId: string) => gateway(modelId.includes(":") ? modelId : `openai:${modelId}`),
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
      model: (modelId: string) => anthropic(modelId),
    };
  }

  throw new Error(NO_PROVIDER_CONFIG_ERROR);
}

export function validateAIProviderConfiguration(): void {
  resolveModelProvider();
}

export function createAIModel(): LanguageModelV3 {
  const provider = resolveModelProvider();
  logActiveProvider(provider.provider);

  const modelId = process.env.AI_MODEL || "gpt-4o-mini";
  return provider.model(modelId);
}

type JSONSchemaProperty = {
  type: string;
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
};

type JSONSchemaDef = {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
};

const TOOL_JSON_SCHEMAS: Record<string, JSONSchemaDef> = {
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
    properties: {
      path: { type: "string", description: "Directory path to list (optional root-relative path)" },
    },
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
  "browser.navigate": {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to navigate to" },
      mode: {
        type: "string",
        description: "Execution visibility mode",
        enum: ["background", "record-on-complete", "watch-live", "hybrid"],
      },
    },
    required: ["url"],
  },
  "browser.screenshot": {
    type: "object",
    properties: { url: { type: "string", description: "URL to screenshot" } },
    required: ["url"],
  },
  "sandbox.exec": {
    type: "object",
    properties: {
      code: { type: "string", description: "Code to execute" },
      language: { type: "string", description: "Language runtime" },
    },
  },
  "status.get": {
    type: "object",
    properties: {},
  },
  "tasks.appendEvent": {
    type: "object",
    properties: {
      event: { type: "object" as string, description: "Task event payload" },
    },
    required: ["event"],
  },
  "demo.saveScreenshot": {
    type: "object",
    properties: {
      screenshot: { type: "string", description: "Base64-encoded PNG screenshot" },
      taskUrl: { type: "string", description: "URL of the task being demonstrated" },
      agentId: { type: "string", description: "ID of the agent saving the demo" },
    },
    required: ["screenshot"],
  },
  "demo.saveMetadata": {
    type: "object",
    properties: {
      metadata: { type: "object" as string, description: "Arbitrary demo metadata" },
      taskUrl: { type: "string", description: "URL of the task being demonstrated" },
      agentId: { type: "string", description: "ID of the agent saving the demo" },
    },
    required: ["metadata"],
  },
  "browser.click": {
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS selector to click" },
      url: { type: "string", description: "URL of the page (optional context)" },
    },
    required: ["selector"],
  },
  "browser.type": {
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS selector to type into" },
      text: { type: "string", description: "Text to type" },
      url: { type: "string", description: "URL of the page (optional context)" },
    },
    required: ["selector", "text"],
  },
  "browser.extract": {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to extract content from" },
      selector: { type: "string", description: "CSS selector to extract (default: body)" },
    },
    required: ["url"],
  },
};

const DEFAULT_SCHEMA: JSONSchemaDef = {
  type: "object",
  properties: {},
};

function buildAITools(
  registry: ToolRegistry,
  guardedRunTool: AIHandlerOptions["guardedRunTool"],
  toolResults: Array<{
    toolName: string;
    ok: boolean;
    error?: string;
    data?: unknown;
  }>,
  options: Pick<AIHandlerOptions, "delegateToAgent" | "participantAgentIds" | "leadAgentId"> = {}
): ToolSet {
  const tools: ToolSet = {};

  for (const name of registry.listNames()) {
    const spec = registry.get(name);
    if (!spec) continue;

    const schemaDef = TOOL_JSON_SCHEMAS[name] ?? DEFAULT_SCHEMA;

    // AI SDK v6 overloads are strict about generic inference with dynamic
    // jsonSchema(). Runtime behavior is verified correct; the type assertion
    // through unknown is required for dynamically-built tool sets.
    tools[name] = tool({
      description: spec.description || name,
      parameters: jsonSchema(schemaDef as Parameters<typeof jsonSchema>[0]),
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

  if (options.delegateToAgent) {
    const delegateToAgent = options.delegateToAgent;
    const allowedIds = options.participantAgentIds?.length
      ? options.participantAgentIds
      : ["orchestrator", "founder", "developer"];
    tools.delegate_to_agent = tool({
      description:
        "Delegate a question or task to another agent in this chat. Use when the user @mentioned someone or when another participant is better suited. Returns that agent's reply.",
      parameters: jsonSchema({
        type: "object",
        properties: {
          agentId: { type: "string", description: "Agent id to delegate to (e.g. developer, founder)" },
          message: { type: "string", description: "Message or task to send to that agent" },
        },
        required: ["agentId", "message"],
      }),
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
  const aiTools = buildAITools(options.registry, options.guardedRunTool, toolResults, {
    delegateToAgent: options.delegateToAgent,
    participantAgentIds: options.participantAgentIds,
    leadAgentId: options.leadAgentId,
  });

  const result = await generateText({
    model,
    system,
    prompt: renderConversationPrompt(input.message, input.history),
    tools: aiTools,
    stopWhen: stepCountIs(5),
  });

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
export function handleAIChatStream(
  input: {
    message: string;
    history?: ChatHistoryTurn[];
  },
  options: AIHandlerOptions
): ReadableStream {
  const model = createAIModel();
  const system = buildSystemPrompt(options);
  const aiTools = buildAITools(options.registry, options.guardedRunTool, [], {
    delegateToAgent: options.delegateToAgent,
    participantAgentIds: options.participantAgentIds,
    leadAgentId: options.leadAgentId,
  });

  const result = streamText({
    model,
    system,
    prompt: renderConversationPrompt(input.message, input.history),
    tools: aiTools,
    stopWhen: stepCountIs(5),
  });

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
  },
  options: AIHandlerOptions & {
    /** When a tool throws an approval-required error, this is called before rethrowing. */
    onApprovalRequested?: (approvalId: string) => void;
  },
  res: import("node:http").ServerResponse
): Promise<void> {
  const model = createAIModel();
  const system = buildSystemPrompt(options);
  const toolResults: Array<{ toolName: string; ok: boolean; error?: string; data?: unknown }> = [];

  const guardedRunTool = options.guardedRunTool;
  const wrappedGuardedRunTool = async (input: { name: string; args: Record<string, unknown> }) => {
    try {
      return await guardedRunTool(input);
    } catch (err) {
      const e = err as Error & { approvalId?: string };
      if (e?.name === "ApprovalRequiredError" && typeof e.approvalId === "string") {
        options.onApprovalRequested?.(e.approvalId);
      }
      throw err;
    }
  };

  const aiTools = buildAITools(options.registry, wrappedGuardedRunTool, toolResults, {
    delegateToAgent: options.delegateToAgent,
    participantAgentIds: options.participantAgentIds,
    leadAgentId: options.leadAgentId,
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

  const result = streamText({
    model,
    system,
    prompt: renderConversationPrompt(input.message, input.history),
    tools: aiTools,
    stopWhen: stepCountIs(5),
  });

  try {
    let fullText = "";
    for await (const part of result.fullStream) {
      if (res.destroyed) break;
      const p = part as Record<string, unknown>;
      const type = p.type as string;

      switch (type) {
        case "start":
          writeEvent({ type: "thinking" });
          break;
        case "text-delta":
          if (typeof p.text === "string") {
            fullText += p.text;
            writeEvent({ type: "text-delta", text: p.text });
          }
          break;
        case "tool-call":
          writeEvent({
            type: "tool_call",
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            args: p.args ?? {},
          });
          break;
        case "tool-result":
          writeEvent({
            type: "tool_result",
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            ok: true,
            result: p.output,
          });
          break;
        case "tool-error":
          writeEvent({
            type: "tool_result",
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            ok: false,
            error: p.error instanceof Error ? p.error.message : String(p.error),
          });
          break;
        case "finish":
          break;
        case "error":
          writeEvent({ type: "error", error: p.error });
          break;
        default:
          break;
      }
    }

    const finalResult = await result;
    const finalText = await finalResult.text;
    if (finalText !== undefined) fullText = finalText;

    if (!res.destroyed) {
      writeEvent({
        type: "complete",
        text: fullText,
        toolResults,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Stream error";
    writeEvent({ type: "error", error: msg });
  } finally {
    res.end();
  }
}
