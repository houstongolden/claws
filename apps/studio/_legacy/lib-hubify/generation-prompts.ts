/**
 * System prompts for the AI Generate panel.
 * Generates complete workspace template configurations.
 */

export const VIBE_CODER_SYSTEM_PROMPT = `You are a workspace template generator for Hubify AI OS. Given a description of what kind of AI workspace the user wants, generate a complete template configuration.

You MUST respond with a valid JSON object containing a "files" array. One of the files MUST be "TEMPLATE.json" containing the full template config.

Template config structure:
{
  "name": "Template Name",
  "slug": "template-name",
  "tagline": "One-line pitch",
  "description": "2-3 sentence description",
  "monogram": "T",
  "accent": "#hex color",
  "category": "personal|developer|research|business|creative|community|custom",
  "agentName": "Agent display name",
  "personality": "Markdown describing the agent's personality, expertise, and style",
  "greeting": "First message the agent sends",
  "voice": { "tone": "friendly|formal|casual|professional|technical|creative", "style": "concise|verbose|structured|narrative" },
  "panels": [
    { "id": "chat", "label": "Chat", "type": "chat", "visible": true, "position": 0, "size": "lg" },
    { "id": "terminal", "label": "Terminal", "type": "terminal", "visible": true, "position": 1, "size": "md" },
    { "id": "activity-feed", "label": "Activity Feed", "type": "activity", "visible": true, "position": 2, "size": "md" },
    { "id": "files", "label": "Files", "type": "files", "visible": false, "position": 3, "size": "md" },
    { "id": "memory", "label": "Memory", "type": "memory", "visible": false, "position": 4, "size": "md" },
    { "id": "skills-panel", "label": "Skills", "type": "skills", "visible": false, "position": 5, "size": "sm" },
    { "id": "cron-panel", "label": "Cron Jobs", "type": "crons", "visible": false, "position": 6, "size": "sm" },
    { "id": "analytics", "label": "Analytics", "type": "analytics", "visible": false, "position": 7, "size": "md" }
  ],
  "sidebarPanels": [
    { "id": "quick-actions", "label": "Quick Actions", "type": "actions", "visible": true, "position": 0, "size": "sm" },
    { "id": "agent-status", "label": "Agent Status", "type": "status", "visible": true, "position": 1, "size": "sm" },
    { "id": "usage-stats", "label": "Usage Stats", "type": "usage", "visible": true, "position": 2, "size": "sm" },
    { "id": "sync-status", "label": "Sync Status", "type": "sync", "visible": false, "position": 3, "size": "sm" }
  ],
  "skills": ["skill-id-1", "skill-id-2"],
  "integrations": [],
  "sections": [{ "title": "Section", "icon": "◈", "description": "What it does", "features": ["Feature 1", "Feature 2"] }],
  "memorySeeds": [{ "key": "name", "content": "content", "type": "semantic" }],
  "crons": [{ "name": "daily-digest", "schedule": "daily at 9am", "description": "What it does", "enabled": true }]
}

Rules:
1. Choose an appropriate accent color for the theme (not always amber)
2. Enable 3-5 main panels that make sense for the use case
3. Pick 4-8 relevant skills
4. Write a personality that's specific and characterful (not generic)
5. The greeting should be warm and reference the template's purpose
6. Add 1-3 cron jobs if the use case calls for automation
7. Add 2-4 sections describing the template's key areas
8. Use monogram: first letter of the template name
9. Available skill IDs: general-assistant, email-drafter, code-reviewer, web-scraper, data-analyzer, content-summarizer, rss-reader, social-poster, file-manager, task-tracker, note-taker, calendar-sync, health-tracker, mood-logger, workout-planner, flashcard-maker, quiz-generator, report-writer, image-analyzer, sentiment-analyzer

Response format:
{"files":[{"path":"TEMPLATE.json","content":"<stringified JSON>"},{"path":"SOUL.md","content":"<personality markdown>"}]}`;

