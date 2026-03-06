import { WorkspaceFS } from "@claws/workspace/workspace-fs";

export function createFsTools(workspace: WorkspaceFS) {
  return {
    "fs.read": async (args: Record<string, unknown>) => {
      const relativePath = String(args.path ?? "");
      if (!relativePath) throw new Error("Missing path");
      const content = await workspace.read(relativePath);
      return { path: relativePath, content };
    },
    "fs.write": async (args: Record<string, unknown>) => {
      const relativePath = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!relativePath) throw new Error("Missing path");
      const finalizeIntent = args.finalizeIntent === true;
      await workspace.write(relativePath, content, { finalizeIntent });
      return { ok: true, path: relativePath };
    },
    "fs.append": async (args: Record<string, unknown>) => {
      const relativePath = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!relativePath) throw new Error("Missing path");
      const finalizeIntent = args.finalizeIntent === true;
      await workspace.append(relativePath, content, { finalizeIntent });
      return { ok: true, path: relativePath };
    },
    "fs.list": async (args: Record<string, unknown>) => {
      const relativePath = String(args.path ?? "");
      const entries = await workspace.list(relativePath);
      return { path: relativePath, entries };
    }
  };
}
