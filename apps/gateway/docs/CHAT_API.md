# Chat API (gateway)

## `POST /api/chat/stream`

JSON body:

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | **Required.** User message. |
| `chatId` | string? | Session id (default `dashboard-chat`). |
| `threadId` | string? | Optional thread. |
| `history` | `{ role, content }[]?` | Prior turns; merged with persisted session. |
| `mode` | `"agent"` \| `"plan"` \| `"chat"`? | **agent**: full tools. **plan**: read-only tools (`fs.read`, `research.*`, …). **chat**: no tools. |
| `maxSteps` | number? | Model step cap (1–128). Default `CLAWS_AGENT_MAX_STEPS` or 32. |

SSE events include `thinking`, `text-delta`, `tool_call`, `tool_result`, `approval_requested`, `step_limit` (when capped), `complete` (with `toolResults`, `stepLimited`, `maxSteps`), `error`.

## `POST /api/chat`

Same body; returns JSON `{ ok, result: { summary, messages, toolResults } }`.
