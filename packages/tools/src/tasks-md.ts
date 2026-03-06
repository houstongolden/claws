/**
 * Parse and serialize project-context/tasks.md (canonical human-readable task state).
 * Format: optional preamble, then ## Section headers with markdown tables.
 * Table: 8 columns — ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria
 */

export type TaskRow = {
  id: string;
  status: string;
  priority: string;
  owner: string;
  task: string;
  dependencies: string;
  files: string;
  acceptance: string;
};

export type TasksSection = {
  title: string;
  rows: TaskRow[];
};

export type ParsedTasks = {
  preamble: string;
  sections: TasksSection[];
};

const TABLE_HEADER =
  "| ID | Status | Priority | Owner | Task | Dependencies | Affected files/dirs | Acceptance criteria |";
const TABLE_SEP = "|---|---|---|---|---|---|---|---|";

function isTableHeader(line: string): boolean {
  return line.includes("| ID | Status | Priority | Owner | Task |");
}

function isTableSeparator(line: string): boolean {
  return /^\|\s*-+\s*\|/.test(line);
}

function parseTableRow(line: string): TaskRow | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  const parts = trimmed
    .split("|")
    .slice(1, -1)
    .map((p) => p.trim());
  if (parts.length < 8) return null;
  return {
    id: parts[0],
    status: parts[1],
    priority: parts[2],
    owner: parts[3],
    task: parts[4],
    dependencies: parts[5],
    files: parts[6],
    acceptance: parts[7],
  };
}

export function parseTasksMd(content: string): ParsedTasks {
  const lines = content.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: TasksSection[] = [];
  let i = 0;

  while (i < lines.length && !lines[i].trim().startsWith("## ")) {
    preambleLines.push(lines[i]);
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim().startsWith("## ")) {
      i++;
      continue;
    }
    const title = line.replace(/^##\s+/, "").trim();
    i++;
    const rows: TaskRow[] = [];
    while (i < lines.length && !lines[i].trim().startsWith("## ")) {
      const rowLine = lines[i];
      if (isTableHeader(rowLine) || isTableSeparator(rowLine)) {
        i++;
        continue;
      }
      const row = parseTableRow(rowLine);
      if (row) rows.push(row);
      i++;
    }
    sections.push({ title, rows });
  }

  return {
    preamble: preambleLines.join("\n").replace(/\n+$/, ""),
    sections,
  };
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function serializeTasksMd(parsed: ParsedTasks): string {
  const out: string[] = [];
  if (parsed.preamble) out.push(parsed.preamble);
  for (const sec of parsed.sections) {
    out.push("");
    out.push(`## ${sec.title}`);
    out.push("");
    out.push(TABLE_HEADER);
    out.push(TABLE_SEP);
    for (const row of sec.rows) {
      out.push(
        `| ${escapeCell(row.id)} | ${escapeCell(row.status)} | ${escapeCell(row.priority)} | ${escapeCell(row.owner)} | ${escapeCell(row.task)} | ${escapeCell(row.dependencies)} | ${escapeCell(row.files)} | ${escapeCell(row.acceptance)} |`
      );
    }
  }
  if (out.length > 0 && out[out.length - 1] !== "") out.push("");
  return out.join("\n");
}

export function findTaskById(parsed: ParsedTasks, id: string): { sectionIndex: number; rowIndex: number; row: TaskRow } | null {
  const normId = id.trim();
  for (let s = 0; s < parsed.sections.length; s++) {
    const section = parsed.sections[s];
    for (let r = 0; r < section.rows.length; r++) {
      if (section.rows[r].id === normId) {
        return { sectionIndex: s, rowIndex: r, row: section.rows[r] };
      }
    }
  }
  return null;
}

export function generateTaskId(parsed: ParsedTasks, prefix = "TASK"): string {
  const used = new Set<string>();
  for (const sec of parsed.sections) {
    for (const row of sec.rows) used.add(row.id.toUpperCase());
  }
  let n = 1;
  while (used.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