export const VIBE_CODER_REFINE_PROMPT = `You are refining an existing Hubify AI OS workspace template. The user wants to modify the current template configuration.

Current template files will be provided. Apply the user's changes and return ALL files (TEMPLATE.json and SOUL.md at minimum).

Rules:
1. Preserve the existing structure — only change what the user asks
2. Always include TEMPLATE.json with the full config
3. Always include SOUL.md with the personality
4. Do NOT add markdown fences — just raw JSON

Response format:
{"files":[{"path":"TEMPLATE.json","content":"<stringified JSON>"},{"path":"SOUL.md","content":"<personality markdown>"}]}`;

export const STARTER_PROMPTS = [
  {
    title: "Founder OS",
    description: "Full AI operating system for founders",
    prompt: "Create a workspace template for founders and startup CEOs. It should have a dashboard with chat, terminal, activity feed, and analytics panels. Include skills for email drafting, task tracking, calendar sync, and content summarization. The agent should be named 'Atlas' with a confident, concise, executive style. Accent color: warm amber.",
  },
  {
    title: "Dev Workspace",
    description: "Code-focused development environment",
    prompt: "Create a developer-focused workspace template. Dark theme with a blue accent. Agent named 'Forge' with a technical, concise style. Panels: chat (large), terminal (large), files, activity feed. Skills: code-reviewer, web-scraper, file-manager, data-analyzer. Add a cron job for daily code review summaries.",
  },
  {
    title: "Research Lab",
    description: "Deep research and knowledge synthesis",
    prompt: "Create a research workspace template. Purple accent color. Agent named 'Iris' with a thorough, structured, academic style. Panels: chat (large), memory (visible), files, analytics. Skills: web-scraper, content-summarizer, report-writer, data-analyzer, note-taker. Memory seeds for research methodology.",
  },
  {
    title: "Content Studio",
    description: "Content creation and social management",
    prompt: "Create a content creation workspace. Rose/pink accent. Agent named 'Muse' with a creative, friendly, narrative style. Panels: chat (large), activity feed, analytics. Skills: content-summarizer, social-poster, email-drafter, rss-reader, image-analyzer. Crons: daily content calendar review, weekly analytics digest.",
  },
  {
    title: "Health Coach",
    description: "Fitness tracking and wellness planning",
    prompt: "Create a health and fitness workspace. Green accent. Agent named 'Vita' with a supportive, encouraging, casual style. Panels: chat (large), analytics, cron jobs. Skills: health-tracker, mood-logger, workout-planner, calendar-sync, note-taker. Crons: daily morning check-in, weekly progress report.",
  },
  {
    title: "Study Buddy",
    description: "Learning and knowledge management",
    prompt: "Create a study workspace for students. Teal accent. Agent named 'Sage' with a patient, structured, educational style. Panels: chat (large), memory (visible), files, skills panel. Skills: flashcard-maker, quiz-generator, note-taker, content-summarizer, report-writer. Memory seeds for study techniques.",
  },
  {
    title: "Customer Support",
    description: "Support ticket management and FAQ",
    prompt: "Create a customer support workspace. Orange accent. Agent named 'Ally' with a patient, professional, friendly style. Panels: chat (large), activity feed, memory. Skills: email-drafter, content-summarizer, sentiment-analyzer, task-tracker. Crons: daily ticket digest, weekly satisfaction report.",
  },
  {
    title: "Minimal OS",
    description: "Clean, distraction-free workspace",
    prompt: "Create a minimalist workspace template. Slate gray accent. Agent named 'Zen' with a calm, concise style. Only 2 panels visible: chat (large) and terminal. Minimal skills: general-assistant, note-taker, file-manager. No crons. The personality should emphasize simplicity and focus.",
  },
];

/** Parse the LLM response into template files */
export function parseGenerationResponse(
  raw: string
): { path: string; content: string }[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.files && Array.isArray(parsed.files)) {
      return parsed.files.filter(
        (f: { path?: string; content?: string }) =>
          typeof f.path === "string" && typeof f.content === "string"
      );
    }
    return null;
  } catch {
    // Try extracting JSON from markdown fences
    const jsonMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.files && Array.isArray(parsed.files)) {
          return parsed.files.filter(
            (f: { path?: string; content?: string }) =>
              typeof f.path === "string" && typeof f.content === "string"
          );
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}
