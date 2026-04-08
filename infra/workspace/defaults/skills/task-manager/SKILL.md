---
name: task-manager
version: "1.0.0"
tier: universal
category: productivity
description: "Create, update, and manage tasks via natural language"
triggers:
  - "create a task"
  - "add task"
  - "what are my tasks"
  - "mark done"
  - "task status"
  - "show tasks"
  - "my tasks"
try_me: 'Say: "Create a task to redesign the landing page, high priority, due Friday"'
---

# Task Manager

Manage structured tasks through the workspace Task API. Tasks are stored in `/data/.tasks.json` and displayed on the dashboard Task Board.

## Task API Endpoints

### List tasks
```
GET /tasks?status=in_progress&assignee=agent&priority=high&sort=priority&limit=50
```
Returns: `{ tasks: [...], projects: [...], labels: [...], counts: { backlog, todo, in_progress, review, done } }`

### Create task
```
POST /tasks
Body: { title, description?, status?, priority?, assignee?, project?, dueDate?, labels? }
```
- `status`: backlog | todo | in_progress | review | done (default: todo)
- `priority`: low | medium | high | urgent (default: medium)
- `assignee`: "human" | "agent" (default: human)
- `dueDate`: ISO date string (YYYY-MM-DD)
- `labels`: array of strings

### Update task
```
PATCH /tasks/:id
Body: { title?, status?, priority?, assignee?, ... } (partial update)
```
When status changes to "done", completedAt is set automatically.

### Delete task
```
DELETE /tasks/:id
```

### Bulk update
```
PATCH /tasks/bulk
Body: { ids: ["tsk_..."], status: "done" }
```

### List projects
```
GET /projects
```

### Create project
```
POST /projects
Body: { name, color? }
```

## Guidelines

- When the user asks to create a task, extract: title, priority, due date, and assignee
- Default assignee is "human" unless the user says "agent should do this" or similar
- When showing tasks, format them as a readable list with status and priority
- When marking tasks done, use PATCH with status: "done"
- For "what are my tasks", use GET /tasks and summarize by status
- Parse natural language dates: "Friday" → next Friday's date, "next week" → Monday, "tomorrow" → tomorrow's date
