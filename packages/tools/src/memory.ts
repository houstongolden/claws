import { promises as fs } from "node:fs";
import path from "node:path";

type MemoryEntry = {
  id: string;
  text: string;
  source?: string;
  tags?: string[];
  promoted: boolean;
  createdAt: number;
  promotedAt?: number;
};

type MemoryStore = {
  entries: MemoryEntry[];
  updatedAt: number;
};

function getMemoryMaxEntries(): number {
  const raw = Number(process.env.CLAWS_MEMORY_MAX_ENTRIES ?? 600);
  if (!Number.isFinite(raw) || raw < 50) return 600;
  return Math.floor(raw);
}

function memoryStorePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".claws", "memory-store.json");
}

async function loadMemoryStore(workspaceRoot: string): Promise<MemoryStore> {
  const filePath = memoryStorePath(workspaceRoot);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MemoryStore>;
    return {
      entries: parsed.entries ?? [],
      updatedAt: parsed.updatedAt ?? Date.now()
    };
  } catch {
    return { entries: [], updatedAt: Date.now() };
  }
}

async function persistMemoryStore(workspaceRoot: string, store: MemoryStore): Promise<void> {
  const filePath = memoryStorePath(workspaceRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload: MemoryStore = { ...store, updatedAt: Date.now() };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function isSearchableFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".md", ".txt", ".json", ".yaml", ".yml"].includes(ext);
}

async function collectFiles(root: string, relativeDir: string, maxFiles: number): Promise<string[]> {
  const start = path.join(root, relativeDir);
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    if (files.length >= maxFiles) return;
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    try {
      entries = (await fs.readdir(current, { withFileTypes: true })) as Array<{
        name: string;
        isDirectory: () => boolean;
        isFile: () => boolean;
      }>;
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (relativePath.startsWith("identity/private/")) continue;
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && isSearchableFile(fullPath)) {
        files.push(relativePath);
      }
    }
  }

  await walk(start);
  return files;
}

function scoreContent(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    let index = lower.indexOf(term);
    while (index !== -1) {
      score += 1;
      index = lower.indexOf(term, index + term.length);
    }
  }
  return score;
}

function excerptFor(content: string, terms: string[]): string {
  const lines = content.split(/\r?\n/);
  const lowerTerms = terms.map((t) => t.toLowerCase());
  const hitIndex = lines.findIndex((line) => lowerTerms.some((term) => line.toLowerCase().includes(term)));
  if (hitIndex === -1) return lines.slice(0, 3).join("\n").slice(0, 420);
  const start = Math.max(0, hitIndex - 1);
  const end = Math.min(lines.length, hitIndex + 2);
  return lines.slice(start, end).join("\n").slice(0, 420);
}

export function createMemoryTools(workspaceRoot: string) {
  return {
    "memory.flush": async (args: Record<string, unknown>) => {
      const text = String(args.text ?? "").trim();
      const source = typeof args.source === "string" ? args.source : undefined;
      const tags = Array.isArray(args.tags) ? args.tags.map((item) => String(item)).filter(Boolean) : undefined;
      if (!text) throw new Error("Missing text");

      const store = await loadMemoryStore(workspaceRoot);
      const entry: MemoryEntry = {
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text,
        source,
        tags,
        promoted: false,
        createdAt: Date.now()
      };
      store.entries.unshift(entry);
      store.entries = store.entries.slice(0, getMemoryMaxEntries());
      await persistMemoryStore(workspaceRoot, store);

      return {
        ok: true,
        entry: {
          id: entry.id,
          promoted: entry.promoted,
          createdAt: entry.createdAt,
          source: entry.source
        }
      };
    },
    "memory.getEntry": async (args: Record<string, unknown>) => {
      const entryId = String(args.entryId ?? "").trim();
      if (!entryId) throw new Error("Missing entryId");
      const store = await loadMemoryStore(workspaceRoot);
      const entry = store.entries.find((e) => e.id === entryId);
      if (!entry) {
        return { ok: false, error: `Memory entry not found: ${entryId}` };
      }
      return {
        ok: true,
        entry: {
          id: entry.id,
          text: entry.text,
          source: entry.source,
          tags: entry.tags,
          promoted: entry.promoted,
          createdAt: entry.createdAt,
          promotedAt: entry.promotedAt,
        },
      };
    },
    "memory.promote": async (args: Record<string, unknown>) => {
      const entryId = String(args.entryId ?? "").trim();
      if (!entryId) throw new Error("Missing entryId");

      const store = await loadMemoryStore(workspaceRoot);
      const target = store.entries.find((entry) => entry.id === entryId);
      if (!target) {
        return { ok: false, error: `Memory entry not found: ${entryId}` };
      }

      target.promoted = true;
      target.promotedAt = Date.now();
      store.entries = store.entries.slice(0, getMemoryMaxEntries());
      await persistMemoryStore(workspaceRoot, store);
      return { ok: true, entryId, promoted: true, promotedAt: target.promotedAt };
    },
    "memory.search": async (args: Record<string, unknown>) => {
      const query = String(args.query ?? "").trim();
      const terms = tokenize(query);

      const roots = ["prompt", "notes", "projects", "identity"];
      const candidates = (
        await Promise.all(roots.map((relativeDir) => collectFiles(workspaceRoot, relativeDir, 40)))
      ).flat();

      const uniqueCandidates = [...new Set(candidates)].slice(0, 120);
      const ranked: Array<{ path: string; score: number; excerpt: string }> = [];

      for (const relativePath of uniqueCandidates) {
        const absolute = path.join(workspaceRoot, relativePath);
        let content = "";
        try {
          content = await fs.readFile(absolute, "utf8");
        } catch {
          continue;
        }
        if (!content.trim()) continue;

        const score = terms.length > 0 ? scoreContent(content, terms) : 0;
        if (terms.length > 0 && score === 0) continue;

        ranked.push({
          path: relativePath,
          score,
          excerpt: excerptFor(content, terms)
        });
      }

      const store = await loadMemoryStore(workspaceRoot);
      const memoryMatches = store.entries
        .map((entry) => {
          const score = terms.length > 0 ? scoreContent(entry.text, terms) : 1;
          return {
            path: entry.source ?? `memory://entry/${entry.id}`,
            score: score + (entry.promoted ? 2 : 0),
            excerpt: entry.text.slice(0, 420),
            memoryId: entry.id,
            promoted: entry.promoted,
            createdAt: entry.createdAt
          };
        })
        .filter((item) => (terms.length > 0 ? item.score > (item.promoted ? 2 : 0) : true));

      const merged = [...memoryMatches, ...ranked];
      merged.sort((a, b) => b.score - a.score);

      return {
        query,
        results: merged.slice(0, 8),
        sources: [...roots.map((dir) => `${dir}/**`), ".claws/memory-store.json"],
        note:
          merged.length > 0
            ? "Workspace-backed memory search results with promoted/flush memory entries."
            : "No matching memory entries found in prompt/notes/projects/identity/memory store."
      };
    }
  };
}
