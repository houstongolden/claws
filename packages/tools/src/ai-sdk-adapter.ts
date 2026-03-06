import { z } from "zod";
import type { ToolRegistry, ToolSpec } from "./registry";

/**
 * Converts registered Claws tools into AI SDK-compatible tool definition inputs.
 *
 * Returns objects with { description, parameters, execute } that can be passed
 * directly to the AI SDK `tool()` helper or used as raw tool config.
 */

export type AISDKToolInput = {
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export function toAISDKToolInputs(
  registry: ToolRegistry,
  options?: {
    filter?: (spec: ToolSpec) => boolean;
    wrapExecute?: (
      name: string,
      args: Record<string, unknown>,
      originalExecute: (args: Record<string, unknown>) => Promise<unknown>
    ) => Promise<unknown>;
  }
): Record<string, AISDKToolInput> {
  const tools: Record<string, AISDKToolInput> = {};
  const filter = options?.filter;
  const wrapExecute = options?.wrapExecute;

  for (const name of registry.listNames()) {
    const spec = registry.get(name);
    if (!spec) continue;
    if (filter && !filter(spec)) continue;

    const execute = async (args: Record<string, unknown>) => {
      if (wrapExecute) {
        return wrapExecute(name, args, spec.handler as (args: Record<string, unknown>) => Promise<unknown>);
      }
      return spec.handler(args);
    };

    tools[name] = {
      description: spec.description || name,
      parameters: buildParametersSchema(name),
      execute,
    };
  }

  return tools;
}

function buildParametersSchema(toolName: string): z.ZodTypeAny {
  switch (toolName) {
    case "fs.read":
      return z.object({ path: z.string().describe("File path to read") });

    case "fs.write":
      return z.object({
        path: z.string().describe("File path to write"),
        content: z.string().describe("Content to write"),
      });

    case "fs.append":
      return z.object({
        path: z.string().describe("File path to append to"),
        content: z.string().describe("Content to append"),
      });

    case "memory.search":
      return z.object({
        query: z.string().describe("Search query for memory"),
      });

    case "memory.flush":
      return z.object({
        text: z.string().describe("Text to save to memory"),
        source: z.string().optional().describe("Source label"),
        tags: z.array(z.string()).optional().describe("Tags for the entry"),
      });

    case "memory.promote":
      return z.object({
        entryId: z.string().describe("Memory entry ID to promote"),
      });

    case "browser.navigate":
      return z.object({
        url: z.string().describe("URL to navigate to"),
        mode: z
          .enum(["background", "record-on-complete", "watch-live", "hybrid"])
          .optional()
          .describe("Execution visibility mode"),
      });

    case "browser.screenshot":
      return z.object({
        url: z.string().describe("URL to screenshot"),
      });

    case "sandbox.exec":
      return z.object({
        code: z.string().optional().describe("Code to execute"),
        language: z.string().optional().describe("Language runtime"),
      });

    case "status.get":
      return z.object({});

    case "tasks.appendEvent":
      return z.object({
        event: z.record(z.unknown()).describe("Task event payload"),
      });

    default:
      return z.record(z.unknown());
  }
}
