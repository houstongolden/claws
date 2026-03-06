import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Demo artifact pathing and link generation.
 *
 * When browser tasks complete in `record-on-complete` or `hybrid` mode,
 * this module handles saving the demo artifact (screenshot, recording URL,
 * or metadata) to the workspace's `assets/demos/YYYY-MM-DD/` directory
 * and returning a link the agent can post in chat or task events.
 *
 * Directory pattern: {workspaceRoot}/assets/demos/YYYY-MM-DD/{artifact-id}.{ext}
 */

export type DemoArtifact = {
  id: string;
  type: "screenshot" | "recording" | "metadata";
  path: string;
  url: string;
  createdAt: number;
  taskUrl?: string;
  agentId?: string;
};

function todayDir(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateArtifactId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveDemoScreenshot(
  workspaceRoot: string,
  screenshotBase64: string,
  meta?: { taskUrl?: string; agentId?: string }
): Promise<DemoArtifact> {
  const dateDir = todayDir();
  const artifactId = generateArtifactId();
  const relDir = path.join("assets", "demos", dateDir);
  const absDir = path.join(workspaceRoot, relDir);

  await mkdir(absDir, { recursive: true });

  const filename = `${artifactId}.png`;
  const absPath = path.join(absDir, filename);
  const relPath = path.join(relDir, filename);

  await writeFile(absPath, Buffer.from(screenshotBase64, "base64"));

  return {
    id: artifactId,
    type: "screenshot",
    path: relPath,
    url: relPath,
    createdAt: Date.now(),
    taskUrl: meta?.taskUrl,
    agentId: meta?.agentId,
  };
}

export async function saveDemoMetadata(
  workspaceRoot: string,
  metadata: Record<string, unknown>,
  meta?: { taskUrl?: string; agentId?: string }
): Promise<DemoArtifact> {
  const dateDir = todayDir();
  const artifactId = generateArtifactId();
  const relDir = path.join("assets", "demos", dateDir);
  const absDir = path.join(workspaceRoot, relDir);

  await mkdir(absDir, { recursive: true });

  const filename = `${artifactId}.json`;
  const absPath = path.join(absDir, filename);
  const relPath = path.join(relDir, filename);

  await writeFile(absPath, JSON.stringify(metadata, null, 2), "utf8");

  return {
    id: artifactId,
    type: "metadata",
    path: relPath,
    url: relPath,
    createdAt: Date.now(),
    taskUrl: meta?.taskUrl,
    agentId: meta?.agentId,
  };
}

export function getDemoDir(workspaceRoot: string, date?: string): string {
  return path.join(workspaceRoot, "assets", "demos", date ?? todayDir());
}

export function demoDirExists(workspaceRoot: string, date?: string): boolean {
  return existsSync(getDemoDir(workspaceRoot, date));
}

export function createDemoTools(workspaceRoot: string) {
  return {
    "demo.saveScreenshot": async (
      args: Record<string, unknown>
    ): Promise<DemoArtifact> => {
      const screenshot = String(args.screenshot ?? "");
      if (!screenshot) throw new Error("Missing screenshot data");

      return saveDemoScreenshot(workspaceRoot, screenshot, {
        taskUrl: args.taskUrl as string | undefined,
        agentId: args.agentId as string | undefined,
      });
    },

    "demo.saveMetadata": async (
      args: Record<string, unknown>
    ): Promise<DemoArtifact> => {
      const metadata = (args.metadata as Record<string, unknown>) ?? {};
      return saveDemoMetadata(workspaceRoot, metadata, {
        taskUrl: args.taskUrl as string | undefined,
        agentId: args.agentId as string | undefined,
      });
    },
  };
}
