# Agent Group Chats — Implementation Report

Users can chat with a **single agent** or **multiple agents** in a conversation. Agent **participants** are stored per conversation; **@mentions** in messages route or delegate to specific agents; the **orchestrator** can delegate to other participants via a tool.

---

## 1. Group chat implementation

### 1.1 Agent participants on conversations

- **Schema:** Existing `conversation_agents` table (conversation_id, agent_id, role, pinned) is used as the participant list for a conversation.
- **APIs:** Already in place:
  - `GET /api/conversations/:id/agents` — list participants
  - `POST /api/conversations/:id/agents` — add participant (body: `agent_id`, optional `role`, `pinned`)
  - `DELETE /api/conversations/:id/agents/:agentId` — remove participant
- **Behavior:** When posting a message to a conversation (`postConversationMessage`), the gateway loads participants via `getConversationAgents(conversationId)`. That list is used for:
  - **Lead selection:** Who responds (see below).
  - **System prompt:** “Other participants in this chat: X, Y, Z.”
  - **Delegation:** Only participants (or default set) can be targets of `delegate_to_agent`.

So: **single agent** = one participant on the conversation; **multiple agents** = several participants; **group chat** = user + multiple agent participants.

### 1.2 Agent mentions in chat

- **Parsing:** `apps/gateway/src/agentMentions.ts`
  - **`parseAgentMentions(message)`** — Finds `@slug` or `@agent-id` (e.g. `@dev-agent`, `@intel-agent`, `@developer`) and returns a list of **agent ids** in order of first mention.
  - **Slug → id map:** Common aliases (e.g. `dev-agent` → `developer`, `intel-agent` → `founder`, `design-agent` → `creator`) so users can type `@dev-agent` or `@developer`.
- **Use:** On `postConversationMessage`, the gateway runs `parseAgentMentions(body.message)`. The resulting `mentionedAgentIds` are:
  - Passed into **lead selection** (single mention can set the responding agent).
  - Injected into the system prompt: “The user mentioned: X, Y.”

So **@mentions** both influence who replies and are visible to the model for delegation.

### 1.3 Lead agent selection

- **Logic:** `resolveLeadAgent()` in `agentMentions.ts` (used in `postConversationMessage`).
- **Priority:**
  1. If exactly **one** agent is @mentioned → that agent is the lead.
  2. Else if the conversation has **pinned** participants → first pinned agent is the lead.
  3. Else if the conversation has **any** participants → first participant is the lead.
  4. Else → **default** from the router (view-based lead, e.g. founder).
- **Result:** `leadAgentId` is passed into `handleChat` and then into the AI handler so the model is told “You are responding as the agent: &lt;leadAgentId&gt;” and tools run under that agent.

### 1.4 Multi-agent responses and delegation

- **Single response:** The lead agent produces one reply (same as before). Multi-agent behavior is achieved by **delegation**, not by multiple parallel replies.
- **Delegation tool:** When the conversation has participants or mentions, the AI handler gets an extra tool:
  - **`delegate_to_agent`**  
    - Parameters: `agentId`, `message`.  
    - Allowed targets: conversation participants if any, otherwise `["orchestrator", "founder", "developer"]`.  
    - Effect: Runs a **sub-turn** with that agent (same pipeline, different `leadAgentId` and session key), then returns `{ summary }` to the caller.  
- **Flow:** User sends a message → lead agent (e.g. orchestrator) replies; it can call `delegate_to_agent(developer, "implement a hello world script")` → the developer agent runs with that message and returns a summary → the orchestrator can include that in its reply (e.g. “I asked @developer and they said: …”). So **multiple agents respond** over one user turn via orchestration + delegation.

### 1.5 Wiring in the gateway

- **`handleChat`** (and thus `/api/chat` and `postConversationMessage`) now accept optional:
  - `conversationId`
  - `participantAgentIds`
  - `mentionedAgentIds`
  - `leadAgentId`
- **`postConversationMessage`** (conversation/channel messages):
  1. Loads `conversation_agents` → `participantAgentIds`, `pinnedAgentIds`.
  2. Parses `parseAgentMentions(message)` → `mentionedAgentIds`.
  3. Gets router decision for default lead.
  4. Computes `leadAgentId = resolveLeadAgent({ mentionedAgentIds, participantAgentIds, pinnedAgentIds, defaultAgentId })`.
  5. Calls `handleChat` with message, history, `conversationId`, `participantAgentIds`, `mentionedAgentIds`, `leadAgentId`.
- **`handleChat`** (main.ts):
  1. Builds `effectiveLeadAgentId` and `sessionKey` from override or router.
  2. When there are participants or mentions, builds **`delegateToAgent`**: a closure that calls `handleAIChat` with the delegated `agentId`, same registry/identity, and returns `{ summary }`.
  3. Calls `handleAIChat` with `leadAgentId`, `participantAgentIds`, `mentionedAgentIds`, `delegateToAgent`.
- **Dashboard/stream:** Regular `/api/chat` and `/api/chat/stream` still use the router-only path (no conversationId); they get view-based lead and no delegation tool unless we later add conversation context there.

---

## 2. Orchestration behavior

### 2.1 Who is the orchestrator?

- The **orchestrator** agent (`orchestrator` id) is the default control-plane agent (routing, coordination). In group chats it is one of the possible participants and can be the **lead** when:
  - It’s the only @mentioned agent, or
  - It’s first in the pinned/participant list, or
  - The router default is used and maps to it.

### 2.2 How the orchestrator delegates

- When the lead agent is the orchestrator (or any agent) and the conversation has **participants** or **mentions**, the model receives:
  - “You are responding as the agent: orchestrator.”
  - “Other participants in this chat: developer, founder.”
  - “The user mentioned: developer.”
  - And the **`delegate_to_agent`** tool.
- The orchestrator can:
  - Reply directly, or
  - Call **`delegate_to_agent(agentId, message)`** to run a sub-turn with another participant. The tool returns that agent’s summary; the orchestrator can fold it into its reply (e.g. “@developer says: …”).
- Delegation is **one level**: the delegated agent runs without the delegation tool, so no chain of delegations (could be extended later).

### 2.3 Summary

- **Single agent:** Conversation has one participant (or none and view-based lead); no delegation tool; one agent responds.
- **Multiple agents / group chat:** Conversation has multiple participants; system prompt lists them and mentions; lead is chosen by mention → pinned → first participant → default; lead has **delegate_to_agent** to pull in other agents’ replies.
- **Orchestration:** The orchestrator can act as lead and delegate to specialist agents (e.g. @dev-agent, @intel-agent) so the user gets a coordinated, multi-agent response in one turn.

---

## 3. Files touched

| Area | File |
|------|------|
| Mention parsing & lead resolution | `apps/gateway/src/agentMentions.ts` |
| AI options, system prompt, delegate tool | `apps/gateway/src/aiHandler.ts` |
| handleChat input & postConversationMessage | `apps/gateway/src/httpServer.ts` |
| postConversationMessage + handleChat + delegateToAgent | `apps/gateway/src/main.ts` |

No schema or API changes were required; `conversation_agents` and existing conversation/agent APIs are reused.
