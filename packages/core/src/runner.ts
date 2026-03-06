import type { MessageEvent, ToolResult } from "@claws/shared/types";
import type { StaticRouter } from "./router";

export type RunnerDeps = {
  router: StaticRouter;
  runTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

export type RunnerResult = {
  ok: boolean;
  agentId: string;
  summary: string;
  messages: string[];
  toolResults: ToolResult[];
};

export async function runAgentLoop(event: MessageEvent, deps: RunnerDeps): Promise<RunnerResult> {
  const decision = await deps.router.route(event);
  const toolResults: ToolResult[] = [];

  if ((event.text ?? "").toLowerCase().includes("status") && deps.runTool) {
    try {
      const data = await deps.runTool("status.get", {});
      toolResults.push({ toolName: "status.get", ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      toolResults.push({ toolName: "status.get", ok: false, error: message });
    }
  }

  if ((event.text ?? "").toLowerCase().includes("what did we decide") && deps.runTool) {
    try {
      const data = await deps.runTool("memory.search", { query: event.text ?? "" });
      toolResults.push({ toolName: "memory.search", ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      toolResults.push({ toolName: "memory.search", ok: false, error: message });
    }
  }

  if ((event.text ?? "").toLowerCase().startsWith("remember this:") && deps.runTool) {
    const text = (event.text ?? "").slice("remember this:".length).trim();
    if (text) {
      try {
        const data = await deps.runTool("memory.flush", {
          text,
          source: "chat",
          tags: ["chat-capture"]
        });
        toolResults.push({ toolName: "memory.flush", ok: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tool error";
        toolResults.push({ toolName: "memory.flush", ok: false, error: message });
      }
    }
  }

  if ((event.text ?? "").toLowerCase().startsWith("promote memory ") && deps.runTool) {
    const entryId = (event.text ?? "").slice("promote memory ".length).trim();
    if (entryId) {
      try {
        const data = await deps.runTool("memory.promote", { entryId });
        toolResults.push({ toolName: "memory.promote", ok: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tool error";
        toolResults.push({ toolName: "memory.promote", ok: false, error: message });
      }
    }
  }

  return {
    ok: true,
    agentId: decision.leadAgentId,
    summary: `Handled by ${decision.leadAgentId} (${decision.viewStack.primary})`,
    messages: [
      `Primary view: ${decision.viewStack.primary}`,
      `Overlays: ${decision.viewStack.overlays.join(", ") || "none"}`
    ],
    toolResults
  };
}
