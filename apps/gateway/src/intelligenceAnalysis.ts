/**
 * Chat intelligence analysis: extract tasks, memories, preferences, project updates, and insights
 * from conversation messages using the AI provider.
 */

import { generateText } from "ai";
import { createAIModel } from "./aiHandler.js";
import type { IntelligenceSignals } from "@claws/runtime-db";

const EXTRACTION_SYSTEM = `You are a structured extraction assistant. Given a conversation transcript, output a JSON object with exactly these keys (use empty arrays when nothing is found):

- summary: one short sentence summarizing the conversation (string)
- detected_tasks: array of { title: string, priority?: "P0"|"P1"|"P2"|"P3", project?: string } for any actionable tasks mentioned
- memory_candidates: array of { text: string, source?: string } for facts, preferences, or context worth remembering long-term
- preferences: array of { key: string, value: string } for user preferences or style (e.g. "tone", "concise")
- project_updates: array of { project: string, update: string } for project-related decisions or status changes
- key_insights: array of short insight strings (decisions, blockers, conclusions)
- style_hints: array of short strings (writing style, format preferences the user indicated)

Output only valid JSON, no markdown or explanation.`;

function buildExtractionPrompt(messages: Array<{ role: string; content: string }>): string {
  const transcript = messages
    .slice(-20)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");
  return `Conversation:\n\n${transcript}\n\nExtract signals (JSON only):`;
}

export type AnalysisInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function runChatIntelligenceAnalysis(input: AnalysisInput): Promise<IntelligenceSignals> {
  const model = createAIModel();
  const prompt = buildExtractionPrompt(input.messages);

  const result = await generateText({
    model,
    system: EXTRACTION_SYSTEM,
    prompt,
  });

  const raw = result.text?.trim() ?? "{}";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {
      summary: undefined,
      detected_tasks: [],
      memory_candidates: [],
      preferences: [],
      project_updates: [],
      key_insights: [],
      style_hints: [],
    };
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    detected_tasks: Array.isArray(parsed.detected_tasks)
      ? (parsed.detected_tasks as IntelligenceSignals["detected_tasks"])
      : [],
    memory_candidates: Array.isArray(parsed.memory_candidates)
      ? (parsed.memory_candidates as IntelligenceSignals["memory_candidates"])
      : [],
    preferences: Array.isArray(parsed.preferences)
      ? (parsed.preferences as IntelligenceSignals["preferences"])
      : [],
    project_updates: Array.isArray(parsed.project_updates)
      ? (parsed.project_updates as IntelligenceSignals["project_updates"])
      : [],
    key_insights: Array.isArray(parsed.key_insights) ? (parsed.key_insights as string[]) : [],
    style_hints: Array.isArray(parsed.style_hints) ? (parsed.style_hints as string[]) : [],
  };
}
