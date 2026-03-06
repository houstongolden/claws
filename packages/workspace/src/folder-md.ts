/**
 * Parsed FOLDER.md contract. Governs which roots exist and how they may be used.
 * Filesystem remains canonical; this is the in-memory policy derived from FOLDER.md.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FOLDER_MD = "FOLDER.md";

export type FolderContract = {
  /** Top-level directories that may be accessed (read/list). */
  allowedRoots: Set<string>;
  /** Roots where only append is allowed; full overwrite (write) is blocked. */
  appendOnlyRoots: Set<string>;
  /** Roots where write and append are blocked; read/list only. */
  readOnlyRoots: Set<string>;
  /** Roots where write/append require explicit finalize intent (e.g. final/). */
  lockedRoots: Set<string>;
  /** Roots that are scratch/draft space (full write allowed). */
  scratchRoots: Set<string>;
};

/** Default roots and policies when FOLDER.md is missing or unparseable. Matches PRD + template. */
const DEFAULT_ALLOWED_ROOTS = new Set([
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
  "project-context",
]);

const DEFAULT_APPEND_ONLY = new Set(["notes"]);
const DEFAULT_READ_ONLY = new Set(["prompt"]);
const DEFAULT_LOCKED = new Set(["final"]);
const DEFAULT_SCRATCH = new Set(["drafts"]);

export function getDefaultContract(): FolderContract {
  return {
    allowedRoots: new Set(DEFAULT_ALLOWED_ROOTS),
    appendOnlyRoots: new Set(DEFAULT_APPEND_ONLY),
    readOnlyRoots: new Set(DEFAULT_READ_ONLY),
    lockedRoots: new Set(DEFAULT_LOCKED),
    scratchRoots: new Set(DEFAULT_SCRATCH),
  };
}

/**
 * Parse FOLDER.md content into a FolderContract.
 * - Root Layout: extract directory names from tree lines (├── name/ or └── name/).
 * - Rules: look for "read-only" (prompt), "append-only" (notes), "finalize" / "locked" (final), "scratch" (drafts), "read-mostly" / "append" (identity).
 */
export function parseFolderMd(content: string): FolderContract {
  const allowedRoots = new Set<string>(DEFAULT_ALLOWED_ROOTS);
  const appendOnlyRoots = new Set<string>(DEFAULT_APPEND_ONLY);
  const readOnlyRoots = new Set<string>(DEFAULT_READ_ONLY);
  const lockedRoots = new Set<string>(DEFAULT_LOCKED);
  const scratchRoots = new Set<string>(DEFAULT_SCRATCH);

  const lines = content.split(/\r?\n/);
  let inRootLayout = false;
  let inRules = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^##\s+Root Layout/i.test(line)) {
      inRootLayout = true;
      inRules = false;
      continue;
    }
    if (/^##\s+Rules/i.test(line)) {
      inRootLayout = false;
      inRules = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      inRootLayout = false;
      inRules = false;
      continue;
    }

    if (inRootLayout) {
      const treeMatch = line.match(/^[├└│\s─]+\s+(.+?)\/?\s*$/);
      if (treeMatch) {
        const name = treeMatch[1].trim().replace(/\/$/, "");
        if (name && !name.includes(".") && name !== "FOLDER.md" && name !== "PROJECT.md" && name !== "tasks.md") {
          allowedRoots.add(name);
        }
      }
    }

    if (inRules) {
      const lower = line.toLowerCase();
      if (lower.includes("prompt/") && (lower.includes("read-only") || lower.includes("read only"))) {
        readOnlyRoots.add("prompt");
      }
      if (lower.includes("notes/") && (lower.includes("append-only") || lower.includes("append only"))) {
        appendOnlyRoots.add("notes");
      }
      if (lower.includes("identity/") && (lower.includes("append") || lower.includes("read-mostly"))) {
        appendOnlyRoots.add("identity");
      }
      if (lower.includes("final/") && (lower.includes("locked") || lower.includes("finalize") || lower.includes("requires explicit"))) {
        lockedRoots.add("final");
      }
      if (lower.includes("drafts/") && (lower.includes("scratch") || lower.includes("editable"))) {
        scratchRoots.add("drafts");
      }
    }
  }

  return {
    allowedRoots,
    appendOnlyRoots,
    readOnlyRoots,
    lockedRoots,
    scratchRoots,
  };
}

/**
 * Load and parse FOLDER.md from workspace root. Returns default contract if file missing or parse fails.
 */
export function loadFolderContractSync(root: string): FolderContract {
  const filePath = path.join(root, FOLDER_MD);
  try {
    if (!existsSync(filePath)) return getDefaultContract();
    const content = readFileSync(filePath, "utf8");
    return parseFolderMd(content);
  } catch {
    return getDefaultContract();
  }
}
