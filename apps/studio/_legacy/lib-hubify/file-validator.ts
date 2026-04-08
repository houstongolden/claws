/**
 * File validator — allowlist approach for template files.
 * Only known paths are accepted. Path traversal is impossible.
 */

/** Maximum size per file (100KB) */
const MAX_FILE_SIZE = 100 * 1024;

/** Maximum total template size (1MB) */
const MAX_TOTAL_SIZE = 1024 * 1024;

/** Allowed file patterns */
const ALLOWED_PATTERNS = [
  /^SOUL\.md$/,
  /^HUB\.yaml$/,
  /^AGENTS\.md$/,
  /^MEMORY\.md$/,
  /^skills\/[a-zA-Z0-9_-]+\.md$/,
  /^memory\/[a-zA-Z0-9_-]+\.md$/,
  /^learnings\/[a-zA-Z0-9_-]+\.md$/,
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate a single file path */
export function validateFilePath(path: string): ValidationResult {
  if (!path || typeof path !== "string") {
    return { valid: false, error: "File path is required" };
  }

  // Reject path traversal
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return { valid: false, error: `Invalid path: ${path}` };
  }

  // Check against allowlist
  const allowed = ALLOWED_PATTERNS.some((pattern) => pattern.test(path));
  if (!allowed) {
    return {
      valid: false,
      error: `File not allowed: ${path}. Allowed: SOUL.md, HUB.yaml, AGENTS.md, MEMORY.md, skills/*.md, memory/*.md, learnings/*.md`,
    };
  }

  return { valid: true };
}

/** Validate file content size */
export function validateFileSize(content: string): ValidationResult {
  const size = new TextEncoder().encode(content).length;
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds ${MAX_FILE_SIZE / 1024}KB limit (${Math.round(size / 1024)}KB)`,
    };
  }
  return { valid: true };
}

/** Validate all files in a template */
export function validateTemplate(
  files: { path: string; content: string }[]
): ValidationResult {
  // Check total size
  const totalSize = files.reduce(
    (acc, f) => acc + new TextEncoder().encode(f.content).length,
    0
  );
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `Template exceeds ${MAX_TOTAL_SIZE / (1024 * 1024)}MB total limit (${Math.round(totalSize / 1024)}KB)`,
    };
  }

  // Validate each file
  for (const file of files) {
    const pathResult = validateFilePath(file.path);
    if (!pathResult.valid) return pathResult;

    const sizeResult = validateFileSize(file.content);
    if (!sizeResult.valid) return { valid: false, error: `${file.path}: ${sizeResult.error}` };
  }

  return { valid: true };
}

/** Get the default files for a blank template */
export function getBlankTemplateFiles(): { path: string; content: string }[] {
  return [
    {
      path: "SOUL.md",
      content: `# My Agent

## Personality
You are a helpful AI assistant. Describe your agent's personality, knowledge areas, and communication style here.

## Greeting
Hello! I'm your AI assistant. How can I help you today?
`,
    },
    {
      path: "HUB.yaml",
      content: `# Template Configuration

skills:
  - general-assistant

widgets:
  - chat
  - memory
  - skills

integrations: []
`,
    },
  ];
}

/** Get allowed file paths for display */
export function getAllowedPaths(): string[] {
  return [
    "SOUL.md",
    "HUB.yaml",
    "AGENTS.md",
    "MEMORY.md",
    "skills/<name>.md",
    "memory/<name>.md",
    "learnings/<name>.md",
  ];
}
