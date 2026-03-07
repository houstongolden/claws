/**
 * PGlite schema for Claws runtime state.
 * Filesystem remains canonical for: projects/, prompt/, identity/, notes/, tasks.md, FOLDER.md.
 */

export const SCHEMA_SQL = `
-- Sessions: durable chat identity and view state
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  thread_id TEXT,
  channel TEXT NOT NULL DEFAULT 'local',
  workspace_id TEXT NOT NULL DEFAULT 'ws_local',
  view_primary TEXT,
  view_overlays JSONB DEFAULT '[]',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_chat_thread ON sessions(chat_id, COALESCE(thread_id, 'root'));
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

-- Messages: chat transcript per session
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  tool_results JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);

-- Traces: runtime ledger (tool calls, approvals, chat, etc.)
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  data JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_session ON traces(session_id);

-- Tool events: append-only tool call log (queryable)
CREATE TABLE IF NOT EXISTS tool_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  trace_id TEXT,
  tool_name TEXT NOT NULL,
  args JSONB,
  result JSONB,
  ok BOOLEAN NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_events_created ON tool_events(created_at DESC);

-- Approvals: pending high-risk tool requests
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  risk TEXT NOT NULL,
  args JSONB DEFAULT '{}',
  reason TEXT,
  environment TEXT NOT NULL DEFAULT 'workspace',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at DESC);

-- Approval grants: active trust grants (session, tool, agent, view, once)
CREATE TABLE IF NOT EXISTS approval_grants (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  expires_at BIGINT,
  note TEXT,
  created_at BIGINT NOT NULL,
  UNIQUE(scope_type, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_approval_grants_scope ON approval_grants(scope_type, scope_key);

-- Workflow runs
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  thread_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_updated ON workflow_runs(updated_at DESC);

-- Workflow steps
CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  tool TEXT,
  args JSONB,
  result JSONB,
  error TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  started_at BIGINT,
  completed_at BIGINT,
  UNIQUE(run_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(run_id);

-- Memory items: curated/store entries (metadata + content for search)
CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  source TEXT,
  tags JSONB DEFAULT '[]',
  promoted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  promoted_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_memory_items_promoted ON memory_items(promoted);
CREATE INDEX IF NOT EXISTS idx_memory_items_created ON memory_items(created_at DESC);

-- Task events: append-only task event log (metadata for querying)
CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  event JSONB NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_events_created ON task_events(created_at DESC);
`;

// Conversation types: session | project | channel | agent
export const CONVERSATION_TYPES = ["session", "project", "channel", "agent"] as const;

export const CONVERSATIONS_SCHEMA_SQL = `
-- Conversations: first-class conversation model (session, project, channel, agent)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('session', 'project', 'channel', 'agent')),
  title TEXT NOT NULL DEFAULT '',
  project_slug TEXT,
  channel_slug TEXT,
  metadata JSONB DEFAULT '{}',
  tags JSONB DEFAULT '[]',
  workspace_id TEXT NOT NULL DEFAULT 'ws_local',
  chat_id TEXT,
  thread_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_slug) WHERE project_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel_slug) WHERE channel_slug IS NOT NULL;

-- Link messages to conversation
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);

-- Participants (human + agents)
CREATE TABLE IF NOT EXISTS conversation_participants (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('human', 'agent')),
  participant_id TEXT NOT NULL,
  role TEXT,
  joined_at BIGINT NOT NULL,
  UNIQUE(conversation_id, participant_type, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- Agents in the conversation (which agents can respond)
CREATE TABLE IF NOT EXISTS conversation_agents (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(conversation_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_agents_conv ON conversation_agents(conversation_id);

-- Linked tasks (references to task events or external task ids)
CREATE TABLE IF NOT EXISTS conversation_tasks (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  task_ref TEXT NOT NULL,
  summary TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_tasks_conv ON conversation_tasks(conversation_id);

-- Linked memory entries (references to memory store)
CREATE TABLE IF NOT EXISTS conversation_memories (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  memory_ref TEXT NOT NULL,
  summary TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_memories_conv ON conversation_memories(conversation_id);

-- Linked artifacts (files, links)
CREATE TABLE IF NOT EXISTS conversation_artifacts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  artifact_ref TEXT NOT NULL,
  type TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conv_artifacts_conv ON conversation_artifacts(conversation_id);
`;

