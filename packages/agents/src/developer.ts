import type { AgentDefinition } from "@claws/shared/types";

export const developerAgent: AgentDefinition = {
  id: "developer",
  description: "Lead agent for architecture, implementation, and debugging",
  modes: ["developer"]
};
