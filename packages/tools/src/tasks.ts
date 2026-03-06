import { WorkspaceFS } from "@claws/workspace/workspace-fs";
import {
  parseTasksMd,
  serializeTasksMd,
  findTaskById,
  generateTaskId,
  type TaskRow,
} from "./tasks-md";

const TASKS_MD_PATH = "project-context/tasks.md";
const TASKS_JSONL_PATH = "project-context/tasks.jsonl";

function getMaxTaskEventLines(): number {
  const raw = Number(process.env.CLAWS_TASK_EVENTS_MAX_LINES ?? 2000);
  if (!Number.isFinite(raw) || raw < 100) return 2000;
  return Math.floor(raw);
}

async function appendEventLine(workspace: WorkspaceFS, event: Record<string, unknown>): Promise<void> {
  const line = `${JSON.stringify(event)}\n`;
  await workspace.append(TASKS_JSONL_PATH, line);
  const maxLines = getMaxTaskEventLines();
  let raw = "";
  try {
    raw = await workspace.read(TASKS_JSONL_PATH);
  } catch {
    return;
  }
  const lines = raw.split("\n").filter((entry) => entry.trim().length > 0);
  if (lines.length > maxLines) {
    const trimmed = `${lines.slice(-maxLines).join("\n")}\n`;
    await workspace.write(TASKS_JSONL_PATH, trimmed);
  }
}

export function createTaskTools(workspace: WorkspaceFS) {
  return {
    "tasks.appendEvent": async (args: Record<string, unknown>) => {
      const event = args.event;
      if (!event || typeof event !== "object") throw new Error("Missing event");
      const line = `${JSON.stringify(event)}\n`;
      await workspace.append(TASKS_JSONL_PATH, line);

      const maxLines = getMaxTaskEventLines();
      let raw = "";
      try {
        raw = await workspace.read(TASKS_JSONL_PATH);
      } catch {
        return { ok: true };
      }
      const lines = raw.split("\n").filter((entry) => entry.trim().length > 0);
      if (lines.length > maxLines) {
        const trimmed = `${lines.slice(-maxLines).join("\n")}\n`;
        await workspace.write(TASKS_JSONL_PATH, trimmed);
      }
      return { ok: true };
    },

    "tasks.createTask": async (args: Record<string, unknown>) => {
      const task = args.task as string | undefined;
      const section = (args.section as string) || "Build queue";
      const priority = (args.priority as string) || "P2";
      const owner = (args.owner as string) || "human";
      if (!task || typeof task !== "string" || !task.trim()) {
        throw new Error("Missing or invalid task description");
      }
      let content: string;
      try {
        content = await workspace.read(TASKS_MD_PATH);
      } catch {
        content = `# Build Queue\n\n## ${section}\n\n| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |\n|---|---|---|---|---|---|---|---|\n`;
      }
      const parsed = parseTasksMd(content);
      if (parsed.sections.length === 0) {
        parsed.sections.push({ title: section, rows: [] });
      }
      const taskId = generateTaskId(parsed, "TASK");
      const row: TaskRow = {
        id: taskId,
        status: "todo",
        priority: priority.trim(),
        owner: owner.trim(),
        task: task.trim(),
        dependencies: "-",
        files: "",
        acceptance: "",
      };
      let targetSection = parsed.sections.find((s) => s.title === section);
      if (!targetSection) {
        targetSection = { title: section, rows: [] };
        parsed.sections.push(targetSection);
      }
      targetSection.rows.push(row);
      const newContent = serializeTasksMd(parsed);
      await workspace.write(TASKS_MD_PATH, newContent);
      const event = {
        type: "task.created",
        taskId,
        task: row,
        section,
        ts: Date.now(),
      };
      await appendEventLine(workspace, event);
      return { ok: true, taskId, task: row, event };
    },

    "tasks.updateTask": async (args: Record<string, unknown>) => {
      const taskId = args.taskId as string | undefined;
      const patch = args.patch as Record<string, string> | undefined;
      if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
        throw new Error("Missing taskId");
      }
      if (!patch || typeof patch !== "object") {
        throw new Error("Missing patch object");
      }
      const content = await workspace.read(TASKS_MD_PATH);
      const parsed = parseTasksMd(content);
      const found = findTaskById(parsed, taskId);
      if (!found) throw new Error(`Task not found: ${taskId}`);
      const row = found.row;
      const allowed = ["status", "priority", "owner", "task", "dependencies", "files", "acceptance"];
      for (const key of allowed) {
        if (patch[key] !== undefined && typeof patch[key] === "string") {
          (row as Record<string, string>)[key] = patch[key];
        }
      }
      const newContent = serializeTasksMd(parsed);
      await workspace.write(TASKS_MD_PATH, newContent);
      const event = {
        type: "task.updated",
        taskId,
        task: { ...row },
        patch,
        ts: Date.now(),
      };
      await appendEventLine(workspace, event);
      return { ok: true, taskId, task: row, event };
    },

    "tasks.moveTask": async (args: Record<string, unknown>) => {
      const taskId = args.taskId as string | undefined;
      const status = args.status as string | undefined;
      const targetSectionTitle = args.targetSection as string | undefined;
      if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
        throw new Error("Missing taskId");
      }
      const content = await workspace.read(TASKS_MD_PATH);
      const parsed = parseTasksMd(content);
      const found = findTaskById(parsed, taskId);
      if (!found) throw new Error(`Task not found: ${taskId}`);
      const { sectionIndex, rowIndex, row } = found;
      if (status !== undefined && status !== null) {
        row.status = String(status).trim();
      }
      if (
        targetSectionTitle !== undefined &&
        targetSectionTitle !== null &&
        targetSectionTitle !== parsed.sections[sectionIndex].title
      ) {
        parsed.sections[sectionIndex].rows.splice(rowIndex, 1);
        let targetSection = parsed.sections.find((s) => s.title === targetSectionTitle);
        if (!targetSection) {
          targetSection = { title: targetSectionTitle, rows: [] };
          parsed.sections.push(targetSection);
        }
        targetSection.rows.push(row);
      }
      const newContent = serializeTasksMd(parsed);
      await workspace.write(TASKS_MD_PATH, newContent);
      const event = {
        type: "task.moved",
        taskId,
        task: { ...row },
        status: row.status,
        targetSection: targetSectionTitle ?? parsed.sections[sectionIndex].title,
        ts: Date.now(),
      };
      await appendEventLine(workspace, event);
      return { ok: true, taskId, task: row, event };
    },

    "tasks.completeTask": async (args: Record<string, unknown>) => {
      const taskId = args.taskId as string | undefined;
      if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
        throw new Error("Missing taskId");
      }
      const content = await workspace.read(TASKS_MD_PATH);
      const parsed = parseTasksMd(content);
      const found = findTaskById(parsed, taskId);
      if (!found) throw new Error(`Task not found: ${taskId}`);
      const { row } = found;
      row.status = "done";
      const newContent = serializeTasksMd(parsed);
      await workspace.write(TASKS_MD_PATH, newContent);
      const event = {
        type: "task.completed",
        taskId,
        task: { ...row },
        ts: Date.now(),
      };
      await appendEventLine(workspace, event);
      return { ok: true, taskId, task: row, event };
    },
  };
}