// Chat intelligence: extracted signals per session or conversation
export const INTELLIGENCE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversation_intelligence (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE,
  conversation_id TEXT UNIQUE,
  summary TEXT,
  detected_tasks JSONB DEFAULT '[]',
  memory_candidates JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '[]',
  project_updates JSONB DEFAULT '[]',
  key_insights JSONB DEFAULT '[]',
  style_hints JSONB DEFAULT '[]',
  analyzed_at BIGINT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CHECK (session_id IS NOT NULL OR conversation_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_session ON conversation_intelligence(session_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_conversation ON conversation_intelligence(conversation_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_analyzed ON conversation_intelligence(analyzed_at DESC);
`;

// Channels: pinned agents + unique channel_slug per workspace (safe to run on existing DBs)
export const CHANNELS_SCHEMA_SQL = `
ALTER TABLE conversation_agents ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_channel_slug_uniq ON conversations(workspace_id, channel_slug) WHERE type = 'channel' AND channel_slug IS NOT NULL;
`;

// Proactivity Engine: scheduled jobs, executions, notifications, model policies
export const PROACTIVITY_SCHEMA_SQL = `
-- Model policies: job type -> default tier and escalation rules
CREATE TABLE IF NOT EXISTS model_policies (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL UNIQUE,
  default_tier TEXT NOT NULL CHECK (default_tier IN ('cheap', 'standard', 'premium')),
  escalation_rules JSONB DEFAULT '[]',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_policies_job_type ON model_policies(job_type);

-- Scheduled proactive jobs (cron, heartbeat, watchdog, goal_loop, report)
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('cron', 'heartbeat', 'watchdog', 'goal_loop', 'report')),
  name TEXT NOT NULL,
  schedule_cron TEXT,
  interval_sec INTEGER,
  config JSONB DEFAULT '{}',
  model_tier TEXT NOT NULL DEFAULT 'cheap' CHECK (model_tier IN ('cheap', 'standard', 'premium')),
  conversation_id TEXT,
  project_slug TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_run_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_last_run ON scheduled_jobs(last_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_kind ON scheduled_jobs(kind);

-- Job execution history
CREATE TABLE IF NOT EXISTS job_executions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  started_at BIGINT NOT NULL,
  finished_at BIGINT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  summary TEXT,
  result JSONB,
  error TEXT,
  model_used TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_executions_job ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_started ON job_executions(started_at DESC);

-- Proactive notifications (inform, reassure, escalate, delight)
CREATE TABLE IF NOT EXISTS proactive_notifications (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES scheduled_jobs(id) ON DELETE SET NULL,
  execution_id TEXT REFERENCES job_executions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('inform', 'reassure', 'escalate', 'delight')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  conversation_id TEXT,
  session_chat_id TEXT,
  read_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proactive_notifications_created ON proactive_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_notifications_read ON proactive_notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_proactive_notifications_conversation ON proactive_notifications(conversation_id);
`;

// Proactivity Decision Engine: trigger_events, attention_candidates, attention_decisions, work_items, initiative_artifacts, attention_budget
export const DECISION_ENGINE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS trigger_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  job_name TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  conversation_id TEXT,
  project_slug TEXT,
  session_chat_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trigger_events_job ON trigger_events(job_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_created ON trigger_events(created_at DESC);

CREATE TABLE IF NOT EXISTS attention_candidates (
  id TEXT PRIMARY KEY,
  trigger_event_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_urgency TEXT NOT NULL CHECK (suggested_urgency IN ('low', 'normal', 'high', 'urgent')),
  dedupe_key TEXT NOT NULL,
  already_done TEXT,
  needs_attention TEXT,
  next_step TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attention_candidates_trigger ON attention_candidates(trigger_event_id);
CREATE INDEX IF NOT EXISTS idx_attention_candidates_dedupe ON attention_candidates(dedupe_key, created_at DESC);

CREATE TABLE IF NOT EXISTS attention_decisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  trigger_event_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ignore', 'bundle', 'notify', 'act_silently', 'delegate', 'escalate')),
  rationale TEXT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('orchestrator', 'project_agent', 'specialist_agent', 'waiting_on_user', 'completed', 'snoozed')),
  notification_id TEXT,
  work_item_id TEXT,
  criteria JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attention_decisions_candidate ON attention_decisions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_attention_decisions_created ON attention_decisions(created_at DESC);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  trigger_event_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  conversation_id TEXT,
  project_slug TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  completed_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_work_items_job ON work_items(job_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_created ON work_items(created_at DESC);

CREATE TABLE IF NOT EXISTS initiative_artifacts (
  id TEXT PRIMARY KEY,
  decision_id TEXT,
  work_item_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  ref TEXT NOT NULL,
  summary TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_initiative_artifacts_created ON initiative_artifacts(created_at DESC);

CREATE TABLE IF NOT EXISTS attention_budget (
  id TEXT PRIMARY KEY,
  max_proactive_messages_per_day INTEGER NOT NULL DEFAULT 20,
  quiet_hours_start INTEGER,
  quiet_hours_end INTEGER,
  bundle_related BOOLEAN NOT NULL DEFAULT TRUE,
  min_minutes_between_same_type_nudge INTEGER NOT NULL DEFAULT 60,
  prefer_silent_progress BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at BIGINT NOT NULL
);
INSERT INTO attention_budget (id, max_proactive_messages_per_day, bundle_related, min_minutes_between_same_type_nudge, prefer_silent_progress, updated_at)
VALUES ('default', 20, TRUE, 60, TRUE, 0)
ON CONFLICT (id) DO NOTHING;
`;
