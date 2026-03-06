import type { AgentDefinition } from "@claws/shared/types";
import { developerAgent } from "./developer";
import { founderAgent } from "./founder";
import { orchestratorAgent } from "./orchestrator";

export * from "./orchestrator";
export * from "./founder";
export * from "./developer";

export function createDefaultAgents(): AgentDefinition[] {
  return [orchestratorAgent, founderAgent, developerAgent];
}
