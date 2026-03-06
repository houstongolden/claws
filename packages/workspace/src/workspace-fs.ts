import { promises as fs } from "node:fs";
import path from "node:path";
import type { FolderContract } from "./folder-md.js";
import { loadFolderContractSync } from "./folder-md.js";
import { FolderPolicyError } from "./folder-policy-error.js";

export type WriteOptions = {
  /** Set when user explicitly finalizes/ships; allows write to locked roots (e.g. final/). */
  finalizeIntent?: boolean;
};

export class WorkspaceFS {
  private readonly contract: FolderContract;

  constructor(
    private readonly root: string,
    contract?: FolderContract | null
  ) {
    this.contract = contract ?? loadFolderContractSync(root);
  }

  /** Return the top-level directory name for a relative path. */
  private getRoot(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    return normalized.split("/")[0] ?? "";
  }

  /** Resolve path and check it is under an allowed root. Throws FolderPolicyError for not-allowed. */
  private resolveSafePath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const topLevel = normalized.split("/")[0];

    if (!topLevel || !this.contract.allowedRoots.has(topLevel)) {
      throw new FolderPolicyError(
        `Top-level path "${topLevel}" is not allowed by FOLDER.md`,
        "not-allowed",
        relativePath,
        topLevel
      );
    }

    const absolute = path.resolve(this.root, normalized);
    if (!absolute.startsWith(path.resolve(this.root))) {
      throw new FolderPolicyError(
        "Path traversal is not allowed",
        "not-allowed",
        relativePath,
        topLevel
      );
    }

    return absolute;
  }

  async read(relativePath: string): Promise<string> {
    const filePath = this.resolveSafePath(relativePath);
    return fs.readFile(filePath, "utf8");
  }

  async write(relativePath: string, content: string, options?: WriteOptions): Promise<void> {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const topLevel = this.getRoot(relativePath);

    if (!topLevel || !this.contract.allowedRoots.has(topLevel)) {
      throw new FolderPolicyError(
        `Top-level path "${topLevel}" is not allowed by FOLDER.md`,
        "not-allowed",
        relativePath,
        topLevel
      );
    }

    if (this.contract.readOnlyRoots.has(topLevel)) {
      throw new FolderPolicyError(
        `"${topLevel}/" is read-only by FOLDER.md; use append or request prompt-edit approval`,
        "read-only",
        relativePath,
        topLevel
      );
    }

    if (this.contract.appendOnlyRoots.has(topLevel)) {
      throw new FolderPolicyError(
        `"${topLevel}/" is append-only by FOLDER.md; use fs.append to add content`,
        "append-only",
        relativePath,
        topLevel
      );
    }

    if (this.contract.lockedRoots.has(topLevel) && !options?.finalizeIntent) {
      throw new FolderPolicyError(
        `"${topLevel}/" is locked; write requires explicit finalize intent`,
        "locked",
        relativePath,
        topLevel
      );
    }

    const filePath = path.resolve(this.root, normalized);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  }

  async append(relativePath: string, content: string, options?: WriteOptions): Promise<void> {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const topLevel = this.getRoot(relativePath);

    if (!topLevel || !this.contract.allowedRoots.has(topLevel)) {
      throw new FolderPolicyError(
        `Top-level path "${topLevel}" is not allowed by FOLDER.md`,
        "not-allowed",
        relativePath,
        topLevel
      );
    }

    if (this.contract.readOnlyRoots.has(topLevel)) {
      throw new FolderPolicyError(
        `"${topLevel}/" is read-only by FOLDER.md`,
        "read-only",
        relativePath,
        topLevel
      );
    }

    if (this.contract.lockedRoots.has(topLevel) && !options?.finalizeIntent) {
      throw new FolderPolicyError(
        `"${topLevel}/" is locked; append requires explicit finalize intent`,
        "locked",
        relativePath,
        topLevel
      );
    }

    const filePath = path.resolve(this.root, normalized);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, content, "utf8");
  }

  async list(relativePath = ""): Promise<Array<{
    name: string;
    path: string;
    type: "file" | "directory";
  }>> {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const targetPath = normalized ? this.resolveSafePath(normalized) : path.resolve(this.root);
    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    return entries
      .map((entry) => ({
        name: entry.name,
        path: [normalized, entry.name].filter(Boolean).join("/"),
        type: entry.isDirectory() ? "directory" as const : "file" as const,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  /** Expose the current contract for introspection (e.g. status API). */
  getContract(): FolderContract {
    return this.contract;
  }
}
