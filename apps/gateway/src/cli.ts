import { randomUUID } from "node:crypto";
import { runAgentLoop } from "@claws/core/runner";
import type { MessageEvent } from "@claws/shared/types";
import type { GatewayRuntime } from "./httpServer";

export function printStartupBanner(port: number): void {
  console.log("Locked in.");
  console.log(`Gateway: http://localhost:${port}`);
}

export async function runCliChat(message: string, runtime: GatewayRuntime): Promise<void> {
  const event: MessageEvent = {
    id: randomUUID(),
    channel: "cli",
    timestamp: Date.now(),
    text: message,
    from: { userId: "local-user", displayName: "You", isMe: true },
    chat: { chatId: "cli-chat" }
  };

  if (!runtime.router || !runtime.runTool) {
    console.log("Runtime not fully initialized.");
    return;
  }

  const result = await runAgentLoop(event, {
    router: runtime.router,
    runTool: runtime.runTool
  });

  console.log(result.summary);
  for (const line of result.messages) console.log(`- ${line}`);
}
