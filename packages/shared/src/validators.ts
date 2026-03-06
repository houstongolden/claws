export function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isSafeTopLevel(topLevel: string): boolean {
  const allowed = new Set([
    "prompt",
    "identity",
    "notes",
    "areas",
    "projects",
    "clients",
    "content",
    "fitness",
    "drafts",
    "final",
    "assets",
    "skills",
    "agents",
    "project-context"
  ]);

  return allowed.has(topLevel);
}
