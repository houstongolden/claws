import type { AgentDefinition } from "@claws/shared/types";

export const orchestratorAgent: AgentDefinition = {
  id: "orchestrator",
  description: "Control plane agent for routing, approvals, and coordination",
  modes: ["founder", "agency", "developer", "creator", "personal", "fitness"]
};
