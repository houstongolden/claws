import { WorkspaceFS } from "@claws/workspace/workspace-fs";
import { createBrowserTools } from "./browser";
import { createDemoTools } from "./demo";
import { createFsTools } from "./fs";
import { createMemoryTools } from "./memory";
import { ToolRegistry } from "./registry";
import { createResearchTools } from "./research";
import { createSandboxTools } from "./sandbox";
import { createTaskTools } from "./tasks";

export * from "./ai-sdk-adapter";
export * from "./browser";
export * from "./demo";
export * from "./fs";
export * from "./memory";
export * from "./registry";
export * from "./sandbox";
export * from "./tasks";
export * from "./tasks-md";

import type { ToolEnvironment } from "./registry";

const TOOL_RISK_MAP: Record<string, "low" | "medium" | "high"> = {
  /* Workspace file writes: no gate — vibe coding / demos. High-risk = tasks DB + sandbox. */
  "fs.write": "medium",
  "fs.append": "medium",
  "sandbox.exec": "high",
  "browser.navigate": "medium",
  "browser.screenshot": "low",
  "browser.click": "medium",
  "browser.type": "medium",
  "browser.extract": "low",
  "research.fetchUrl": "medium",
  "research.webSearch": "medium",
  "tasks.createTask": "high",
  "tasks.updateTask": "high",
  "tasks.moveTask": "high",
  "tasks.completeTask": "high",
};

const TOOL_ENV_MAP: Record<string, ToolEnvironment> = {
  "fs.read": "workspace",
  "fs.write": "workspace",
  "fs.append": "workspace",
  "fs.list": "workspace",
  "tasks.appendEvent": "workspace",
  "tasks.createTask": "workspace",
  "tasks.updateTask": "workspace",
  "tasks.moveTask": "workspace",
  "tasks.completeTask": "workspace",
  "memory.search": "workspace",
  "memory.flush": "workspace",
  "memory.promote": "workspace",
  "memory.getEntry": "workspace",
  "browser.navigate": "browser",
  "browser.screenshot": "browser",
  "browser.click": "browser",
  "browser.type": "browser",
  "browser.extract": "browser",
  "sandbox.exec": "sandbox",
  "demo.saveScreenshot": "workspace",
  "demo.saveMetadata": "workspace",
  "status.get": "api",
};

export function registerDefaultTools(registry: ToolRegistry, workspaceRoot: string): ToolRegistry {
  const workspace = new WorkspaceFS(workspaceRoot);
  const bundles = [
    createFsTools(workspace),
    createTaskTools(workspace),
    createMemoryTools(workspaceRoot),
    createBrowserTools(workspaceRoot),
    createSandboxTools(),
    createDemoTools(workspaceRoot),
    createResearchTools(),
    {
      "status.get": async () => ({
        gateway: "online",
        mode: "local-first",
      }),
    },
  ];

  for (const bundle of bundles) {
    for (const [name, handler] of Object.entries(bundle)) {
      registry.register({
        name,
        description: name,
        risk: TOOL_RISK_MAP[name] ?? "low",
        environment: TOOL_ENV_MAP[name] ?? "api",
        handler,
      });
    }
  }

  return registry;
}
