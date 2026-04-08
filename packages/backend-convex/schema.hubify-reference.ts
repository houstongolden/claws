import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Materialized global counters (to avoid count/collect limits in queries)
  global_stats: defineTable({
    key: v.string(), // singleton key, e.g. "global"

    // Workspaces
    totalWorkspaces: v.optional(v.number()),
    lastWorkspaceCreatedAt: v.optional(v.number()),

    // Skills
    totalSkills: v.number(), // active skills
    totalSkillsByCategory: v.record(v.string(), v.number()),
    lastSkillIngestAt: v.optional(v.number()),

    // Executions (skill runs)
    totalExecutions: v.number(),
    successfulExecutions: v.number(),
    lastExecutionAt: v.optional(v.number()),

    // Learnings (execution feedback / improvements)
    totalLearnings: v.optional(v.number()),
    successfulLearnings: v.optional(v.number()),
    learningsByType: v.optional(v.record(v.string(), v.number())),
    lastLearningAt: v.optional(v.number()),

    // Memories (hub memories)
    totalMemories: v.optional(v.number()),
    lastMemoryAddedAt: v.optional(v.number()),

    // Hub Learnings (extracted learnings within hubs)
    totalHubLearnings: v.optional(v.number()),
    lastHubLearningAddedAt: v.optional(v.number()),

    // Contributors and agents
    uniqueAgents: v.optional(v.number()),
    activeAgents: v.optional(v.number()),
    uniquePlatforms: v.optional(v.number()),

    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Runtime feature flags & configuration (replaces hardcoded constants)
  platform_settings: defineTable({
    key: v.string(),
    value: v.union(v.boolean(), v.string(), v.number()),
    description: v.optional(v.string()),
    updated_at: v.number(),
    updated_by: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Souls table - AI personality and behavior templates (Layer 1)
  souls: defineTable({
    name: v.string(),
    role: v.string(),
    version: v.string(),
    description: v.string(),
    soul_md: v.string(),
    hubify_yaml: v.string(),
    domains: v.array(v.string()),
    personality_type: v.array(v.string()),
    use_cases: v.array(v.string()),
    author: v.string(),
    license: v.optional(v.string()),
    confidence: v.number(),
    usage_count: v.number(),
    agent_count: v.number(),
    success_rate: v.number(),
    community_rating: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("evolved"), v.literal("deprecated")),
    previous_version_id: v.optional(v.id("souls")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_domain", ["domains"])
    .index("by_status", ["status"])
    .searchIndex("search_souls", {
      searchField: "description",
      filterFields: ["status"],
    }),

  // Agent Personas — marketplace-grade agent profiles ("Agents for Hire")
  // Replaces the souls concept with reputation, ratings, and creator attribution
  agent_personas: defineTable({
    // Identity
    name: v.string(),
    display_name: v.string(),
    description: v.string(),
    persona_md: v.string(), // The SOUL.md content

    // Personality & capability
    role: v.string(),
    domains: v.array(v.string()),
    personality_type: v.array(v.string()),
    use_cases: v.array(v.string()),

    // Skills this persona comes with
    bundled_skills: v.optional(v.array(v.string())),

    // Heartbeat/proactive config
    heartbeat_config: v.optional(v.object({
      frequency: v.optional(v.string()), // e.g., "30m"
      proactive: v.optional(v.boolean()),
      behaviors: v.optional(v.array(v.string())),
    })),

    // Creator attribution
    author_type: v.union(v.literal("hubify"), v.literal("community")),
    author_user_id: v.optional(v.string()), // Clerk user ID for community personas
    author_username: v.optional(v.string()),

    // Marketplace metrics
    installs: v.number(),
    rating: v.number(), // 0-5 stars
    rating_count: v.number(),
    upvotes: v.number(),
    run_count: v.number(), // total runs across all workspaces
    contributions: v.number(), // collective insights shared by this persona type

    // Compatibility
    compatible_templates: v.optional(v.array(v.string())), // e.g., ["myos", "devos"]

    // Status
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("featured"), v.literal("deprecated")),
    verified: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),

    // Category for filtering
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),

    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_author", ["author_user_id"])
    .index("by_category", ["category"])
    .index("by_installs", ["installs"])
    .searchIndex("search_personas", {
      searchField: "description",
      filterFields: ["status", "category"],
    }),

  // Persona ratings — one per user per persona
  persona_ratings: defineTable({
    persona_id: v.id("agent_personas"),
    user_id: v.string(),
    rating: v.number(), // 1-5
    upvoted: v.boolean(),
    created_at: v.number(),
  })
    .index("by_persona", ["persona_id"])
    .index("by_user_persona", ["user_id", "persona_id"]),

  // Skills table - the core of the registry
  skills: defineTable({
    // Identity
    name: v.string(),
    version: v.string(),
    display_name: v.string(),
    description: v.string(),
    license: v.optional(v.string()),
    compatibility: v.optional(v.string()),

    // Content
    skill_md: v.string(),
    hubify_yaml: v.string(),
    has_scripts: v.boolean(),
    has_references: v.boolean(),
    has_assets: v.boolean(),
    scripts: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          content: v.string(),
        })
      )
    ),

    // Source
    origin: v.union(
      v.literal("agent"),
      v.literal("human"),
      v.literal("imported"),
      v.literal("generated")
    ),
    imported_from: v.optional(v.string()),
    original_url: v.optional(v.string()),
    author_agent_id: v.optional(v.string()),
    author_platform: v.optional(v.string()),

    // Lineage
    previous_version_id: v.optional(v.id("skills")),
    fork_of: v.optional(v.id("skills")),
    learnings_merged: v.number(),

    // Classification
    category: v.string(),
    subcategory: v.optional(v.string()),
    use_cases: v.array(v.string()),
    tool_calls: v.array(v.string()),
    integrations: v.array(v.string()),
    complexity: v.union(
      v.literal("basic"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
    platforms: v.array(v.string()),
    tags: v.array(v.string()),

    // Trust
    confidence: v.number(),
    executions: v.number(),
    success_rate: v.number(),
    unique_agents: v.number(),
    unique_platforms: v.number(),
    verification_level: v.number(),
    verified: v.boolean(),
    verified_confidence: v.optional(v.number()),
    trend: v.union(
      v.literal("improving"),
      v.literal("stable"),
      v.literal("declining")
    ),
    last_executed: v.optional(v.number()),

    // Intelligence & Evolution (ClawHub Phase 1)
    intelligence_score: v.optional(v.number()), // 0-100 composite score
    learning_trajectory: v.optional(v.union(
      v.literal("accelerating"),
      v.literal("steady"),
      v.literal("plateauing"),
      v.literal("declining")
    )),
    evolution_metadata: v.optional(v.object({
      total_evolutions: v.number(),
      last_evolution_date: v.optional(v.number()),
      evolution_velocity: v.optional(v.number()), // evolutions per month
      improvement_sources: v.optional(v.array(v.string())), // agent_ids who contributed
      auto_evolution_enabled: v.boolean(),
    })),

    // Labs: multi-parent evolution DAG
    evolution_parents: v.optional(v.array(v.id("skills"))),
    evolution_experiment_id: v.optional(v.id("experiment_nodes")),

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("canary"),
      v.literal("deprecated"),
      v.literal("rejected")
    ),
    canary_for: v.optional(v.id("skills")),
    canary_reports: v.optional(v.number()),
    canary_started: v.optional(v.number()),

    // GitHub Integration
    github_repo_url: v.optional(v.string()), // e.g., "https://github.com/owner/repo"
    github_metadata: v.optional(v.object({
      last_fetched: v.optional(v.number()), // timestamp
      contributors_count: v.optional(v.number()),
      prs_count: v.optional(v.number()),
      releases_count: v.optional(v.number()),
      stars: v.optional(v.number()),
      forks: v.optional(v.number()),
      language: v.optional(v.string()),
    })),

    // Security
    last_security_scan: v.optional(v.number()),
    security_score: v.optional(v.number()),
    security_scan_result: v.optional(v.object({
      scan_id: v.string(),
      scan_date: v.number(),
      malicious: v.number(),
      suspicious: v.number(),
      harmless: v.number(),
      undetected: v.number(),
      verdict: v.string(),
    })),

    // Search
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_name", ["name"])
    .index("by_name_version", ["name", "version"])
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .index("by_confidence", ["confidence"])
    .index("by_verification", ["verification_level"])
    .index("by_origin", ["origin"])
    .searchIndex("search_skills", {
      searchField: "description",
      filterFields: ["status", "category"],
    })
    .vectorIndex("vector_skills", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["status", "category"],
    }),

  // Learning logs - execution reports from agents
  learning_logs: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    skill_version: v.string(),
    agent_id: v.string(),
    platform: v.string(),
    result: v.union(
      v.literal("success"),
      v.literal("partial"),
      v.literal("fail")
    ),
    duration_ms: v.optional(v.number()),
    note: v.optional(v.string()),
    improvement: v.optional(v.string()),
    error_message: v.optional(v.string()),
    tools_used: v.optional(v.array(v.string())),
    llm: v.optional(v.string()),
    is_canary: v.boolean(),
    // Labs: link to experiment DAG node
    experiment_node_id: v.optional(v.id("experiment_nodes")),
  })
    .index("by_skill", ["skill_id"])
    .index("by_skill_name", ["skill_name"])
    .index("by_agent", ["agent_id"])
    .index("by_result", ["result"])
    .index("by_canary", ["is_canary", "skill_id"])
    .index("by_experiment_node", ["experiment_node_id"]),

  // Pending improvements - queued suggestions before evolution
  pending_improvements: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    agent_id: v.string(),
    improvement: v.string(),
    error_context: v.optional(v.string()),
    platform: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("grouped"),
      v.literal("drafting"),
      v.literal("resolved"),
      v.literal("rejected")
    ),
    group_id: v.optional(v.string()),
    resolved_in_version: v.optional(v.string()),
  })
    .index("by_skill", ["skill_id"])
    .index("by_status", ["status"]),

  // Learning submissions - Dogfood loop submissions (awaiting review)
  learnings_submissions: defineTable({
    // Reference to skill being learned about
    skill_id: v.id("skills"),

    // Submission metadata
    agent_id: v.string(),
    agent_platform: v.string(), // cli, claude-code, cursor, etc.
    learning_type: v.string(), // execution_feedback, bug_report, improvement, best_practice
    learning_summary: v.string(), // Main content (10-5000 chars)

    // Execution context
    success: v.boolean(),
    confidence_delta: v.number(), // -1 to 1, how much this changes skill confidence
    execution_count: v.number(), // How many executions this is based on
    duration_ms: v.optional(v.number()),
    error_message: v.optional(v.string()),

    // Additional metadata
    metadata: v.optional(v.any()),

    // Review lifecycle
    status: v.union(
      v.literal("submitted"), // Awaiting human review
      v.literal("reviewing"), // Currently under review
      v.literal("approved"), // Approved and ready to merge
      v.literal("rejected") // Rejected by reviewer
    ),

    // Timestamps and reviewer info
    submitted_at: v.number(),
    reviewed_at: v.optional(v.number()),
    reviewer_id: v.optional(v.string()), // Agent or user ID of reviewer
    review_notes: v.optional(v.string()), // Why approved/rejected
  })
    .index("by_skill", ["skill_id"])
    .index("by_agent", ["agent_id"])
    .index("by_status", ["status"])
    .index("by_skill_status", ["skill_id", "status"]),

  // Agents - registered agent profiles
  agents: defineTable({
    // Core identity (machine-generated)
    agent_id: v.string(),
    platform: v.string(),
    public_key: v.optional(v.string()),

    // Profile identity (agent-managed)
    username: v.string(),           // @code-wizard (unique, URL-safe)
    display_name: v.string(),       // "Code Wizard"
    avatar: v.optional(v.string()), // URL or emoji identifier
    bio: v.optional(v.string()),    // Agent-written bio (max 500 chars)
    website: v.optional(v.string()),
    agent_type: v.optional(v.string()), // "coding", "data", "creative", "productivity"
    capabilities: v.array(v.string()),  // ["python", "api-design", "testing"]
    
    // Email & communication
    email_address: v.optional(v.string()),
    agentmail_inbox_id: v.optional(v.string()),
    timezone: v.optional(v.string()),

    // Human owner (optional visibility)
    owner_username: v.optional(v.string()),  // @houstongolden
    owner_user_id: v.optional(v.string()),   // User ID for verification
    show_owner: v.boolean(),                  // Display owner publicly

    // Soul & personality
    active_soul_id: v.optional(v.id("souls")),
    active_soul_name: v.optional(v.string()),
    
    // Memory & context
    memory: v.optional(v.object({
      collaborators: v.optional(v.array(v.any())),
      domain_beliefs: v.optional(v.array(v.any())),
      learned_patterns: v.optional(v.array(v.any())),
      specialization_focus: v.optional(v.string()),
      last_reflection_at: v.optional(v.number()),
    })),

    // Trust & reputation
    reputation: v.number(),
    verified: v.boolean(),           // Human-verified agent
    verification_level: v.number(),  // 0-5 trust level

    // Publishing stats
    skills_published: v.number(),
    total_downloads: v.number(),
    total_stars: v.number(),

    // Activity metrics
    report_count: v.optional(v.number()),
    reports_submitted: v.number(),
    successful_reports: v.number(),
    accuracy_score: v.number(),
    canary_opt_in: v.boolean(),

    // Streak & gamification
    current_streak: v.optional(v.number()),
    longest_streak: v.optional(v.number()),
    streak_updated_at: v.optional(v.number()),

    // Badges & achievements
    badges: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      tier: v.optional(v.number()),
      earned_at: v.optional(v.number()),
    }))),

    // Timestamps
    first_seen: v.number(),
    last_active: v.number(),
    profile_updated: v.optional(v.number()),
    platforms_used: v.optional(v.array(v.string())),
  })
    .index("by_agent_id", ["agent_id"])
    .index("by_username", ["username"])
    .index("by_platform", ["platform"])
    .index("by_reputation", ["reputation"])
    .index("by_owner", ["owner_username"])
    .searchIndex("search_agents", {
      searchField: "bio",
      filterFields: ["agent_type", "verified"],
    }),

  // Agent stars - agents starring skills
  agent_stars: defineTable({
    agent_id: v.id("agents"),
    skill_id: v.id("skills"),
    starred_at: v.number(),
  })
    .index("by_agent", ["agent_id"])
    .index("by_skill", ["skill_id"])
    .index("by_agent_skill", ["agent_id", "skill_id"]),

  // Chains - workflow chain definitions
  chains: defineTable({
    name: v.string(),
    description: v.string(),
    version: v.string(),
    author_agent_id: v.string(),
    steps: v.array(
      v.object({
        id: v.string(),
        skill_name: v.string(),
        config: v.optional(v.any()),
        depends_on: v.array(v.string()),
        on_fail: v.union(
          v.literal("skip"),
          v.literal("abort"),
          v.literal("retry")
        ),
      })
    ),
    executions: v.number(),
    success_rate: v.number(),
    status: v.union(v.literal("active"), v.literal("deprecated")),
  }).index("by_name", ["name"]),

  // Platforms - verified platform registry
  platforms: defineTable({
    name: v.string(),
    display_name: v.string(),
    url: v.optional(v.string()),
    verified: v.boolean(),
    agent_count: v.number(),
    skill_count: v.number(),
  }).index("by_name", ["name"]),

  // Security logs - for auditing
  security_logs: defineTable({
    event_type: v.string(),
    agent_id: v.optional(v.string()),
    skill_id: v.optional(v.id("skills")),
    details: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
  }),

  // Executions - detailed execution tracking for analytics
  executions: defineTable({
    skillId: v.id("skills"),
    skillName: v.string(),
    skillVersion: v.string(),
    agentId: v.string(),
    agentPlatform: v.string(), // "claude-code", "cursor", "windsurf", "sdk"
    success: v.boolean(),
    duration_ms: v.optional(v.number()),
    error: v.optional(v.string()),
    context: v.optional(v.object({
      project_type: v.optional(v.string()),
      file_count: v.optional(v.number()),
    })),
    timestamp: v.number(),
  })
    .index("by_skill", ["skillId"])
    .index("by_agent", ["agentId"])
    .index("by_platform", ["agentPlatform"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================================
  // Phase 2: Workflows & Orchestration
  // ============================================================================

  // Workflows - Multi-step workflow definitions
  workflows: defineTable({
    name: v.string(),
    display_name: v.string(),
    description: v.string(),
    version: v.string(),
    author: v.string(),
    category: v.string(), // "deployment", "testing", "documentation", "data", "content"

    // Steps in the workflow
    steps: v.array(v.object({
      id: v.string(),
      name: v.string(),
      skill_name: v.optional(v.string()), // Optional - could be manual or soul-based
      soul_name: v.optional(v.string()),  // Soul to use for this step
      description: v.string(),
      inputs: v.array(v.object({
        name: v.string(),
        type: v.string(),
        from_step: v.optional(v.string()), // Output from another step
        default: v.optional(v.string()),
        required: v.boolean(),
      })),
      outputs: v.array(v.object({
        name: v.string(),
        type: v.string(),
      })),
      depends_on: v.array(v.string()), // Step IDs this depends on
      on_fail: v.union(v.literal("skip"), v.literal("abort"), v.literal("retry"), v.literal("fallback")),
      fallback_step: v.optional(v.string()),
      timeout_ms: v.optional(v.number()),
      retries: v.optional(v.number()),
    })),

    // Metadata
    tags: v.array(v.string()),
    estimated_duration_ms: v.optional(v.number()),
    requires_approval: v.boolean(),

    // Trust metrics
    executions: v.number(),
    success_rate: v.number(),
    avg_duration_ms: v.optional(v.number()),

    status: v.union(v.literal("draft"), v.literal("active"), v.literal("deprecated")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .searchIndex("search_workflows", {
      searchField: "description",
      filterFields: ["status", "category"],
    }),

  // Workflow Runs - Execution history
  workflow_runs: defineTable({
    workflow_id: v.id("workflows"),
    workflow_name: v.string(),
    workflow_version: v.string(),
    started_by: v.string(), // Agent or user ID
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    current_step: v.optional(v.string()),

    // Step execution details
    step_results: v.array(v.object({
      step_id: v.string(),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("skipped")),
      started_at: v.optional(v.number()),
      completed_at: v.optional(v.number()),
      outputs: v.optional(v.any()),
      error: v.optional(v.string()),
      agent_id: v.optional(v.string()),
    })),

    // Inputs provided at start
    inputs: v.optional(v.any()),
    // Final outputs
    outputs: v.optional(v.any()),
    error: v.optional(v.string()),
  })
    .index("by_workflow", ["workflow_id"])
    .index("by_status", ["status"])
    .index("by_started_at", ["started_at"]),

  // Research missions - collaborative research initiatives
  research_missions: defineTable({
    title: v.string(),
    description: v.string(),
    hub_id: v.optional(v.id("hubs")),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("cancelled")
    ),
    phase: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.optional(v.number()),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    agent_count: v.optional(v.number()),
    findings_count: v.optional(v.number()),
    confidence: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),

    // Fields used by research.ts mutations/queries
    mission_type: v.optional(v.union(
      v.literal("technical"),
      v.literal("comparative"),
      v.literal("diagnostic"),
      v.literal("exploratory"),
      v.literal("scientific")
    )),
    research_question: v.optional(v.string()),
    methodology: v.optional(v.string()),
    proposed_by: v.optional(v.string()),
    approved_by: v.optional(v.string()),
    lead_agent_id: v.optional(v.string()),
    collaborators: v.optional(v.array(v.object({
      agent_id: v.string(),
      role: v.union(v.literal("collaborator"), v.literal("reviewer")),
      joined_at: v.number(),
    }))),
    estimated_duration_hours: v.optional(v.number()),
    max_executions: v.optional(v.number()),
    max_collaborators: v.optional(v.number()),
    phases: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("active"), v.literal("completed")),
      started_at: v.optional(v.number()),
      completed_at: v.optional(v.number()),
    }))),
    current_phase: v.optional(v.string()),
    conclusion: v.optional(v.string()),
    findings: v.optional(v.any()),
    last_activity_at: v.optional(v.number()),

    // Model & squad config for mission execution
    model_config: v.optional(v.object({
      provider: v.string(),
      model: v.string(),
      temperature: v.optional(v.number()),
      max_tokens: v.optional(v.number()),
    })),
    squad_config: v.optional(v.object({
      mode: v.string(),
      agent_ids: v.optional(v.array(v.string())),
      custom_agents: v.optional(v.array(v.object({
        name: v.string(),
        role: v.string(),
        soul_md: v.optional(v.string()),
        agent_md: v.optional(v.string()),
        tools_md: v.optional(v.string()),
      }))),
    })),

    // Labs: experiment DAG configuration
    experiment_config: v.optional(v.object({
      enabled: v.boolean(),
      primary_metric: v.string(),
      metric_direction: v.union(v.literal("minimize"), v.literal("maximize")),
      budget_minutes_per_experiment: v.number(),
      max_experiments: v.number(),
      time_budget_hours: v.number(),
      max_cost_usd: v.number(),
      minimum_improvement_threshold: v.number(),
      claim_ttl_minutes: v.number(),
      experiments_completed: v.number(),
      cost_spent_usd: v.number(),
      best_metric_value: v.optional(v.number()),
      best_node_id: v.optional(v.id("experiment_nodes")),
    })),
  })
    .index("by_status", ["status"])
    .index("by_created_by", ["created_by"])
    .index("by_hub", ["hub_id"])
    .index("by_activity", ["started_at"])
    .index("by_lead", ["lead_agent_id"]),

  // Squads - Agent team compositions
  squads: defineTable({
    name: v.string(),
    display_name: v.string(),
    description: v.string(),

    // Hub linkage (optional — links squad to a hub for research queries)
    hub_id: v.optional(v.id("hubs")),

    // Team members - souls with specific roles
    members: v.array(v.object({
      role: v.string(), // "lead", "specialist", "reviewer", "executor"
      soul_name: v.string(),
      responsibilities: v.array(v.string()),
      can_approve: v.boolean(),
      required: v.boolean(),
    })),

    // Member configurations with compute specs
    member_configs: v.optional(v.array(v.object({
      agent_id: v.string(),
      soul_name: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
      compute_class: v.optional(v.string()),
    }))),

    // Team configuration
    communication_style: v.union(
      v.literal("hierarchical"), // Lead coordinates
      v.literal("collaborative"), // All members equal
      v.literal("parallel") // Work independently
    ),
    decision_mode: v.union(
      v.literal("lead"), // Lead makes decisions
      v.literal("consensus"), // All must agree
      v.literal("majority") // Vote-based
    ),

    // Compute environment (optional — for VPS/terminal info)
    compute_environment: v.optional(v.any()),

    // Standup configuration
    standup_config: v.optional(v.object({
      enabled: v.boolean(),
      frequency_hours: v.optional(v.number()),
      last_standup_at: v.optional(v.number()),
    })),

    // Use cases
    domains: v.array(v.string()),
    use_cases: v.array(v.string()),

    // Metrics
    missions_completed: v.number(),
    success_rate: v.number(),
    avg_mission_duration_ms: v.optional(v.number()),

    // Pack/template info
    pack_id: v.optional(v.string()),
    pack_version: v.optional(v.string()),

    author: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("deprecated")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"])
    .index("by_hub", ["hub_id"])
    .searchIndex("search_squads", {
      searchField: "description",
      filterFields: ["status"],
    }),

  // Squad Missions - Squad execution history
  squad_missions: defineTable({
    squad_id: v.id("squads"),
    squad_name: v.string(),
    mission_name: v.string(),
    description: v.string(),
    started_by: v.string(),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    priority: v.optional(v.string()),
    research_mission_id: v.optional(v.id("research_missions")),
    status: v.union(
      v.literal("planning"),
      v.literal("executing"),
      v.literal("reviewing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),

    // Agent assignments
    assignments: v.array(v.object({
      member_role: v.string(),
      agent_id: v.string(),
      tasks_assigned: v.number(),
      tasks_completed: v.number(),
    })),

    // Phases & objectives
    current_phase: v.optional(v.string()),
    phases: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("active"), v.literal("completed")),
      started_at: v.optional(v.number()),
      completed_at: v.optional(v.number()),
    }))),
    objectives: v.optional(v.array(v.object({
      id: v.string(),
      description: v.string(),
      status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("failed"), v.literal("met")),
      evidence: v.optional(v.string()),
    }))),

    // Mission results
    artifacts: v.optional(v.array(v.object({
      name: v.string(),
      type: v.string(),
      content: v.optional(v.string()),
      url: v.optional(v.string()),
    }))),

    notes: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_squad", ["squad_id"])
    .index("by_status", ["status"])
    .index("by_started_at", ["started_at"]),

  // ============================================================================
  // Phase 2: Skill Generation
  // ============================================================================

  // Generated Skills Queue - Skills being generated from sources
  skill_generations: defineTable({
    source_type: v.union(
      v.literal("documentation"),
      v.literal("github"),
      v.literal("stackoverflow"),
      v.literal("prompt"),
      v.literal("composition")
    ),
    source_url: v.optional(v.string()),
    source_content: v.optional(v.string()),
    prompt: v.optional(v.string()),

    // Generation status
    status: v.union(
      v.literal("queued"),
      v.literal("analyzing"),
      v.literal("generating"),
      v.literal("reviewing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("rejected")
    ),

    // Generated skill details
    generated_skill_name: v.optional(v.string()),
    generated_skill_md: v.optional(v.string()),
    generated_hubify_yaml: v.optional(v.string()),

    // Metadata
    requested_by: v.string(),
    requested_at: v.number(),
    completed_at: v.optional(v.number()),
    skill_id: v.optional(v.id("skills")), // Created skill ID

    // Review
    reviewed_by: v.optional(v.string()),
    review_notes: v.optional(v.string()),
    confidence_score: v.optional(v.number()),

    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_requested_at", ["requested_at"]),

  // ============================================================================
  // Phase 3: Private Registries
  // ============================================================================

  // Organizations - Private registry owners
  organizations: defineTable({
    name: v.string(),
    display_name: v.string(),
    description: v.optional(v.string()),

    // Settings
    settings: v.object({
      allow_public_skills: v.boolean(),
      require_approval: v.boolean(),
      auto_evolve: v.boolean(),
      default_license: v.optional(v.string()),
    }),

    // Billing
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("team"), v.literal("enterprise")),
    stripe_customer_id: v.optional(v.string()),

    // Metrics
    members_count: v.number(),
    skills_count: v.number(),
    souls_count: v.number(),

    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"]),

  // Organization Members
  org_members: defineTable({
    org_id: v.id("organizations"),
    user_id: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer")),
    invited_by: v.optional(v.string()),
    joined_at: v.number(),
  })
    .index("by_org", ["org_id"])
    .index("by_user", ["user_id"]),

  // Private Skills - Organization-specific skills
  private_skills: defineTable({
    org_id: v.id("organizations"),
    skill_id: v.id("skills"),
    visibility: v.union(v.literal("org"), v.literal("team"), v.literal("private")),
    approved_by: v.optional(v.string()),
    approved_at: v.optional(v.number()),
  })
    .index("by_org", ["org_id"])
    .index("by_skill", ["skill_id"]),

  // Learnings - Agent execution learnings for skill improvement
  learnings: defineTable({
    skill_id: v.id("skills"),
    agent_id: v.string(),
    agent_platform: v.string(), // "claude-code", "cursor", "windsurf", etc.
    learning_type: v.string(), // "execution_feedback", "bug_report", "improvement", "best_practice", etc.
    learning_summary: v.string(),
    success: v.boolean(),
    confidence_delta: v.optional(v.number()),
    execution_count: v.optional(v.number()),
    duration_ms: v.optional(v.number()),
    error_message: v.optional(v.string()),
    metadata: v.optional(v.any()), // Now includes verification data: attestation, verification_level, verification_notes
    created_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_agent", ["agent_id"])
    .index("by_platform", ["agent_platform"])
    .index("by_type", ["learning_type"])
    .index("by_created_at", ["created_at"])
    .index("by_skill_type", ["skill_id", "learning_type"]),

  // Verification Challenges - Random sampling to verify execution claims
  verification_challenges: defineTable({
    learning_id: v.id("learnings"),
    agent_id: v.string(),
    challenge_type: v.string(), // "output_verification", "re_execution", "environment_check"
    challenge_data: v.any(), // Challenge-specific data (questions, expected patterns)
    status: v.union(
      v.literal("pending"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("expired")
    ),
    response: v.optional(v.any()), // Agent's response to the challenge
    created_at: v.number(),
    expires_at: v.number(),
    responded_at: v.optional(v.number()),
  })
    .index("by_agent", ["agent_id"])
    .index("by_status", ["status"])
    .index("by_learning", ["learning_id"]),

  // Tools - Standardized tool registry (Layer 3)
  tools: defineTable({
    canonical_name: v.string(),
    display_name: v.string(),
    version: v.string(),
    category: v.string(),
    domains: v.array(v.string()),
    description: v.string(),
    integrations: v.array(v.object({
      app: v.string(),
      display_name: v.string(),
      methods: v.array(v.object({
        type: v.union(v.literal("oauth2"), v.literal("mcp"), v.literal("api_key"), v.literal("webhook")),
        scope: v.optional(v.array(v.string())),
        server_name: v.optional(v.string()),
        docs_url: v.optional(v.string()),
      })),
      verified: v.boolean(),
    })),
    parameters: v.array(v.object({
      name: v.string(),
      type: v.string(),
      required: v.boolean(),
      default_value: v.optional(v.string()),
      description: v.string(),
    })),
    platform_mappings: v.array(v.object({
      platform: v.string(),
      tool_name: v.string(),
      verified: v.boolean(),
    })),
    status: v.union(v.literal("active"), v.literal("deprecated")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_canonical_name", ["canonical_name"])
    .index("by_category", ["category"])
    .searchIndex("search_tools", {
      searchField: "description",
      filterFields: ["status", "category"],
    }),

  // Sync Runs - Track external registry sync operations
  sync_runs: defineTable({
    source: v.string(), // "anthropic", "skillssh", "clawhub", "github"
    sync_type: v.union(v.literal("full"), v.literal("incremental"), v.literal("on_demand")),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    skills_checked: v.number(),
    skills_added: v.number(),
    skills_updated: v.number(),
    skills_unchanged: v.number(),
    skills_failed: v.optional(v.number()),
    errors: v.array(v.string()),
  })
    .index("by_source", ["source"])
    .index("by_status", ["status"])
    .index("by_started_at", ["started_at"]),

  // Evolution Triggers - Track when skills need evolution
  evolution_triggers: defineTable({
    skill_id: v.id("skills"),
    trigger_type: v.string(), // "confidence_decline", "high_failure_rate", "improvement_threshold", "error_pattern"
    details: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("resolved"),
      v.literal("dismissed")
    ),
    resolved_version: v.optional(v.string()),
    created_at: v.number(),
    resolved_at: v.optional(v.number()),
  })
    .index("by_skill", ["skill_id"])
    .index("by_status", ["status"])
    .index("by_type", ["trigger_type"]),

  // Evolution Events - Audit trail for auto-evolution
  evolution_events: defineTable({
    skill_id: v.id("skills"),
    canary_id: v.optional(v.id("skills")),
    event_type: v.string(), // "auto_draft_created", "canary_promoted", "canary_rejected", etc.
    details: v.any(),
    timestamp: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_canary", ["canary_id"])
    .index("by_timestamp", ["timestamp"]),

  // ============================================================================
  // Hubify Core: Hub, Memory, Learnings, Vault (MVP)
  // ============================================================================

  // Users - Account profiles with subscription tier
  users: defineTable({
    // Identity
    id: v.optional(v.string()),           // user_123 - optional since _id is auto-generated
    email: v.string(),
    username: v.string(),     // Display username (different from subdomain)

    // Subscription
    plan: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("team"),
      v.literal("enterprise")
    ),
    stripe_customer_id: v.optional(v.string()),
    stripe_subscription_id: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing")
    )),
    planId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),

    // Workspace limits (based on plan)
    max_workspaces: v.optional(v.number()), // 1 for free, 3 for pro, 10 for team, unlimited for enterprise
    workspace_count: v.optional(v.number()), // Current workspace count

    // Profile
    display_name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    github_username: v.optional(v.string()),

    // Agents & workspace
    agent_ids: v.optional(v.array(v.string())),
    max_agents: v.optional(v.number()),
    activeWorkspaceId: v.optional(v.id("hubs")), // Currently active/selected workspace for multi-workspace support

    // OAuth
    oauth_provider: v.optional(v.string()),
    oauth_id: v.optional(v.string()),

    // Clerk identity (replaces next-auth session)
    clerk_user_id: v.optional(v.string()),
    
    // SECURITY: User role (controls provisioning and admin capabilities)
    role: v.optional(v.union(
      v.literal("user"),         // Standard user - cannot provision clusters
      v.literal("agency_admin"), // Agency admin - can provision clusters for their agency
      v.literal("system_admin")  // System admin - can provision any cluster (emergency only)
    )),
    
    // Activity
    last_login: v.optional(v.number()),

    // SECURITY: Email verification
    email_verified: v.optional(v.boolean()),

    // 2FA / Security Settings
    totp_enabled: v.optional(v.boolean()),
    totp_secret_encrypted: v.optional(v.string()), // AES-256 encrypted TOTP secret
    backup_codes: v.optional(v.array(v.string())), // One-time backup codes
    passkey_enabled: v.optional(v.boolean()),
    last_2fa_setup: v.optional(v.number()), // Timestamp of last 2FA setup

    // User Settings - Preferences: theme, language, notifications, privacy
    settings: v.optional(v.object({
      theme: v.union(
        v.literal("light"),
        v.literal("dark"),
        v.literal("system")
      ),
      language: v.string(),
      notifications: v.object({
        email: v.boolean(),
        sms: v.boolean(),
        push: v.boolean(),
      }),
      privacy: v.object({
        profileVisibility: v.union(
          v.literal("public"),
          v.literal("private")
        ),
        dataCollection: v.boolean(),
      }),
    })),

    // Timestamps
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_oauth", ["oauth_provider", "oauth_id"])
    .index("by_clerk_user_id", ["clerk_user_id"])
    .index("by_stripe_customer_id", ["stripe_customer_id"])
    .index("by_stripe_subscription_id", ["stripe_subscription_id"]),

  // SECURITY: Agencies table for hubify-sec-021 ownership check
  // Tracks which users/teams own agencies and can provision clusters
  agencies: defineTable({
    // Identity
    name: v.string(),
    description: v.optional(v.string()),
    
    // Ownership
    owner_user_id: v.string(), // Primary owner (Clerk user ID)
    admin_user_ids: v.array(v.string()), // Additional admins who can provision
    
    // Metadata
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_owner", ["owner_user_id"])
    .index("by_admin", ["admin_user_ids"]),

  // SECURITY: Audit log for provisioning attempts
  // hubify-sec-021: Track all agency provisioning attempts for audit trail
  provisioning_audit_log: defineTable({
    // Request context
    requester_user_id: v.string(),       // Who made the request
    requester_email: v.string(),         // Email of requester (snapshot)
    agency_id: v.string(),               // Agency being provisioned for
    workspace_name: v.string(),
    client_email: v.string(),
    
    // Authorization
    authorization_status: v.union(
      v.literal("authorized"),           // User is owner or admin
      v.literal("unauthorized"),         // User lacks permission
      v.literal("forbidden_role")        // User role doesn't allow provisioning
    ),
    
    // Details
    denied_reason: v.optional(v.string()),
    workspace_id: v.optional(v.string()),
    fly_machine_id: v.optional(v.string()),
    
    // Timestamps
    timestamp: v.number(),
  })
    .index("by_requester", ["requester_user_id"])
    .index("by_agency", ["agency_id"])
    .index("by_timestamp", ["timestamp"])
    .index("by_status", ["authorization_status"]),

  // Hubs - Project-level intelligence manifest
  hubs: defineTable({
    // Identity
    name: v.string(),
    display_name: v.optional(v.string()),
    description: v.optional(v.string()),
    hub_type: v.optional(v.union(
      v.literal("workspace"),
      v.literal("research-lab"),
      v.literal("community"),
      v.literal("meta"),
      v.literal("platform"),
      v.literal("domain"),
      v.literal("skill")
    )),
    owner_id: v.optional(v.string()),

    // Workspace provisioning (Phase 1)
    subdomain: v.optional(v.string()),           // e.g., "houston.hubify.com"
    template: v.optional(v.string()),             // e.g., "myos", "devos", "founderos"
    workspace_image: v.optional(v.string()),      // Docker image URL; defaults to WORKSPACE_IMAGE env var
    status: v.optional(v.union(
      v.literal("provisioning"),
      v.literal("starting"),
      v.literal("active"),
      v.literal("sleeping"),
      v.literal("error")
    )),
    fly_machine_id: v.optional(v.string()),       // Fly.io machine ID
    fly_app_name: v.optional(v.string()),         // e.g., "hubify-ws-houston"

    // Agents connected to this hub
    agents: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      platform: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
      active: v.boolean(),
      last_active: v.optional(v.number()),
    }))),

    // Metadata & content stats
    tags: v.optional(v.array(v.string())),
    knowledge_count: v.optional(v.number()),
    post_count: v.optional(v.number()),
    contributor_count: v.optional(v.number()),
    domain: v.optional(v.string()),
    slug: v.optional(v.string()),
    parent_hub_id: v.optional(v.id("hubs")),
    created_by: v.optional(v.string()),
    last_activity_at: v.optional(v.number()),
    aggregate_confidence: v.optional(v.number()),
    maintainer_agent_ids: v.optional(v.array(v.string())),

    // Privacy & global opt-in
    privacy_global_opt_in: v.optional(v.boolean()),

    // Workspace Isolation Controls (Phase 4)
    isolationSettings: v.optional(v.object({
      sharedVault: v.boolean(),         // Vault shared across all workspaces
      // Intelligence scope: isolated (this workspace only), org (same account), global (opt-in anonymized)
      intelligenceScope: v.optional(v.union(
        v.literal("isolated"),
        v.literal("org"),
        v.literal("global")
      )),
      // Legacy field (kept for backward compatibility)
      sharedIntelligence: v.optional(v.boolean()),
      updatedAt: v.number(),
    })),

    // GitHub Repo Sync
    github_sync: v.optional(v.object({
      repo_url: v.string(),
      branch: v.optional(v.string()),
      connected_at: v.number(),
      last_sync_at: v.optional(v.number()),
      last_sync_type: v.optional(v.union(
        v.literal("push"), v.literal("pull"), v.literal("init")
      )),
    })),

    // Telegram Integration (Phase 5)
    telegram_config: v.optional(v.object({
      enabled: v.boolean(),
      bot_token: v.optional(v.string()),        // Encrypted bot token
      chat_id: v.optional(v.string()),          // Default chat ID for notifications
      connected_at: v.optional(v.number()),     // When integration was first connected
      last_tested_at: v.optional(v.number()),   // Last successful test
      test_status: v.optional(v.union(
        v.literal("pending"),
        v.literal("success"),
        v.literal("failed")
      )),
      test_error: v.optional(v.string()),       // Last error message from test
    })),

    // Research Lab Configuration (Pillar 1)
    research_config: v.optional(v.object({
      parent_workspace_id: v.optional(v.id("hubs")),
      compute_tier: v.union(v.literal("e2b"), v.literal("fly"), v.literal("runpod")),
      mission_ids: v.array(v.id("research_missions")),
      auto_publish_findings: v.boolean(),
      budget_hours: v.optional(v.number()),
      budget_usd: v.optional(v.number()),
    })),

    // Vault reference
    vault_id: v.optional(v.string()),

    // Timezone for cron scheduling (e.g. "America/Los_Angeles")
    timezone: v.optional(v.string()),

    // Mode switching (AI OS modes)
    active_mode: v.optional(v.string()), // e.g., "personal", "founder", "dev", "research"
    active_persona_id: v.optional(v.id("agent_personas")),

    // Template update tracking
    template_version: v.optional(v.string()), // Current installed version
    template_update_available: v.optional(v.string()), // Available version if newer

    // Theme configuration (overrides template defaults)
    theme_config: v.optional(
      v.object({
        theme_id: v.string(), // Theme ID from themes.ts (e.g., "dark", "synthwave", "nord")
        accent: v.string(), // Hex color (e.g., "#D4A574")
        monogram: v.optional(v.string()),
        panels: v.optional(v.array(v.object({
          id: v.string(),
          visible: v.boolean(),
          position: v.number(),
          size: v.string(),
        }))),
        sidebar_panels: v.optional(v.array(v.object({
          id: v.string(),
          visible: v.boolean(),
          position: v.number(),
        }))),
      })
    ),

    // Timestamps
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_owner", ["owner_id"])
    .index("by_name", ["name"])
    .index("by_subdomain", ["subdomain"])
    .index("by_status", ["status"])
    .index("by_domain", ["domain"])
    .index("by_slug", ["slug"])
    .index("by_activity", ["last_activity_at"])
    .index("by_parent_hub", ["parent_hub_id"])
    .index("by_type", ["hub_type"])
    .searchIndex("search_hubs", {
      searchField: "description",
      filterFields: ["hub_type", "domain", "status"],
    }),

  // Memory - Cross-platform shared memory (episodic, semantic, procedural)
  memory: defineTable({
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    platform: v.string(),

    // Memory type
    type: v.union(
      v.literal("episodic"),   // Time-based events
      v.literal("semantic"),   // Knowledge/concepts
      v.literal("procedural")  // Skills/how-to
    ),

    // Content
    content: v.string(),
    tags: v.array(v.string()),

    // Vector embedding (for semantic search, 1536 dims)
    embedding: v.optional(v.array(v.float64())),

    // Lifecycle
    created_at: v.number(),
    updated_at: v.number(),
    expires_at: v.optional(v.number()),
  })
    .index("by_hub", ["hub_id"])
    .index("by_agent", ["agent_id"])
    .index("by_type", ["type"])
    .index("by_hub_type", ["hub_id", "type"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["hub_id", "type"],
    }),

  // Hub Learnings - Cross-platform learnings extracted within a hub
  hub_learnings: defineTable({
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    platform: v.string(),

    // Content
    content: v.string(),
    tags: v.array(v.string()),

    // Quality metrics
    confidence: v.number(), // 0-1
    contribute_to_global: v.boolean(),

    // Validation
    validated_by: v.array(v.string()),
    contradiction_count: v.number(),

    // Timestamp
    created_at: v.number(),
  })
    .index("by_hub", ["hub_id"])
    .index("by_agent", ["agent_id"])
    .index("by_confidence", ["confidence"])
    .index("by_hub_confidence", ["hub_id", "confidence"]),

  // Vault - Encrypted tool credentials
  vault: defineTable({
    hub_id: v.id("hubs"),
    owner_id: v.string(),

    // Vault entries
    entries: v.array(v.object({
      id: v.string(),
      type: v.union(
        v.literal("mcp"),
        v.literal("api_key"),
        v.literal("oauth_token")
      ),
      service: v.string(),
      encrypted_config: v.string(), // AES-256 encrypted
      granted_agents: v.array(v.string()),
      last_accessed: v.optional(v.number()),
      access_log: v.array(v.object({
        agent_id: v.string(),
        timestamp: v.number(),
        operation: v.string(),
      })),
    })),

    // Metadata
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_hub", ["hub_id"])
    .index("by_owner", ["owner_id"]),

  // ============================================================================
  // ClawHub Phase 1: Collaborative Sessions & Skill Dependencies
  // ============================================================================

  // Collaborative Sessions - Real-time multi-agent collaboration on skills
  collaborative_sessions: defineTable({
    // Session identity
    session_id: v.string(),
    name: v.string(),
    description: v.optional(v.string()),

    // Target skill(s) being worked on
    skill_id: v.optional(v.id("skills")),
    skill_name: v.optional(v.string()),

    // Session type
    session_type: v.union(
      v.literal("skill_improvement"), // Improving an existing skill
      v.literal("skill_creation"),    // Creating a new skill together
      v.literal("debugging"),         // Collaborative debugging
      v.literal("review"),            // Code/skill review session
      v.literal("learning")           // Learning/teaching session
    ),

    // Participants
    host_agent_id: v.string(),
    participants: v.array(v.object({
      agent_id: v.string(),
      role: v.union(
        v.literal("host"),
        v.literal("contributor"),
        v.literal("reviewer"),
        v.literal("observer")
      ),
      joined_at: v.number(),
      left_at: v.optional(v.number()),
      contributions: v.number(),
    })),

    // Session state
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("abandoned")
    ),

    // Collaboration metrics
    total_contributions: v.number(),
    consensus_reached: v.boolean(),
    final_decision: v.optional(v.string()),

    // Artifacts produced
    artifacts: v.optional(v.array(v.object({
      type: v.string(), // "improvement", "patch", "documentation", "test"
      content: v.string(),
      author_agent_id: v.string(),
      approved_by: v.optional(v.array(v.string())),
    }))),

    // Timestamps
    started_at: v.number(),
    ended_at: v.optional(v.number()),
    last_activity_at: v.number(),
  })
    .index("by_session_id", ["session_id"])
    .index("by_skill", ["skill_id"])
    .index("by_host", ["host_agent_id"])
    .index("by_status", ["status"])
    .index("by_type", ["session_type"]),

  // Skill Dependencies - Graph of skill relationships
  skill_dependencies: defineTable({
    // Source skill (the one that depends)
    skill_id: v.id("skills"),
    skill_name: v.string(),

    // Dependency type
    dependency_type: v.union(
      v.literal("requires"),      // Must be installed first
      v.literal("extends"),       // Builds upon functionality
      v.literal("recommends"),    // Works better with
      v.literal("conflicts"),     // Cannot be used together
      v.literal("replaces"),      // Supersedes another skill
      v.literal("fork_of"),       // Forked from another skill
      v.literal("inspired_by")    // Conceptually derived from
    ),

    // Target skill (the dependency)
    depends_on_skill_id: v.optional(v.id("skills")), // If internal skill
    depends_on_skill_name: v.string(),               // Always populated
    depends_on_version: v.optional(v.string()),      // Specific version constraint
    depends_on_external_url: v.optional(v.string()), // If external skill

    // Dependency metadata
    is_optional: v.boolean(),
    version_constraint: v.optional(v.string()), // semver constraint like ">=1.0.0"
    reason: v.optional(v.string()),             // Why this dependency exists

    // Validation
    validated: v.boolean(),
    last_validated_at: v.optional(v.number()),
    validation_status: v.optional(v.union(
      v.literal("valid"),
      v.literal("broken"),       // Dependency not found
      v.literal("version_mismatch"),
      v.literal("circular")      // Part of circular dependency
    )),

    // Metadata
    added_by: v.string(),        // Agent or user who declared this
    added_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_depends_on", ["depends_on_skill_id"])
    .index("by_type", ["dependency_type"])
    .index("by_skill_name", ["skill_name"])
    .index("by_depends_on_name", ["depends_on_skill_name"]),

  // ============================================================================
  // ClawHub Phase 4: Social & Moderation Features
  // ============================================================================

  // Comments - Comments and replies on skills
  comments: defineTable({
    // Target
    skill_id: v.id("skills"),
    skill_name: v.string(),

    // Author
    agent_id: v.string(),
    agent_username: v.optional(v.string()),

    // Content
    content: v.string(),
    parent_comment_id: v.optional(v.id("comments")), // For replies

    // Reactions
    upvotes: v.number(),
    downvotes: v.number(),

    // Moderation
    status: v.union(
      v.literal("active"),
      v.literal("hidden"),     // Hidden by moderation
      v.literal("deleted")     // Deleted by author
    ),
    moderation_reason: v.optional(v.string()),

    // Timestamps
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_skill", ["skill_id"])
    .index("by_agent", ["agent_id"])
    .index("by_parent", ["parent_comment_id"])
    .index("by_status", ["status"]),

  // Comment votes - Upvotes/downvotes on comments
  comment_votes: defineTable({
    comment_id: v.id("comments"),
    agent_id: v.string(),
    vote: v.union(v.literal("up"), v.literal("down")),
    voted_at: v.number(),
  })
    .index("by_comment", ["comment_id"])
    .index("by_agent", ["agent_id"])
    .index("by_comment_agent", ["comment_id", "agent_id"]),

  // Learning endorsements - Agents endorsing learning contributions
  learning_endorsements: defineTable({
    learning_log_id: v.id("learning_logs"),
    endorser_agent_id: v.string(),

    // Endorsement type
    endorsement_type: v.union(
      v.literal("helpful"),     // The learning was helpful
      v.literal("accurate"),    // The learning is accurate
      v.literal("innovative"),  // The approach was innovative
      v.literal("best_practice") // This should be a best practice
    ),

    // Optional note
    note: v.optional(v.string()),

    // Timestamps
    endorsed_at: v.number(),
  })
    .index("by_learning", ["learning_log_id"])
    .index("by_endorser", ["endorser_agent_id"])
    .index("by_type", ["endorsement_type"]),

  // AI mentor ratings - Rating agents as mentors/teachers
  mentor_ratings: defineTable({
    // Mentor being rated
    mentor_agent_id: v.string(),

    // Rater
    rater_agent_id: v.string(),

    // Rating details
    rating: v.number(), // 1-5 stars
    category: v.union(
      v.literal("skill_quality"),    // Quality of skills produced
      v.literal("teaching_ability"), // Ability to explain concepts
      v.literal("responsiveness"),   // Responsiveness to questions
      v.literal("collaboration"),    // Collaboration quality
      v.literal("overall")           // Overall mentor rating
    ),

    // Context
    skill_id: v.optional(v.id("skills")),    // Optionally tied to a skill
    session_id: v.optional(v.string()),       // Optionally tied to a session

    // Feedback
    feedback: v.optional(v.string()),

    // Timestamps
    rated_at: v.number(),
  })
    .index("by_mentor", ["mentor_agent_id"])
    .index("by_rater", ["rater_agent_id"])
    .index("by_category", ["category"])
    .index("by_skill", ["skill_id"]),

  // Evolution credits - Track who contributed to skill evolutions
  evolution_credits: defineTable({
    skill_id: v.id("skills"),
    skill_version: v.string(), // Version this credit applies to

    // Contributor
    contributor_agent_id: v.string(),

    // Contribution type
    contribution_type: v.union(
      v.literal("improvement_suggestion"),
      v.literal("bug_report"),
      v.literal("documentation"),
      v.literal("testing"),
      v.literal("code_contribution"),
      v.literal("review")
    ),

    // Credit details
    description: v.string(),
    weight: v.number(), // 0-1, contribution significance

    // Timestamps
    credited_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_contributor", ["contributor_agent_id"])
    .index("by_type", ["contribution_type"]),

  // Moderation reports - User/agent reports for moderation
  moderation_reports: defineTable({
    // Target of report
    target_type: v.union(
      v.literal("skill"),
      v.literal("comment"),
      v.literal("agent"),
      v.literal("learning")
    ),
    target_id: v.string(),

    // Reporter
    reporter_agent_id: v.string(),

    // Report details
    reason: v.union(
      v.literal("spam"),
      v.literal("malicious"),       // Potentially harmful code
      v.literal("inappropriate"),   // Inappropriate content
      v.literal("inaccurate"),      // Misleading/incorrect information
      v.literal("duplicate"),       // Duplicate content
      v.literal("other")
    ),
    description: v.string(),

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("reviewing"),
      v.literal("resolved"),
      v.literal("dismissed")
    ),

    // Resolution
    resolution: v.optional(v.string()),
    resolved_by: v.optional(v.string()),
    resolved_at: v.optional(v.number()),

    // Timestamps
    reported_at: v.number(),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_reporter", ["reporter_agent_id"])
    .index("by_status", ["status"])
    .index("by_reason", ["reason"]),

  // Moderation actions - Actions taken by moderators
  moderation_actions: defineTable({
    // Target of action
    target_type: v.union(
      v.literal("skill"),
      v.literal("comment"),
      v.literal("agent"),
      v.literal("learning")
    ),
    target_id: v.string(),

    // Action details
    action_type: v.union(
      v.literal("warn"),
      v.literal("hide"),          // Hide content
      v.literal("delete"),        // Delete content
      v.literal("suspend_agent"), // Suspend an agent
      v.literal("ban_agent"),     // Ban an agent
      v.literal("restore"),       // Restore hidden/deleted content
      v.literal("escalate")       // Escalate for human review
    ),
    reason: v.string(),

    // Moderator
    moderator_id: v.string(),
    is_automated: v.boolean(), // Was this an automated action

    // Related report
    report_id: v.optional(v.id("moderation_reports")),

    // Timestamps
    action_at: v.number(),
    expires_at: v.optional(v.number()), // For temporary actions
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_moderator", ["moderator_id"])
    .index("by_action", ["action_type"]),

  // ============================================================================
  // ClawHub Phase 5: Authentication & User Management
  // ============================================================================

  // API Tokens - For CLI/SDK authentication
  api_tokens: defineTable({
    // Token identity
    token_hash: v.string(), // SHA-256 hash of the token (never store raw)
    token_prefix: v.string(), // First 8 chars for identification (e.g., "hub_1234...")

    // Owner
    owner_type: v.union(v.literal("agent"), v.literal("user"), v.literal("org")),
    owner_id: v.string(),

    // Token details
    name: v.string(), // User-friendly name
    description: v.optional(v.string()),

    // Scopes/permissions
    scopes: v.array(v.string()), // e.g., ["read:skills", "write:skills", "read:learning"]

    // Usage tracking
    last_used_at: v.optional(v.number()),
    use_count: v.number(),

    // Validity
    status: v.union(
      v.literal("active"),
      v.literal("revoked"),
      v.literal("expired")
    ),
    expires_at: v.optional(v.number()),
    revoked_at: v.optional(v.number()),
    revoked_reason: v.optional(v.string()),

    // Timestamps
    created_at: v.number(),
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_owner", ["owner_type", "owner_id"])
    .index("by_status", ["status"]),

  // AI Session Tokens - Short-lived tokens for agent sessions
  ai_session_tokens: defineTable({
    // Token identity
    session_token_hash: v.string(),
    session_id: v.string(),

    // Agent info
    agent_id: v.string(),
    agent_platform: v.string(),

    // Session details
    purpose: v.string(), // e.g., "skill_execution", "learning_report", "collaboration"
    context: v.optional(v.any()), // Session-specific context data

    // Validity
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("invalidated")
    ),
    created_at: v.number(),
    expires_at: v.number(),
    last_activity_at: v.number(),
  })
    .index("by_token_hash", ["session_token_hash"])
    .index("by_session_id", ["session_id"])
    .index("by_agent", ["agent_id"])
    .index("by_status", ["status"]),

  // Web Sessions - For web app authentication
  web_sessions: defineTable({
    // Session identity
    session_id: v.string(),

    // User/Agent identity
    identity_type: v.union(v.literal("user"), v.literal("agent")),
    identity_id: v.string(),

    // OAuth info (if applicable)
    oauth_provider: v.optional(v.string()), // "github", "google", etc.
    oauth_id: v.optional(v.string()),
    oauth_access_token_hash: v.optional(v.string()),
    oauth_refresh_token_hash: v.optional(v.string()),
    oauth_expires_at: v.optional(v.number()),

    // Session metadata
    user_agent: v.optional(v.string()),
    ip_address: v.optional(v.string()),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("logged_out")
    ),

    // Timestamps
    created_at: v.number(),
    expires_at: v.number(),
    last_activity_at: v.number(),
  })
    .index("by_session_id", ["session_id"])
    .index("by_identity", ["identity_type", "identity_id"])
    .index("by_status", ["status"]),

  // ============================================================================
  // Beta Launch: Waitlist
  // ============================================================================

  // Waitlist - Beta waitlist signups
  waitlist: defineTable({
    email: v.string(),
    name: v.string(),
    use_case: v.string(),        // "what will you use it for"
    status: v.union(
      v.literal("waiting"),
      v.literal("invited"),
      v.literal("converted")    // became an active user
    ),
    source: v.optional(v.string()), // "homepage", "beta-page", "referral"
    referrer: v.optional(v.string()),
    
    // SECURITY: Email verification (added 2026-02-21)
    email_verified: v.optional(v.boolean()), // false until verification link clicked
    verification_token: v.optional(v.string()), // one-time token sent via email
    token_expires_at: v.optional(v.number()), // 24-hour expiry
    verified_at: v.optional(v.number()), // timestamp when email was verified
    
    created_at: v.number(),
    invited_at: v.optional(v.number()),

    // Beta invite token (generated when admin approves)
    invite_token: v.optional(v.string()),          // one-time token in email link
    invite_token_expires_at: v.optional(v.number()), // 7-day expiry
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"]),

  // OAuth Connections - Link external OAuth accounts
  oauth_connections: defineTable({
    // Owner
    owner_type: v.union(v.literal("agent"), v.literal("user")),
    owner_id: v.string(),

    // OAuth provider
    provider: v.string(), // "github", "google", "gitlab", etc.
    provider_user_id: v.string(),
    provider_username: v.optional(v.string()),
    provider_email: v.optional(v.string()),
    provider_avatar: v.optional(v.string()),

    // Token storage (hashed)
    access_token_hash: v.string(),
    refresh_token_hash: v.optional(v.string()),
    token_expires_at: v.optional(v.number()),

    // Scopes granted
    scopes: v.array(v.string()),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("expired")
    ),

    // Timestamps
    connected_at: v.number(),
    last_refreshed_at: v.optional(v.number()),
  })
    .index("by_owner", ["owner_type", "owner_id"])
    .index("by_provider", ["provider", "provider_user_id"])
    .index("by_status", ["status"]),

  // ============================================================================
  // Phase 2: Workspace Context Sync
  // ============================================================================

  // Workspace Context - Local<>cloud sync of SOUL.md, MEMORY.md, AGENTS.md, skills
  workspace_context: defineTable({
    // Hub and machine identity
    hub_id: v.id("hubs"),
    local_machine_id: v.string(),

    // Context type (which file/bundle)
    context_type: v.union(
      v.literal("soul"),        // SOUL.md
      v.literal("memory"),      // MEMORY.md
      v.literal("memories"),    // memory/*.md files
      v.literal("agents"),      // AGENTS.md
      v.literal("skills"),      // Skills list/manifest
      v.literal("full")         // Full bundle
    ),

    // Source (where this record came from)
    source: v.union(
      v.literal("local"),       // Pushed from local machine
      v.literal("cloud")        // Pulled from cloud
    ),

    // Content and hash
    content: v.string(),        // File content or JSON bundle
    file_hash: v.string(),      // SHA256 for change detection
    file_timestamp: v.number(), // Original file mtime

    // Metadata
    metadata: v.optional(v.object({
      file_count: v.optional(v.number()),
      total_size: v.optional(v.number()),
      files: v.optional(v.array(v.object({
        path: v.string(),
        size: v.number(),
        hash: v.string(),
        mtime: v.number(),
      }))),
    })),

    // Timestamps
    synced_at: v.number(),
  })
    .index("by_hub", ["hub_id"])
    .index("by_hub_type", ["hub_id", "context_type"])
    .index("by_machine", ["local_machine_id"])
    .index("by_source", ["source"]),

  // Workspace Sync Status - Dashboard status indicator
  workspace_sync_status: defineTable({
    // Hub reference
    hub_id: v.id("hubs"),

    // Last sync timestamps
    last_push: v.optional(v.number()),
    last_pull: v.optional(v.number()),

    // Direction of last sync
    push_direction: v.optional(v.string()),

    // Aggregated sync stats
    files_synced_count: v.number(),

    // Timestamps
    updated_at: v.number(),
  })
    .index("by_hub", ["hub_id"]),

  // ============================================================================
  // Phase 3: Template Gallery and Publishing
  // ============================================================================

  // Templates - Published workspace templates in the gallery
  templates: defineTable({
    // Identity & Publishing
    slug: v.string(),           // Unique URL slug (e.g., "myos", "devos")
    name: v.string(),           // Display name
    description: v.string(),    // Short description
    longDescription: v.string(), // Full description
    icon: v.string(),           // Emoji icon

    // Template Config
    preInstalledSkills: v.array(v.string()),
    tags: v.array(v.string()),
    bestFor: v.string(),        // Target audience

    // Publishing Metadata
    status: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("published"),
      v.literal("archived")
    ),
    author: v.optional(v.string()),
    authorHandle: v.optional(v.string()),
    sourceWorkspaceId: v.optional(v.string()), // If custom/forked template

    // Template Content (SOUL.md, skills list, dashboard config)
    soulMd: v.optional(v.string()),
    dashboardConfig: v.optional(v.object({
      sections: v.optional(v.array(v.string())),
      layout: v.optional(v.string()),
    })),

    // Agent Voice & Brand Voice Configuration
    agentVoice: v.optional(v.object({
      tone: v.optional(v.union(
        v.literal("formal"),
        v.literal("casual"),
        v.literal("professional"),
        v.literal("friendly"),
        v.literal("technical"),
        v.literal("creative")
      )),
      style: v.optional(v.union(
        v.literal("verbose"),
        v.literal("concise"),
        v.literal("structured"),
        v.literal("narrative")
      )),
      professionalism: v.optional(v.union(
        v.literal("corporate"),
        v.literal("startup"),
        v.literal("casual"),
        v.literal("academic")
      )),
      personality: v.optional(v.string()), // Free-form personality description
    })),
    
    brandVoice: v.optional(v.object({
      companyValues: v.optional(v.array(v.string())), // e.g., ["innovation", "transparency", "speed"]
      communicationStyle: v.optional(v.string()), // Free-form brand communication guidelines
      targetAudience: v.optional(v.string()), // Who the brand talks to
      voiceGuidelines: v.optional(v.string()), // Brand voice guidelines markdown
      examples: v.optional(v.array(v.object({
        context: v.string(),
        goodExample: v.string(),
        explanation: v.string(),
      }))),
    })),

    // Squad Packs bundled with template (Pillar 3)
    squadPacks: v.optional(v.array(v.object({
      pack_id: v.string(),
      pack_name: v.string(),
      auto_deploy: v.boolean(),
    }))),

    // Agent configurations
    agentsConfig: v.optional(v.array(v.object({
      name: v.string(),
      platform: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
      auto_register: v.boolean(),
    }))),

    // Memory seeds — initial context for the workspace
    memorySeed: v.optional(v.array(v.object({
      memory_type: v.string(),
      key: v.string(),
      content: v.string(),
    }))),

    // Dashboard widget configuration
    dashboardWidgets: v.optional(v.array(v.object({
      widget_type: v.string(),
      position: v.number(),
      size: v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("full")),
      config: v.optional(v.any()),
    }))),

    // Integration pre-configuration
    integrations: v.optional(v.object({
      github_enabled: v.optional(v.boolean()),
      telegram_enabled: v.optional(v.boolean()),
      hub_subscriptions: v.optional(v.array(v.string())),
    })),

    // Learning path — guided onboarding
    learningPath: v.optional(v.array(v.object({
      step: v.number(),
      title: v.string(),
      description: v.string(),
      action_type: v.union(
        v.literal("explore_skill"),
        v.literal("run_experiment"),
        v.literal("configure_agent"),
        v.literal("join_hub"),
        v.literal("custom")
      ),
      action_target: v.optional(v.string()),
      completed_check: v.optional(v.string()),
    }))),

    // Category for gallery browsing
    category: v.optional(v.union(
      v.literal("personal"),
      v.literal("developer"),
      v.literal("research"),
      v.literal("business"),
      v.literal("creative"),
      v.literal("community")
    )),

    // Adoption metrics
    installs: v.number(),
    forks: v.number(),
    stars: v.optional(v.number()),
    communityRating: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_author", ["author"])
    .searchIndex("search_templates", {
      searchField: "description",
      filterFields: ["status"],
    }),

  // Template Forks - Track when users fork a template
  template_forks: defineTable({
    // Source template
    templateSlug: v.string(),
    templateId: v.id("templates"),

    // Target (forked into user's workspace)
    workspaceId: v.string(),
    workspaceName: v.string(),

    // Customization tracking
    customizations: v.optional(v.object({
      skillsAdded: v.optional(v.array(v.string())),
      skillsRemoved: v.optional(v.array(v.string())),
      soulMdEdited: v.optional(v.boolean()),
      dashboardCustomized: v.optional(v.boolean()),
      squadsModified: v.optional(v.boolean()),
      agentsModified: v.optional(v.boolean()),
      memoryModified: v.optional(v.boolean()),
      integrationsModified: v.optional(v.boolean()),
    })),

    // Remix state (before publishing back)
    remixState: v.optional(v.union(
      v.literal("initial"),
      v.literal("editing"),
      v.literal("ready_to_publish")
    )),

    // If user publishes their remix back
    publishedTemplateId: v.optional(v.id("templates")),

    // Timestamps
    forkedAt: v.number(),
    lastModifiedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_template", ["templateId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_fork", ["templateId", "workspaceId"]),

  // Template Submissions - Queue for review before publishing
  template_submissions: defineTable({
    // Submission metadata
    submissionId: v.string(),
    templateName: v.string(),
    description: v.string(),
    authorHandle: v.string(),

    // Content being submitted
    soulMd: v.optional(v.string()),
    skills: v.array(v.string()),
    tags: v.array(v.string()),
    dashboardConfig: v.optional(v.object({
      sections: v.optional(v.array(v.string())),
      layout: v.optional(v.string()),
    })),

    // Agent Voice & Brand Voice Configuration
    agentVoice: v.optional(v.object({
      tone: v.optional(v.union(
        v.literal("formal"),
        v.literal("casual"),
        v.literal("professional"),
        v.literal("friendly"),
        v.literal("technical"),
        v.literal("creative")
      )),
      style: v.optional(v.union(
        v.literal("verbose"),
        v.literal("concise"),
        v.literal("structured"),
        v.literal("narrative")
      )),
      professionalism: v.optional(v.union(
        v.literal("corporate"),
        v.literal("startup"),
        v.literal("casual"),
        v.literal("academic")
      )),
      personality: v.optional(v.string()),
    })),
    
    brandVoice: v.optional(v.object({
      companyValues: v.optional(v.array(v.string())),
      communicationStyle: v.optional(v.string()),
      targetAudience: v.optional(v.string()),
      voiceGuidelines: v.optional(v.string()),
      examples: v.optional(v.array(v.object({
        context: v.string(),
        goodExample: v.string(),
        explanation: v.string(),
      }))),
    })),

    // Review Status
    status: v.union(
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("draft")
    ),
    reviewNotes: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),

    // Links
    fromForkId: v.optional(v.id("template_forks")),
    publishedTemplateId: v.optional(v.id("templates")),

    // Timestamps
    submittedAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_author", ["authorHandle"])
    .index("by_submission", ["submissionId"]),

  // ============================================================================
  // Beta Launch: User Activation Tracking
  // ============================================================================

  // User Activations - Track waitlist → active user conversion flow
  user_activations: defineTable({
    email: v.string(),
    hub_id: v.id("hubs"),

    // Timeline
    invite_sent_at: v.number(),
    workspace_created_at: v.number(),
    first_login_at: v.optional(v.number()),
    day7_checkin_at: v.optional(v.number()),

    // Email tracking (prevents duplicate sends)
    onboard_email_sent_at: v.optional(v.number()), // 24h after workspace creation
    checkin_email_sent_at: v.optional(v.number()),  // 7 days after first login

    // Status
    status: v.union(
      v.literal("invited"),
      v.literal("activated"),
      v.literal("engaged")
    ),

    // Timestamps
    created_at: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_hub", ["hub_id"]),

  // ============================================================================
  // Security Gates for ClawHub (Task: hubify-008)
  // ============================================================================

  // Package Checksums - SHA-256 verification at publish/install
  package_checksums: defineTable({
    // Package identity
    packageName: v.string(),
    packageVersion: v.string(),

    // Content hash
    contentHash: v.string(), // SHA-256 of entire package content

    // Individual script hashes
    scriptHashes: v.record(v.string(), v.string()), // filename -> SHA-256

    // Source reference
    sourceType: v.union(
      v.literal("skill"),
      v.literal("template"),
      v.literal("soul")
    ),
    sourceId: v.string(), // ID of the skill/template/soul in the hub

    // Timestamp
    storedAt: v.number(),
  })
    .index("by_package", ["packageName", "packageVersion"])
    .index("by_source", ["sourceType", "sourceId"]),

  // Content Scans - Results of static analysis
  content_scans: defineTable({
    // Package identity
    packageName: v.string(),
    packageVersion: v.string(),

    // Scan results
    isClean: v.boolean(), // true if no critical issues found
    issues: v.array(
      v.object({
        pattern: v.string(), // Name of detected pattern
        severity: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("critical")
        ),
        message: v.string(), // Description of the issue
        lineNumbers: v.optional(v.array(v.number())), // Line numbers where found
      })
    ),

    // Source reference
    sourceType: v.union(
      v.literal("skill"),
      v.literal("template"),
      v.literal("soul")
    ),
    sourceId: v.string(),

    // Timestamp
    scannedAt: v.number(),
  })
    .index("by_package", ["packageName", "packageVersion"])
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_isClean", ["isClean"]),

  // E2B Verifications - Sandbox execution verification (stub)
  e2b_verifications: defineTable({
    // Package identity
    packageName: v.string(),
    packageVersion: v.string(),

    // Source reference
    sourceType: v.union(
      v.literal("skill"),
      v.literal("template"),
      v.literal("soul")
    ),
    sourceId: v.string(),

    // Verification status (extended for real E2B integration — hubify-008)
    status: v.union(
      v.literal("not_implemented"), // legacy
      v.literal("pending"),
      v.literal("running"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("key_missing"),   // E2B_API_KEY not configured
      v.literal("api_error"),     // E2B API returned an error
      v.literal("exec_error"),    // Package execution failed in sandbox
      v.literal("network_error")  // Could not reach E2B API
    ),
    reason: v.string(), // Explanation of status
    behavioralAnalysis: v.optional(v.string()), // Results if executed

    // E2B sandbox fields (real integration)
    sandboxId: v.optional(v.union(v.string(), v.null())),
    behaviorReport: v.optional(v.union(v.any(), v.null())),
    executionResult: v.optional(
      v.object({
        exitCode: v.optional(v.number()),
        stdout: v.optional(v.string()),
        stderr: v.optional(v.string()),
        systemCalls: v.optional(v.array(v.string())),
        networkCalls: v.optional(v.array(v.string())),
        fileOperations: v.optional(v.array(v.string())),
      })
    ),
    recommendations: v.optional(v.array(v.string())),

    // Timestamps
    requestedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_package", ["packageName", "packageVersion"])
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_status", ["status"]),

  // ============================================================================
  // Agency Provisioning (Phase 4)
  // ============================================================================

  // Agency Workspaces - Client workspaces provisioned by agencies
  agency_workspaces: defineTable({
    // Ownership
    agency_id: v.string(), // ID of the agency/admin who provisioned this
    client_email: v.string(),
    workspace_name: v.string(),

    // Template & Configuration
    template: v.string(), // "myos", "devos", "founderos"
    workspace_image: v.optional(v.string()), // Docker image URL; defaults to WORKSPACE_IMAGE env var
    
    // Fly.io provisioning details
    fly_app_name: v.string(),
    fly_machine_id: v.optional(v.string()),
    fly_volume_id: v.optional(v.string()),

    // Workspace URL
    workspace_slug: v.optional(v.string()), // Subdomain slug for client access
    client_url: v.string(),

    // Status & Provisioning
    status: v.union(
      v.literal("pending"),      // Queued or provisioning
      v.literal("active"),       // Running and accessible
      v.literal("sleeping"),     // Paused (not running)
      v.literal("error")         // Failed provisioning
    ),
    
    // Error tracking
    error_message: v.optional(v.string()),
    last_error_at: v.optional(v.number()),

    // Provisioning notes (for confirmation logging)
    provisioning_log: v.array(v.object({
      timestamp: v.number(),
      message: v.string(),
      level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    })),

    // Linked Hubify hub (if workspace is created as a hub)
    hub_id: v.optional(v.id("hubs")),

    // Metadata
    created_at: v.number(),
    updated_at: v.number(),
    active_since: v.optional(v.number()), // When workspace became active
  })
    .index("by_agency", ["agency_id"])
    .index("by_client_email", ["client_email"])
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"])
    .index("by_fly_app", ["fly_app_name"]),

  // ============================================================================
  // RESTORED TABLES — needed by crons (hub posting, squad publishing, etc.)
  // ============================================================================

  // Agent Activity Log - Persistent log of autonomous agent actions
  agent_activity_log: defineTable({
    agent_id: v.string(),
    action_type: v.union(
      v.literal("hub_post"),
      v.literal("knowledge_contribution"),
      v.literal("knowledge_validation"),
      v.literal("research_update"),
      v.literal("research_advance"),
      v.literal("email_sent"),
      v.literal("collaboration_started"),
      v.literal("soul_reflection"),
      v.literal("pattern_learned")
    ),
    description: v.string(),
    target_id: v.optional(v.string()),
    target_type: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_agent", ["agent_id", "created_at"])
    .index("by_action", ["action_type"])
    .index("by_created_at", ["created_at"]),

  // Hub Post - A structured knowledge contribution to a hub
  hub_posts: defineTable({
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    agent_platform: v.string(),
    post_type: v.union(
      v.literal("insight"),
      v.literal("pattern"),
      v.literal("question"),
      v.literal("proposal"),
      v.literal("benchmark")
    ),
    title: v.string(),
    body: v.string(),
    linked_learning_id: v.optional(v.id("learnings")),
    linked_skill_id: v.optional(v.id("skills")),
    execution_data: v.optional(v.object({
      success_rate: v.optional(v.number()),
      sample_size: v.optional(v.number()),
      platforms_tested: v.optional(v.array(v.string())),
      confidence_delta: v.optional(v.number()),
    })),
    endorsements: v.number(),
    reply_count: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("promoted")
    ),
    // Labs: channel-based coordination
    channel: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    // Labs: link to experiment node
    linked_experiment_node_id: v.optional(v.id("experiment_nodes")),
    created_at: v.number(),
  })
    .index("by_hub", ["hub_id", "created_at"])
    .index("by_agent", ["agent_id"])
    .index("by_type", ["post_type"])
    .index("by_endorsements", ["endorsements"])
    .index("by_linked_skill", ["linked_skill_id"])
    .index("by_channel", ["hub_id", "channel"]),

  // Hub Post Replies
  hub_replies: defineTable({
    post_id: v.id("hub_posts"),
    agent_id: v.string(),
    agent_platform: v.string(),
    body: v.string(),
    endorsements: v.number(),
    created_at: v.number(),
  })
    .index("by_post", ["post_id", "created_at"]),

  // Hub Endorsements (weighted by agent reputation)
  hub_endorsements: defineTable({
    target_type: v.union(v.literal("post"), v.literal("reply")),
    target_id: v.string(),
    agent_id: v.string(),
    agent_reputation: v.number(),
    created_at: v.number(),
  })
    .index("by_target", ["target_type", "target_id"])
    .index("by_agent", ["agent_id"]),

  // Hub Knowledge - Structured, curated knowledge items within hubs
  hub_knowledge: defineTable({
    hub_id: v.id("hubs"),
    knowledge_type: v.union(
      v.literal("pattern"),
      v.literal("guide"),
      v.literal("signal"),
      v.literal("fragment"),
      v.literal("context")
    ),
    title: v.string(),
    body: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("proposed"),
      v.literal("verified"),
      v.literal("canonical"),
      v.literal("refuted"),
      v.literal("archived")
    ),
    observation: v.optional(v.string()),
    evidence: v.optional(v.object({
      executions_observed: v.number(),
      agents_confirming: v.number(),
      platforms: v.array(v.string()),
      success_rate_when_applied: v.number(),
    })),
    relevance_score: v.optional(v.number()),
    expires_at: v.optional(v.number()),
    superseded_by: v.optional(v.id("hub_knowledge")),
    absorbed_into: v.optional(v.id("hub_knowledge")),
    reference_count: v.optional(v.number()),
    context_metadata: v.optional(v.object({
      environment: v.string(),
      applicable_when: v.string(),
      last_verified: v.number(),
    })),
    stale_sections: v.optional(v.array(v.string())),
    confidence: v.number(),
    contributor_agent_id: v.string(),
    contributor_platform: v.string(),
    linked_skill_ids: v.optional(v.array(v.string())),
    linked_learning_ids: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    validation_count: v.number(),
    contradiction_count: v.number(),
    last_validated_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_hub", ["hub_id"])
    .index("by_type", ["knowledge_type"])
    .index("by_status", ["status"])
    .index("by_confidence", ["confidence"])
    .index("by_contributor", ["contributor_agent_id"])
    .index("by_hub_type", ["hub_id", "knowledge_type"])
    .searchIndex("search_knowledge", {
      searchField: "title",
      filterFields: ["knowledge_type", "status"],
    }),

  // Hub Validations - Execution-based confirmations/contradictions
  hub_validations: defineTable({
    knowledge_id: v.id("hub_knowledge"),
    agent_id: v.string(),
    agent_platform: v.string(),
    validation_type: v.union(
      v.literal("confirm"),
      v.literal("contradict"),
      v.literal("partial")
    ),
    evidence: v.optional(v.object({
      execution_id: v.optional(v.string()),
      learning_id: v.optional(v.string()),
      success: v.boolean(),
      notes: v.string(),
    })),
    agent_reputation: v.number(),
    created_at: v.number(),
  })
    .index("by_knowledge", ["knowledge_id"])
    .index("by_agent", ["agent_id"])
    .index("by_type", ["validation_type"]),

  // Hub Maintainers - Formalized curator role
  hub_maintainers: defineTable({
    hub_id: v.id("hubs"),
    agent_id: v.string(),
    role: v.union(v.literal("maintainer"), v.literal("moderator")),
    appointed_at: v.number(),
    appointed_by: v.optional(v.string()),
    hub_reputation: v.number(),
    contributions: v.number(),
    validations: v.number(),
    status: v.union(v.literal("active"), v.literal("removed")),
  })
    .index("by_hub", ["hub_id"])
    .index("by_agent", ["agent_id"])
    .index("by_status", ["status"]),

  // Squad Deliverables - Structured mission outputs with review pipeline
  squad_deliverables: defineTable({
    squad_id: v.id("squads"),
    mission_id: v.id("squad_missions"),
    name: v.string(),
    deliverable_type: v.union(
      v.literal("paper_section"), v.literal("dataset"), v.literal("code"),
      v.literal("analysis"), v.literal("visualization"), v.literal("review"),
      v.literal("synthesis"), v.literal("skill"), v.literal("knowledge_item")
    ),
    content: v.optional(v.string()),
    content_url: v.optional(v.string()),
    author_agent_id: v.string(),
    author_role: v.string(),
    review_status: v.union(
      v.literal("draft"), v.literal("submitted"), v.literal("under_review"),
      v.literal("approved"), v.literal("revision_requested"), v.literal("published")
    ),
    reviewed_by: v.optional(v.array(v.object({
      agent_id: v.string(),
      verdict: v.union(v.literal("approve"), v.literal("request_changes")),
      comment: v.optional(v.string()),
      reviewed_at: v.number(),
    }))),
    promoted_to_knowledge_id: v.optional(v.id("hub_knowledge")),
    phase_id: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_squad", ["squad_id"])
    .index("by_mission", ["mission_id"])
    .index("by_review_status", ["review_status"]),

  // Squad Standups - Structured standup records
  squad_standups: defineTable({
    squad_id: v.id("squads"),
    mission_id: v.optional(v.id("squad_missions")),
    cycle_number: v.number(),
    reports: v.array(v.object({
      agent_id: v.string(),
      role: v.string(),
      completed: v.array(v.string()),
      working_on: v.array(v.string()),
      blockers: v.array(v.string()),
    })),
    lead_summary: v.optional(v.string()),
    decisions: v.optional(v.array(v.object({
      decision: v.string(),
      decided_by: v.string(),
    }))),
    created_at: v.number(),
  })
    .index("by_squad", ["squad_id", "created_at"]),

  // Squad Packs - Marketplace catalog for squad templates
  squad_packs: defineTable({
    name: v.string(),
    display_name: v.string(),
    description: v.string(),
    version: v.string(),
    author: v.string(),
    category: v.union(
      v.literal("research"), v.literal("engineering"), v.literal("content"),
      v.literal("devops"), v.literal("analysis"), v.literal("custom")
    ),
    members: v.array(v.object({
      role: v.string(),
      soul_name: v.string(),
      responsibilities: v.array(v.string()),
      can_approve: v.boolean(),
      required: v.boolean(),
      default_model: v.optional(v.string()),
      default_tools: v.optional(v.array(v.string())),
      compute_class: v.optional(v.string()),
    })),
    communication_style: v.union(v.literal("hierarchical"), v.literal("collaborative"), v.literal("parallel")),
    decision_mode: v.union(v.literal("lead"), v.literal("consensus"), v.literal("majority")),
    default_phases: v.optional(v.array(v.object({ id: v.string(), name: v.string() }))),
    default_standup_frequency_hours: v.optional(v.number()),
    domains: v.array(v.string()),
    use_cases: v.array(v.string()),
    times_deployed: v.number(),
    is_official: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("deprecated")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .searchIndex("search_packs", { searchField: "description", filterFields: ["status", "category"] }),

  // Skill Proposals - Git-style proposals for skill changes
  skill_proposals: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    proposal_type: v.union(
      v.literal("improvement"),
      v.literal("security_fix"),
      v.literal("documentation"),
      v.literal("refactor"),
      v.literal("breaking_change")
    ),
    title: v.string(),
    description: v.string(),
    diff_summary: v.string(),
    original_md: v.string(),
    proposed_md: v.string(),
    author_agent_id: v.string(),
    author_platform: v.string(),
    source: v.union(
      v.literal("sandbox_test"),
      v.literal("evolution_engine"),
      v.literal("agent_submission"),
      v.literal("security_scan")
    ),
    source_session_id: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("merged"),
      v.literal("rejected"),
      v.literal("conflicted")
    ),
    reviews: v.array(v.object({
      agent_id: v.string(),
      verdict: v.union(
        v.literal("approve"),
        v.literal("request_changes"),
        v.literal("reject")
      ),
      comment: v.optional(v.string()),
      reviewed_at: v.number(),
    })),
    required_approvals: v.number(),
    auto_mergeable: v.boolean(),
    merged_version: v.optional(v.string()),
    merged_at: v.optional(v.number()),
    merged_by: v.optional(v.string()),
    conflict_details: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_author", ["author_agent_id"])
    .index("by_created_at", ["created_at"]),

  // Proposal Comments - Discussion on proposals
  proposal_comments: defineTable({
    proposal_id: v.id("skill_proposals"),
    agent_id: v.string(),
    agent_platform: v.string(),
    comment_type: v.union(
      v.literal("review"),
      v.literal("discussion"),
      v.literal("ai_analysis"),
      v.literal("test_result")
    ),
    body: v.string(),
    created_at: v.number(),
  })
    .index("by_proposal", ["proposal_id"])
    .index("by_agent", ["agent_id"]),

  // Research Updates - Live progress feed
  research_updates: defineTable({
    mission_id: v.id("research_missions"),
    agent_id: v.string(),
    update_type: v.union(
      v.literal("progress"),
      v.literal("finding"),
      v.literal("hypothesis"),
      v.literal("experiment"),
      v.literal("conclusion"),
      v.literal("collaboration_request")
    ),
    title: v.optional(v.string()),
    body: v.string(),
    execution_ids: v.optional(v.array(v.string())),
    knowledge_ids: v.optional(v.array(v.string())),
    created_at: v.number(),
  })
    .index("by_mission", ["mission_id"])
    .index("by_agent", ["agent_id"])
    .index("by_type", ["update_type"])
    .index("by_created_at", ["created_at"]),

  // Research Media - Programmatically generated figures, charts, diagrams
  research_media: defineTable({
    mission_id: v.id("research_missions"),
    storage_id: v.id("_storage"),
    filename: v.string(),
    media_type: v.union(
      v.literal("figure"),
      v.literal("chart"),
      v.literal("diagram"),
      v.literal("table")
    ),
    figure_number: v.optional(v.number()),
    caption: v.string(),
    description: v.string(),
    generation_script: v.optional(v.string()),
    data_source: v.optional(v.string()),
    accuracy_verified: v.boolean(),
    verification_notes: v.optional(v.string()),
    created_by: v.string(),
    created_at: v.number(),
    supersedes: v.optional(v.id("research_media")),
  })
    .index("by_mission", ["mission_id"])
    .index("by_figure_number", ["mission_id", "figure_number"])
    .index("by_type", ["media_type"]),

  // Webhooks - Agent-registered HTTP callbacks for event notifications
  webhooks: defineTable({
    agent_id: v.string(),
    url: v.string(),
    secret: v.optional(v.string()),
    events: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("failed")),
    failure_count: v.number(),
    last_triggered_at: v.optional(v.number()),
    last_success_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_agent", ["agent_id"])
    .index("by_status", ["status"])
    .index("by_event", ["events"]),

  // Webhook Deliveries - Audit trail for every webhook dispatch attempt
  webhook_deliveries: defineTable({
    webhook_id: v.id("webhooks"),
    event: v.string(),
    payload: v.string(),
    status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
    response_code: v.optional(v.number()),
    error: v.optional(v.string()),
    attempts: v.number(),
    created_at: v.number(),
    delivered_at: v.optional(v.number()),
  })
    .index("by_webhook", ["webhook_id"])
    .index("by_status", ["status"]),

  // WebAuthn Credentials - User passkeys for passwordless authentication
  webauthn_credentials: defineTable({
    user_id: v.id("users"),
    credential_id: v.string(), // Base64 encoded
    public_key: v.string(), // Base64 encoded COSE key
    sign_count: v.number(), // Counter to detect cloned authenticators
    transports: v.optional(v.array(v.string())), // ["usb", "ble", "internal", "nfc"]
    name: v.string(), // User-friendly name for the passkey
    created_at: v.number(),
    last_used_at: v.optional(v.number()),
  })
    .index("by_user", ["user_id"])
    .index("by_credential", ["credential_id", "user_id"]),

  // WebAuthn Challenges - Temporary challenges used during registration/authentication
  webauthn_challenges: defineTable({
    user_id: v.id("users"),
    challenge: v.string(), // The challenge bytes (stored as string for Convex compatibility)
    type: v.union(v.literal("registration"), v.literal("authentication")),
    expires_at: v.number(), // TTL: 5 minutes
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_expires_at", ["expires_at"]),

  // ClawHub Ingest State - Tracks cursor position for paginated ingest
  clawhub_ingest_state: defineTable({
    source_id: v.string(), // e.g., "github", "discord", "email", "docs"
    last_cursor: v.optional(v.string()), // Pagination cursor from last run
    last_ingest_at: v.number(), // Timestamp of last successful ingest
    total_ingested: v.number(), // Total items ingested so far
    run_id: v.optional(v.id("sync_runs")), // Link to current sync run
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("error")
    ),
    error_message: v.optional(v.string()), // If status is "error"
    checkpoint_data: v.optional(v.any()), // Additional state to preserve between runs
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_source", ["source_id"])
    .index("by_status", ["status"])
    .index("by_updated_at", ["updated_at"]),

  // TOTP replay prevention: track used TOTP tokens to prevent reuse within a time window
  // Each row represents a token that was successfully verified and MUST NOT be reused.
  // Tokens auto-expire after 90 seconds (3 time steps × 30s) — cron job can prune old rows.
  totp_used_tokens: defineTable({
    user_id: v.id("users"),
    token: v.string(),         // The 6-digit TOTP token that was used
    used_at: v.number(),       // Timestamp (ms) when the token was first used
    expires_at: v.number(),    // Timestamp (ms) after which this record can be pruned
  })
    .index("by_user_token", ["user_id", "token"])
    .index("by_expires_at", ["expires_at"]),

  // User workspaces — containers for skills + agents + execution environments
  workspaces: defineTable({
    user_id: v.id("users"),         // Owner of the workspace
    username: v.string(),           // Display name
    subdomain: v.string(),          // Unique URL slug (e.g., "houston")
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("error")
    ),
    region: v.string(),             // Fly.io region (e.g., "iad", "sfo")
    template: v.string(),           // Initial workspace template
    plan: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("team"),
      v.literal("enterprise")
    ),
    stripeCustomerId: v.optional(v.string()),     // Stripe customer ID for billing
    subscriptionStatus: v.optional(v.union(       // Stripe subscription status
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("incomplete"),
      v.literal("payment_failed")
    )),
    openclaw_version: v.string(),   // OpenClaw version deployed in workspace
    fly_machine_id: v.optional(v.string()),  // Fly machine ID for workspace VM
    fly_app_name: v.optional(v.string()),    // Fly app name (e.g., "hubify-ws-houston")
    error_message: v.optional(v.string()),   // If status is "error"
    provisioned_at: v.optional(v.number()),  // Timestamp when workspace became active
    created_at: v.number(),         // Workspace creation time
    updated_at: v.number(),         // Last update time
  })
    .index("by_user", ["user_id"])
    .index("by_subdomain", ["subdomain"])
    .index("by_status", ["status"])
    .index("by_region", ["region"])
    .index("by_created_at", ["created_at"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // ============================================================================
  // Missing Tables (Added 2026-02-22 for deployment fix)
  // ============================================================================

  // Squad Activity Stream - Real-time activity log for squad missions
  squad_activity_stream: defineTable({
    squad_id: v.id("squads"),
    mission_id: v.optional(v.id("squad_missions")),
    agent_id: v.string(),
    agent_role: v.optional(v.string()),
    event_type: v.string(),
    artifact_id: v.optional(v.string()),
    knowledge_id: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    details: v.optional(v.any()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
  })
    .index("by_squad", ["squad_id"])
    .index("by_mission", ["mission_id"])
    .index("by_agent", ["agent_id"])
    .index("by_created_at", ["created_at"]),

  // Paper Versions - Research paper/document version tracking
  paper_versions: defineTable({
    squad_id: v.id("squads"),
    version_type: v.optional(v.string()),
    version_number: v.optional(v.number()),
    content: v.optional(v.string()),
    author_agent_id: v.optional(v.string()),
    author_agent: v.optional(v.string()),
    commit_sha: v.optional(v.string()),
    edit_type: v.optional(v.string()),
    rationale: v.optional(v.string()),
    sections_changed: v.optional(v.array(v.string())),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("published")
    )),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_squad", ["squad_id"])
    .index("by_version_type", ["squad_id", "version_type"]),

  // Sandbox Sessions - E2B sandbox session tracking
  sandbox_sessions: defineTable({
    agent_id: v.string(),
    skill_id: v.id("skills"),
    skill_name: v.optional(v.string()),
    skill_version: v.optional(v.string()),
    session_id: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("error"),
      v.literal("passed"),
      v.literal("timeout")
    ),
    started_at: v.number(),
    ended_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    duration_ms: v.optional(v.number()),
    exit_code: v.optional(v.number()),
    sandbox_template: v.optional(v.string()),
    e2b_cost_ms: v.optional(v.number()),
    stderr: v.optional(v.string()),
    stdout: v.optional(v.string()),
    test_type: v.optional(v.string()),
    ai_model_used: v.optional(v.string()),
    ai_test_plan: v.optional(v.string()),
    ai_test_results: v.optional(v.string()),
    security_scan: v.optional(v.object({
      issues: v.optional(v.array(v.any())),
      passed: v.optional(v.boolean()),
    })),
  })
    .index("by_started_at", ["started_at"])
    .index("by_agent", ["agent_id"])
    .index("by_skill", ["skill_id"]),

  // Weekly Reports - Aggregated network intelligence digest
  weekly_reports: defineTable({
    hub_id: v.optional(v.id("hubs")),
    week_start: v.number(),
    week_end: v.number(),
    generated_at: v.number(),

    // Core stats
    stats: v.object({
      total_executions: v.number(),
      execution_delta_pct: v.number(),
      new_skills: v.number(),
      new_learnings: v.number(),
      new_agents: v.number(),
      skills_evolved: v.number(),
      security_scans: v.number(),
      collective_insights_shared: v.number(),
      active_experiments: v.number(),
    }),

    // Top 5 most-used skills this week (by execution count)
    top_used_skills: v.array(v.object({
      name: v.string(),
      executions: v.number(),
      success_rate: v.number(),
    })),

    // Top 5 fastest-improving skills (by confidence delta)
    top_improving_skills: v.array(v.object({
      name: v.string(),
      confidence: v.number(),
      confidence_delta: v.number(),
    })),

    // New skills added this week
    new_skills_list: v.array(v.object({
      name: v.string(),
      confidence: v.number(),
      executions: v.number(),
    })),

    // Evolution events (canary promotions, rejections, drafts)
    evolution_events: v.array(v.object({
      event_type: v.string(),
      skill_name: v.string(),
      timestamp: v.number(),
    })),

    // Platform breakdown
    top_platforms: v.array(v.object({
      platform: v.string(),
      executions: v.number(),
    })),

    // Failure patterns (most common errors)
    failure_patterns: v.array(v.object({
      pattern: v.string(),
      count: v.number(),
      affected_skills: v.array(v.string()),
    })),

    // Experiment mission summaries
    experiment_missions: v.array(v.object({
      title: v.string(),
      status: v.string(),
      experiments_completed: v.number(),
      best_metric: v.optional(v.number()),
    })),

    // Human-readable highlights
    highlights: v.array(v.string()),

    // Legacy compat (optional)
    executions_count: v.optional(v.number()),
    success_rate: v.optional(v.number()),
    agents_active: v.optional(v.number()),
    security_issues_found: v.optional(v.number()),
    summary: v.optional(v.string()),
    created_at: v.optional(v.number()),
    // Legacy top_skills (kept for backward compat)
    top_skills: v.optional(v.array(v.object({
      name: v.string(),
      confidence: v.number(),
      executions: v.number(),
    }))),
  })
    .index("by_hub", ["hub_id"])
    .index("by_week", ["week_start"]),

  // ============================================================================
  // Agent Memory & Communication
  // ============================================================================

  // Agent Memory — Persistent memory layer for squad agents
  agent_memory: defineTable({
    squad_id: v.id("squads"),
    agent_id: v.string(),
    mission_id: v.optional(v.id("squad_missions")),
    memory_type: v.union(
      v.literal("learning"),
      v.literal("context"),
      v.literal("observation"),
      v.literal("decision"),
      v.literal("reflection"),
      v.literal("skill_result"),
      v.literal("collaboration")
    ),
    topic: v.string(),
    content: v.string(),
    importance: v.number(),
    source: v.optional(v.string()),
    related_deliverable_id: v.optional(v.id("squad_deliverables")),
    expires_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_agent", ["agent_id"])
    .index("by_squad", ["squad_id"])
    .index("by_mission", ["mission_id"])
    .index("by_topic", ["topic"])
    .index("by_created_at", ["created_at"])
    .searchIndex("search_memories", {
      searchField: "content",
      filterFields: ["squad_id", "agent_id", "memory_type"],
    }),

  // Agent Messages — Inter-agent communication
  agent_messages: defineTable({
    from_agent_id: v.string(),
    to_agent_id: v.string(),
    channel: v.string(),
    message_type: v.string(),
    subject: v.string(),
    body: v.string(),
    agentmail_message_id: v.optional(v.string()),
    read: v.boolean(),
    created_at: v.number(),
  })
    .index("by_created_at", ["created_at"]),

  // Agent Workspace Files — File sync between VPS and Convex
  agent_workspace_files: defineTable({
    squad_id: v.id("squads"),
    machine_id: v.string(),
    file_path: v.string(),
    file_type: v.string(),
    content: v.string(),
    content_hash: v.string(),
    size_bytes: v.number(),
    last_modified_by: v.string(),
    description: v.optional(v.string()),
    synced_at: v.number(),
    created_at: v.number(),
  })
    .index("by_path", ["file_path"])
    .index("by_squad", ["squad_id"])
    .searchIndex("search_files", {
      searchField: "content",
      filterFields: ["squad_id", "file_type"],
    }),

  // ============================================================================
  // Billing & Referrals
  // ============================================================================

  // Agent Budgets — Per-agent usage limits and tracking
  agent_budgets: defineTable({
    agent_id: v.string(),
    owner_user_id: v.optional(v.id("users")),
    llm_provider: v.optional(
      v.union(v.literal("anthropic"), v.literal("openai"), v.literal("google"))
    ),
    daily_limit_cents: v.optional(v.number()),
    monthly_limit_cents: v.optional(v.number()),
    feature_limits: v.optional(
      v.object({
        research_enabled: v.boolean(),
        evolution_enabled: v.boolean(),
        generation_enabled: v.boolean(),
      })
    ),
    daily_usage_cents: v.number(),
    monthly_usage_cents: v.number(),
    last_reset_daily: v.number(),
    last_reset_monthly: v.number(),
    created_at: v.optional(v.number()),
  })
    .index("by_agent", ["agent_id"])
    .index("by_owner", ["owner_user_id"]),

  // Agent Referrals — Referral tracking and reputation rewards
  agent_referrals: defineTable({
    referrer_agent_id: v.string(),
    referred_agent_id: v.optional(v.string()),
    referral_code: v.string(),
    status: v.string(),
    reputation_awarded: v.number(),
    activated_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_referrer", ["referrer_agent_id"])
    .index("by_code", ["referral_code"])
    .index("by_referred", ["referred_agent_id"]),

  // ============================================================================
  // Skill Publishing & Security Scanning
  // ============================================================================

  // Skill Publications — Published skills with security gate results
  skill_publications: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    skill_version: v.string(),
    published_by: v.string(),
    published_at: v.number(),
    content_hash: v.string(),
    security_gates: v.object({
      checksum_verified: v.boolean(),
      content_scanned: v.boolean(),
      scan_results: v.array(v.object({
        pattern: v.string(),
        severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
        message: v.string(),
        lineNumbers: v.optional(v.array(v.number())),
      })),
      e2b_verified: v.boolean(),
      overall_status: v.union(v.literal("passed"), v.literal("blocked"), v.literal("pending")),
      verified_at: v.number(),
    }),
    registry_entry: v.object({
      listed: v.boolean(),
      visible: v.boolean(),
      searchable: v.boolean(),
    }),
  })
    .index("by_skill", ["skill_id"]),

  // Skill BOMs — AI Bill of Materials for each skill
  skill_boms: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    version: v.string(),
    dependencies: v.array(v.object({
      name: v.string(),
      type: v.union(v.literal("tool"), v.literal("integration"), v.literal("package"), v.literal("api")),
      required: v.boolean(),
    })),
    permissions: v.array(v.object({
      permission: v.string(),
      reason: v.string(),
      risk_level: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    })),
    data_access: v.array(v.object({
      scope: v.string(),
      access_type: v.union(v.literal("read"), v.literal("write"), v.literal("execute")),
      description: v.string(),
    })),
    platform_requirements: v.array(v.string()),
    overall_risk: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    generated_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_name", ["skill_name"]),

  // OWASP Scans — OWASP LLM Top 10 compliance results
  owasp_scans: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    scan_date: v.number(),
    overall_score: v.number(),
    results: v.array(v.object({
      check_id: v.string(),
      name: v.string(),
      status: v.union(v.literal("pass"), v.literal("warn"), v.literal("fail")),
      details: v.string(),
      matched_patterns: v.optional(v.array(v.string())),
    })),
  })
    .index("by_skill_date", ["skill_id", "scan_date"]),

  // Cisco AI Defense Scan Results
  cisco_scan_results: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    scan_type: v.union(v.literal("api"), v.literal("local")),
    verdict: v.union(v.literal("clean"), v.literal("suspicious"), v.literal("malicious")),
    risk_score: v.number(),
    findings: v.array(v.object({
      category: v.string(),
      severity: v.union(v.literal("info"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      description: v.string(),
      line: v.optional(v.number()),
      snippet: v.optional(v.string()),
    })),
    scanned_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_verdict", ["verdict"]),

  // Snyk MCP-Scan Results
  snyk_scan_results: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    verdict: v.union(v.literal("clean"), v.literal("warning"), v.literal("critical")),
    total_issues: v.number(),
    critical_count: v.number(),
    warning_count: v.number(),
    info_count: v.number(),
    findings: v.array(v.object({
      category: v.string(),
      rule_id: v.string(),
      severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
      title: v.string(),
      description: v.string(),
      line: v.optional(v.number()),
      snippet: v.optional(v.string()),
      remediation: v.optional(v.string()),
    })),
    scanned_at: v.number(),
  })
    .index("by_skill", ["skill_id"])
    .index("by_verdict", ["verdict"]),

  // ============================================================================
  // Sandbox Testing Infrastructure
  // ============================================================================

  // Sandbox Test Queue — Priority queue for skill testing
  sandbox_test_queue: defineTable({
    skill_id: v.id("skills"),
    skill_name: v.string(),
    priority: v.number(),
    priority_reason: v.string(),
    status: v.string(),
    queued_at: v.number(),
    retry_count: v.number(),
    max_retries: v.number(),
    test_type: v.string(),
    assigned_agent_id: v.optional(v.string()),
    started_at: v.optional(v.number()),
    completed_at: v.optional(v.number()),
    sandbox_session_id: v.optional(v.string()),
    result: v.optional(v.object({
      passed: v.boolean(),
      exit_code: v.number(),
      duration_ms: v.number(),
      tests_run: v.number(),
      tests_passed: v.number(),
      security_issues: v.number(),
      error_summary: v.optional(v.string()),
    })),
  })
    .index("by_status", ["status"])
    .index("by_skill", ["skill_id"])
    .index("by_queued_at", ["queued_at"]),

  // Test Evidence — Screenshots, logs, and artifacts from testing
  test_evidence: defineTable({
    session_id: v.string(),
    skill_id: v.id("skills"),
    evidence_type: v.union(
      v.literal("screenshot"),
      v.literal("log_file"),
      v.literal("test_output"),
      v.literal("security_report")
    ),
    storage_id: v.optional(v.string()),
    content: v.optional(v.string()),
    description: v.string(),
    captured_at: v.number(),
  }),

  // Test Budget — Global budget tracking for E2B sandbox compute
  test_budget: defineTable({
    key: v.string(),
    daily_budget_ms: v.number(),
    daily_budget_tests: v.number(),
    used_today_ms: v.number(),
    used_today_tests: v.number(),
    budget_reset_at: v.number(),
    total_spent_ms: v.number(),
    total_tests_run: v.number(),
    last_test_at: v.number(),
    paused: v.boolean(),
  })
    .index("by_key", ["key"]),

  // ============================================================================
  // Hub Knowledge Editing
  // ============================================================================

  // Hub Guide Edits — Proposed and merged edits to hub knowledge items
  // ============================================================================
  // SmartSync: Template Versioning & Live Update System
  // ============================================================================

  template_versions: defineTable({
    template_slug: v.string(),
    version: v.string(),
    previous_version: v.optional(v.string()),
    manifest: v.string(), // JSON or gzip+base64: { files: [{ path, hash, content, size }], dashboardFiles: [...] }
    changelog: v.string(),
    published_at: v.number(),
    published_by: v.string(),
    compressed: v.optional(v.boolean()), // true if manifest is gzip+base64 encoded
  })
    .index("by_template", ["template_slug"])
    .index("by_template_version", ["template_slug", "version"])
    .index("by_published_at", ["template_slug", "published_at"]),

  hub_guide_edits: defineTable({
    knowledge_id: v.id("hub_knowledge"),
    section_id: v.optional(v.string()),
    proposed_body: v.string(),
    diff_summary: v.optional(v.string()),
    edit_type: v.string(),
    author_agent_id: v.string(),
    author_reputation: v.number(),
    status: v.string(),
    reviewed_by: v.optional(v.string()),
    evidence_ids: v.optional(v.array(v.string())),
    created_at: v.number(),
    merged_at: v.optional(v.number()),
  })
    .index("by_knowledge", ["knowledge_id"]),

  // Chat & Messages
  // ============================================================================

  // Workspace Events - Activity events for workspace detail page
  workspace_events: defineTable({
    workspace_id: v.id("workspaces"), // Reference to workspace
    machine_id: v.optional(v.string()), // Fly machine ID for context
    type: v.union(
      v.literal("machine_started"),
      v.literal("machine_stopped"),
      v.literal("machine_starting"),
      v.literal("openclaw_online"),
      v.literal("openclaw_offline"),
      v.literal("terminal_online"),
      v.literal("terminal_offline"),
      v.literal("status_check"),
      v.literal("custom")
    ),
    message: v.string(),
    icon: v.optional(v.string()),
    user_id: v.optional(v.string()), // Who triggered the event (if user-initiated)
    agent_id: v.optional(v.string()), // Which agent logged the event
    created_at: v.number(),
  })
    .index("by_workspace", ["workspace_id"])
    .index("by_workspace_created", ["workspace_id", "created_at"])
    .index("by_type", ["type"])
    .index("by_created_at", ["created_at"]),

  // Chat Messages - User and AI conversation messages
  chat_messages: defineTable({
    hub_id: v.optional(v.id("hubs")), // If workspace-scoped
    user_id: v.optional(v.string()), // If user-scoped
    agent_id: v.optional(v.string()), // If agent-scoped
    conversation_id: v.string(), // Conversation thread ID
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.object({
      tokens_used: v.optional(v.number()),
      model: v.optional(v.string()),
      latency_ms: v.optional(v.number()),
    })),
    created_at: v.number(),
  })
    .index("by_conversation", ["conversation_id"])
    .index("by_hub", ["hub_id"])
    .index("by_user", ["user_id"])
    .index("by_agent", ["agent_id"])
    .index("by_created_at", ["created_at"]),

  // Conversations - Metadata for chat conversations
  conversations: defineTable({
    hub_id: v.optional(v.id("hubs")),
    user_id: v.optional(v.string()),
    agent_id: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    message_count: v.number(),
    last_message_at: v.number(),
    status: v.union(v.literal("active"), v.literal("archived"), v.literal("deleted")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_hub", ["hub_id"])
    .index("by_user", ["user_id"])
    .index("by_status", ["status"])
    .index("by_created_at", ["created_at"]),

  // Chat conversations — workspace-scoped chat sessions
  chatConversations: defineTable({
    userId: v.string(),
    workspaceId: v.id("hubs"),
    title: v.optional(v.string()),
    messages: v.array(v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    })),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted")
    ),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId_workspaceId", ["userId", "workspaceId"])
    .index("by_updatedAt", ["updatedAt"]),

  // Stripe subscriptions — user billing plans
  subscriptions: defineTable({
    user_id: v.id("users"),
    plan_id: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("enterprise")
    ),
    stripe_customer_id: v.optional(v.string()),
    stripe_subscription_id: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("incomplete"),
      v.literal("payment_failed")
    ),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing")
    )),
    planId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    payment_failure_reason: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_stripe_customer", ["stripe_customer_id"])
    .index("by_stripe_subscription", ["stripe_subscription_id"]),

  // Real-time workspace activity feed
  workspace_activity: defineTable({
    workspaceId: v.optional(v.string()), // null = platform-wide event
    type: v.union(
      v.literal("workspace_join"),
      v.literal("workspace_create"),
      v.literal("profile_update"),
      v.literal("agent_run"),
      v.literal("skill_install"),
      v.literal("deploy"),
      v.literal("connect"),
      v.literal("login"),
      v.literal("generic")
    ),
    message: v.string(),
    actorId: v.optional(v.string()), // clerk_user_id or agent id
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_workspace", ["workspaceId"]),

  // ============================================================================
  // Team Collaboration: RBAC, shared workspaces, audit log (hubify-gap-008)
  // ============================================================================

  // Teams — Group users together for workspace collaboration
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    owner_user_id: v.string(), // Clerk user ID of team owner
    workspace_ids: v.array(v.id("hubs")), // Workspaces this team has access to
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_owner", ["owner_user_id"])
    .index("by_workspace", ["workspace_ids"]),

  // Team Members — Users in a team with specific roles
  team_members: defineTable({
    team_id: v.id("teams"),
    user_id: v.string(), // Clerk user ID
    email: v.string(),
    role: v.union(
      v.literal("admin"),     // Full control, can invite/remove members, change roles
      v.literal("editor"),    // Can run agents, edit workspace settings
      v.literal("viewer")     // Read-only access to dashboard
    ),
    invited_by: v.string(), // User ID who invited them
    invited_at: v.number(),
    joined_at: v.optional(v.number()), // When they accepted invitation
    status: v.union(
      v.literal("pending"),   // Invitation sent, not yet accepted
      v.literal("active"),    // Member accepted and active
      v.literal("removed")    // Member was removed
    ),
  })
    .index("by_team", ["team_id"])
    .index("by_user", ["user_id"])
    .index("by_email", ["email"])
    .index("by_team_user", ["team_id", "user_id"])
    .index("by_status", ["status"]),

  // Audit Log — Track all changes to workspace settings, shared data, and role changes
  audit_log: defineTable({
    team_id: v.optional(v.id("teams")),
    workspace_id: v.optional(v.id("hubs")),
    user_id: v.string(), // User who made the change
    action: v.string(), // "invited_user", "changed_role", "removed_member", "workspace_shared", "workspace_unshared", "settings_changed", etc.
    target_user_id: v.optional(v.string()), // User affected by the action (if applicable)
    target_user_email: v.optional(v.string()),
    old_value: v.optional(v.string()), // Previous value (for changes)
    new_value: v.optional(v.string()), // New value (for changes)
    details: v.optional(v.string()), // Additional context
    ip_address: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_team", ["team_id"])
    .index("by_workspace", ["workspace_id"])
    .index("by_user", ["user_id"])
    .index("by_target_user", ["target_user_id"])
    .index("by_timestamp", ["timestamp"])
    .index("by_team_timestamp", ["team_id", "timestamp"]),

  // Workspace Access Control — Maps teams to workspaces with permission levels
  workspace_access: defineTable({
    workspace_id: v.id("hubs"),
    team_id: v.id("teams"),
    access_granted_by: v.string(), // User ID who granted access
    access_level: v.union(
      v.literal("read"),       // View only
      v.literal("edit"),       // Can edit settings and run agents
      v.literal("admin")       // Full admin access
    ),
    granted_at: v.number(),
    revoked_at: v.optional(v.number()), // When access was revoked
  })
    .index("by_workspace", ["workspace_id"])
    .index("by_team", ["team_id"])
    .index("by_workspace_team", ["workspace_id", "team_id"]),

  // ============================================================================
  // HUBIFY LABS: Experiment DAG (Karpathy AgentHub-inspired)
  // ============================================================================

  // Experiment nodes — DAG of research experiments (no main branch, just a graph)
  experiment_nodes: defineTable({
    // DAG structure
    parent_ids: v.array(v.id("experiment_nodes")),
    mission_id: v.id("research_missions"),
    agent_id: v.string(),

    // Experiment content
    description: v.string(),
    code_snapshot: v.string(),       // skill.md or config content (capped at 500KB)
    config_diff: v.optional(v.string()),

    // Results
    metrics: v.optional(v.object({
      primary_metric: v.string(),
      primary_value: v.number(),
      secondary_metrics: v.optional(v.record(v.string(), v.number())),
    })),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("reverted")
    ),
    duration_ms: v.optional(v.number()),

    // Claims (prevents duplicate frontier work)
    claimed_by: v.optional(v.string()),
    claim_expires_at: v.optional(v.number()),

    // DAG metadata
    depth: v.number(),
    created_at: v.number(),
  })
    .index("by_mission", ["mission_id"])
    .index("by_agent", ["agent_id"])
    .index("by_status", ["status"])
    .index("by_mission_status", ["mission_id", "status"]),

  // Materialized frontier — leaf nodes for O(1) frontier queries
  frontier_nodes: defineTable({
    node_id: v.id("experiment_nodes"),
    mission_id: v.id("research_missions"),
    primary_value: v.optional(v.number()),
    depth: v.number(),
    subtree_root: v.optional(v.id("experiment_nodes")),
    created_at: v.number(),
  })
    .index("by_mission", ["mission_id"])
    .index("by_mission_value", ["mission_id", "primary_value"]),

  // Mission usage tracking — per-mission token/cost accounting
  mission_usage: defineTable({
    mission_id: v.id("research_missions"),
    total_input_tokens: v.number(),
    total_output_tokens: v.number(),
    total_cost_usd: v.number(),
    requests_count: v.number(),
    by_provider: v.optional(v.any()), // { "anthropic/claude-sonnet-4-6": { input_tokens, output_tokens, cost_usd, requests } }
    last_updated: v.number(),
  })
    .index("by_mission", ["mission_id"]),

  // Skill propagation tracking — cross-workspace skill auto-update
  skill_propagation: defineTable({
    workspace_id: v.string(),
    agent_id: v.string(),
    skills: v.array(v.object({
      name: v.string(),
      version: v.string(),
      installed_at: v.number(),
    })),
    auto_update: v.boolean(),
    last_sync: v.number(),
  })
    .index("by_workspace", ["workspace_id"])
    .index("by_agent", ["agent_id"]),

  // Collective Insights — Cross-workspace knowledge sharing beyond just skills
  // Workspaces share learnings, patterns, findings, techniques, and failure lessons
  // that other workspaces can discover, validate, and apply
  collective_insights: defineTable({
    type: v.union(
      v.literal("learning"),
      v.literal("pattern"),
      v.literal("finding"),
      v.literal("technique"),
      v.literal("experiment_result"),
      v.literal("failure_lesson")
    ),
    title: v.string(),
    content: v.string(),
    context: v.optional(v.string()), // what the agent was doing when it discovered this
    source_workspace_id: v.optional(v.string()),
    source_agent_id: v.string(),
    source_skill_id: v.optional(v.id("skills")), // linked skill if applicable
    source_mission_id: v.optional(v.id("research_missions")),
    source_experiment_node_id: v.optional(v.id("experiment_nodes")),
    tags: v.array(v.string()),
    confidence: v.number(), // 0-1, how confident the source is
    validations: v.number(), // how many other workspaces confirmed
    applications: v.number(), // how many workspaces applied this
    status: v.union(
      v.literal("active"),
      v.literal("superseded"),
      v.literal("disputed"),
      v.literal("archived")
    ),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_type", ["type", "created_at"])
    .index("by_source_agent", ["source_agent_id"])
    .index("by_source_workspace", ["source_workspace_id"])
    .index("by_skill", ["source_skill_id"])
    .index("by_status", ["status", "created_at"])
    .searchIndex("search_insights", {
      searchField: "content",
      filterFields: ["type", "status"],
    }),

  // Collective Insight Validations — Track which workspaces validated/applied an insight
  collective_validations: defineTable({
    insight_id: v.id("collective_insights"),
    agent_id: v.string(),
    workspace_id: v.optional(v.string()),
    action: v.union(
      v.literal("validated"),    // confirmed it works
      v.literal("applied"),      // applied it locally
      v.literal("disputed"),     // disagrees with the insight
      v.literal("superseded")    // found something better
    ),
    comment: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_insight", ["insight_id"])
    .index("by_agent", ["agent_id"]),

  // Org Skills — Organization-scoped skill registry for enterprise intelligence isolation
  org_skills: defineTable({
    org_id: v.id("organizations"),
    skill_id: v.id("skills"),
    added_by: v.string(),
    added_at: v.number(),
    access_level: v.union(v.literal("private"), v.literal("shared"), v.literal("public")),
  })
    .index("by_org", ["org_id"])
    .index("by_skill", ["skill_id"])
    .index("by_org_skill", ["org_id", "skill_id"]),

  // Hub Subscriptions — Many-to-many: workspace hub subscribes to platform hubs
  // Enables cross-pollination of knowledge from source hubs to subscriber workspace hubs
  hub_subscriptions: defineTable({
    subscriber_hub_id: v.id("hubs"),
    source_hub_id: v.id("hubs"),
    subscribed_at: v.number(),
    status: v.union(v.literal("active"), v.literal("paused")),
  })
    .index("by_subscriber", ["subscriber_hub_id"])
    .index("by_source", ["source_hub_id"])
    .index("by_pair", ["subscriber_hub_id", "source_hub_id"]),

  // Audit Events — Immutable log of user actions for security and compliance
  audit_events: defineTable({
    user_id: v.string(),
    action: v.string(), // e.g. "member_invited", "skill_installed", "settings_changed", "token_created", "workspace_created", "backup_created"
    target_type: v.optional(v.string()), // "workspace", "skill", "agent", "token", etc.
    target_id: v.optional(v.string()),
    metadata: v.optional(v.any()),
    ip_address: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id", "created_at"])
    .index("by_action", ["action", "created_at"]),

  // Scheduled Jobs — Timezone-aware cron scheduling for hubs
  scheduled_jobs: defineTable({
    hub_id: v.id("hubs"),
    name: v.string(),
    cron_expression: v.string(),
    action: v.string(),
    timezone: v.string(),
    enabled: v.boolean(),
    last_run_at: v.optional(v.number()),
    next_run_at: v.optional(v.number()),
    run_count: v.optional(v.number()),
    last_error: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_hub", ["hub_id"])
    .index("by_next_run", ["enabled", "next_run_at"]),

  // System Updates — CLI and workspace version tracking
  system_updates: defineTable({
    user_id: v.string(),
    update_type: v.union(
      v.literal("cli"),
      v.literal("workspace_image"),
      v.literal("convex_schema")
    ),
    from_version: v.string(),
    to_version: v.string(),
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("rolled_back")
    ),
    error_message: v.optional(v.string()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id", "created_at"])
    .index("by_type", ["update_type", "created_at"]),

  // Backup Schedules — Automated backup configuration per hub
  backup_schedules: defineTable({
    hub_id: v.id("hubs"),
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    retention_days: v.number(),
    enabled: v.boolean(),
    last_backup_at: v.optional(v.number()),
    next_backup_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_hub", ["hub_id"])
    .index("by_next_backup", ["enabled", "next_backup_at"]),

  // Backup History — Record of completed backups
  backup_history: defineTable({
    hub_id: v.id("hubs"),
    schedule_id: v.optional(v.id("backup_schedules")),
    filename: v.string(),
    size_bytes: v.number(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("in_progress")
    ),
    error_message: v.optional(v.string()),
    triggered_by: v.union(v.literal("manual"), v.literal("scheduled")),
    created_at: v.number(),
  })
    .index("by_hub", ["hub_id", "created_at"])
    .index("by_schedule", ["schedule_id", "created_at"]),

  // Workspace Commits — Local git commit tracking for version control
  workspace_commits: defineTable({
    hub_id: v.string(),
    sha: v.string(),
    short_sha: v.string(),
    message: v.string(),
    author: v.string(),
    files_changed: v.number(),
    commit_type: v.union(
      v.literal("initial"),
      v.literal("manual"),
      v.literal("auto"),
      v.literal("rollback"),
      v.literal("export")
    ),
    timestamp: v.number(),
  }).index("by_hub", ["hub_id"])
    .index("by_hub_timestamp", ["hub_id", "timestamp"])
    .index("by_sha", ["sha"]),

  // ============================================================================
  // Pillar 2: Agent Social Network — Knowledge Exchange
  // ============================================================================

  // Knowledge Threads — Structured Q&A, discussions, proposals, findings
  knowledge_threads: defineTable({
    hub_id: v.id("hubs"),
    thread_type: v.union(
      v.literal("question"),
      v.literal("discussion"),
      v.literal("proposal"),
      v.literal("finding"),
    ),
    title: v.string(),
    body: v.string(),
    author_agent_id: v.string(),
    author_type: v.union(v.literal("agent"), v.literal("user")),

    // Q&A specific
    accepted_answer_id: v.optional(v.id("knowledge_responses")),
    bounty_reputation: v.optional(v.number()),

    // Voting
    upvotes: v.number(),
    downvotes: v.number(),
    score: v.number(),

    // Linking
    tags: v.array(v.string()),
    linked_skill_ids: v.optional(v.array(v.string())),
    linked_mission_id: v.optional(v.id("research_missions")),
    linked_experiment_node_id: v.optional(v.id("experiment_nodes")),

    // Status
    status: v.union(v.literal("open"), v.literal("answered"), v.literal("closed")),
    view_count: v.number(),
    response_count: v.number(),

    created_at: v.number(),
    last_activity_at: v.number(),
  })
    .index("by_hub", ["hub_id"])
    .index("by_type", ["thread_type", "created_at"])
    .index("by_status", ["status", "created_at"])
    .index("by_hub_type", ["hub_id", "thread_type"])
    .index("by_score", ["score"])
    .index("by_author", ["author_agent_id"])
    .searchIndex("search_threads", {
      searchField: "title",
      filterFields: ["thread_type", "status"],
    }),

  // Knowledge Responses — Answers/replies to knowledge threads
  knowledge_responses: defineTable({
    thread_id: v.id("knowledge_threads"),
    body: v.string(),
    author_agent_id: v.string(),
    author_type: v.union(v.literal("agent"), v.literal("user")),
    is_accepted: v.boolean(),

    // Voting
    upvotes: v.number(),
    downvotes: v.number(),
    score: v.number(),

    // Code/skill reference
    code_snippet: v.optional(v.string()),
    suggested_skill_id: v.optional(v.string()),

    created_at: v.number(),
    edited_at: v.optional(v.number()),
  })
    .index("by_thread", ["thread_id"])
    .index("by_author", ["author_agent_id"])
    .index("by_score", ["score"]),

  // Votes — Generic voting system for threads, responses, knowledge, posts
  votes: defineTable({
    entity_type: v.union(
      v.literal("thread"),
      v.literal("response"),
      v.literal("knowledge"),
      v.literal("post")
    ),
    entity_id: v.string(),
    voter_id: v.string(),
    vote: v.union(v.literal("up"), v.literal("down")),
    created_at: v.number(),
  })
    .index("by_entity", ["entity_type", "entity_id"])
    .index("by_voter", ["voter_id"])
    .index("by_entity_voter", ["entity_type", "entity_id", "voter_id"]),

  // Skill Relationships — Co-installation, evolution, recommendation network
  skill_relationships: defineTable({
    skill_a: v.string(),
    skill_b: v.string(),
    relationship_type: v.union(
      v.literal("co_installed"),
      v.literal("evolved_from"),
      v.literal("recommended_with"),
      v.literal("alternative_to"),
    ),
    strength: v.number(),
    sample_size: v.number(),
    updated_at: v.number(),
  })
    .index("by_skill_a", ["skill_a"])
    .index("by_skill_b", ["skill_b"])
    .index("by_type", ["relationship_type"]),

  // Learning Progress — Track user progress through template learning paths
  learning_progress: defineTable({
    user_id: v.string(),
    template_slug: v.string(),
    hub_id: v.optional(v.id("hubs")),
    completed_steps: v.array(v.number()),
    started_at: v.number(),
    last_activity_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_user_template", ["user_id", "template_slug"]),

  // Workspace Health Alerts — Configurable alert rules per workspace
  workspace_alerts: defineTable({
    hub_id: v.string(),
    alert_type: v.string(),
    threshold: v.number(),
    enabled: v.boolean(),
    notification_channels: v.array(v.string()),
    webhook_url: v.optional(v.string()),
    last_triggered_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_hub", ["hub_id"]),

  // Studio Sessions — Template development drafts in Claws Studio
  studio_sessions: defineTable({
    user_id: v.string(),
    title: v.string(),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
      })
    ),
    // Forked from an existing template
    forked_from: v.optional(v.string()),
    // Share preview link ID
    share_id: v.optional(v.string()),
    // Vibe coder generation history
    generations: v.optional(
      v.array(
        v.object({
          prompt: v.string(),
          model: v.string(),
          files_generated: v.array(v.string()),
          timestamp: v.number(),
        })
      )
    ),
    // Skills selected for this template
    selected_skills: v.optional(v.array(v.string())),
    // Status
    status: v.union(v.literal("draft"), v.literal("published")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user", ["user_id", "updated_at"])
    .index("by_share_id", ["share_id"]),

  // Alert Notifications — In-app notifications triggered by alert rules
  alert_notifications: defineTable({
    alert_id: v.id("workspace_alerts"),
    hub_id: v.string(),
    alert_type: v.string(),
    message: v.string(),
    severity: v.string(),
    acknowledged: v.boolean(),
    created_at: v.number(),
  })
    .index("by_hub_ack", ["hub_id", "acknowledged"]),

  // ============================================================================
  // HUBIFY LAB — Per-Project Research Coordination
  // ============================================================================

  // Lab Projects — Registry of all per-project Convex apps
  lab_projects: defineTable({
    name: v.string(),
    slug: v.string(),
    display_name: v.string(),
    description: v.string(),
    owner_id: v.string(),

    // Per-project Convex app connection
    convex_deployment_name: v.optional(v.string()),
    convex_url: v.optional(v.string()),

    // Infrastructure
    github_repo: v.optional(v.string()),
    fly_machine_ids: v.optional(v.array(v.string())),
    runpod_pod_ids: v.optional(v.array(v.string())),

    // Lifecycle
    phase: v.string(), // ideation|planning|provisioning|execution|discovery|publication|maintenance

    // Budget
    budget_usd: v.optional(v.float64()),
    spent_usd: v.optional(v.float64()),

    // Linkage
    squad_id: v.optional(v.id("squads")),
    mission_id: v.optional(v.id("research_missions")),
    hub_id: v.optional(v.id("hubs")),

    // Data summary (pushed by the project)
    data_summary: v.optional(v.object({
      total_objects: v.optional(v.float64()),
      total_anomalies: v.optional(v.float64()),
      total_reviews: v.optional(v.float64()),
      pipelines: v.optional(v.array(v.string())),
      last_pipeline_run: v.optional(v.float64()),
    })),

    // Cross-project
    cross_match_enabled: v.boolean(),
    anomaly_push_enabled: v.boolean(),

    // Status
    status: v.string(), // active|paused|completed|archived|provisioning
    last_heartbeat: v.optional(v.float64()),
    last_sync_at: v.optional(v.float64()),

    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_owner", ["owner_id"])
    .index("by_hub", ["hub_id"]),

  // Cross-Project Anomalies — Unified anomaly ledger for spatial correlation
  cross_project_anomalies: defineTable({
    project_name: v.string(),
    lab_project_id: v.optional(v.id("lab_projects")),

    // Object identity
    object_id: v.string(),
    pipeline_id: v.string(),

    // Position (J2000 degrees)
    ra: v.float64(),
    dec: v.float64(),

    // Anomaly info
    anomaly_score: v.float64(),
    anomaly_type: v.string(),
    summary: v.optional(v.string()),

    // Cross-match results
    cross_match_count: v.optional(v.float64()),

    pushed_at: v.float64(),
  })
    .index("by_project", ["project_name"])
    .index("by_score", ["anomaly_score"])
    .index("by_position", ["ra", "dec"]),

  // ============================================================================
  // HUBIFY LAB — Research Artifact Tracking
  // ============================================================================

  // Experiment Runs — karpathy results.tsv equivalent in Convex
  experiment_runs: defineTable({
    lab_project_id: v.id("lab_projects"),
    pipeline_step: v.float64(),
    run_index: v.float64(),
    description: v.string(),
    git_commit_sha: v.optional(v.string()),
    metric_name: v.optional(v.string()),
    metric_value: v.optional(v.float64()),
    metric_direction: v.optional(v.string()),
    resources: v.optional(v.object({
      gpu_type: v.optional(v.string()),
      vram_gb: v.optional(v.float64()),
      duration_s: v.optional(v.float64()),
      cost_usd: v.optional(v.float64()),
    })),
    status: v.string(),
    created_at: v.float64(),
  })
    .index("by_project", ["lab_project_id"])
    .index("by_project_step", ["lab_project_id", "pipeline_step"]),

  // Research Models — fine-tuned model tracking
  research_models: defineTable({
    lab_project_id: v.id("lab_projects"),
    model_name: v.string(),
    model_type: v.string(),
    huggingface_url: v.optional(v.string()),
    architecture_summary: v.optional(v.string()),
    training_samples: v.optional(v.float64()),
    training_duration_s: v.optional(v.float64()),
    training_cost_usd: v.optional(v.float64()),
    metrics: v.optional(v.any()),
    status: v.string(),
    created_at: v.float64(),
  })
    .index("by_project", ["lab_project_id"])
    .index("by_status", ["status"]),

  // Research Datasets — catalogs, sources, hybrids
  research_datasets: defineTable({
    lab_project_id: v.id("lab_projects"),
    dataset_name: v.string(),
    dataset_type: v.string(),
    row_count: v.optional(v.float64()),
    column_count: v.optional(v.float64()),
    columns: v.optional(v.array(v.string())),
    storage_type: v.optional(v.string()),
    storage_url: v.optional(v.string()),
    huggingface_url: v.optional(v.string()),
    size_bytes: v.optional(v.float64()),
    source_description: v.optional(v.string()),
    provenance: v.optional(v.string()),
    status: v.string(),
    created_at: v.float64(),
  })
    .index("by_project", ["lab_project_id"])
    .index("by_type", ["dataset_type"]),

  // Research Papers — LaTeX document tracking
  research_papers: defineTable({
    lab_project_id: v.id("lab_projects"),
    paper_number: v.float64(),
    title: v.string(),
    abstract: v.optional(v.string()),
    latex_path: v.optional(v.string()),
    pdf_path: v.optional(v.string()),
    version: v.string(),
    preprint_id: v.optional(v.string()),
    reference_count: v.optional(v.float64()),
    page_count: v.optional(v.float64()),
    status: v.string(),
    arxiv_id: v.optional(v.string()),
    review_rounds: v.optional(v.any()),
    created_at: v.float64(),
    updated_at: v.float64(),
  })
    .index("by_project", ["lab_project_id"])
    .index("by_status", ["status"]),

  // Project Heartbeats — live machine status
  project_heartbeats: defineTable({
    lab_project_id: v.id("lab_projects"),
    machine_type: v.string(),
    current_activity: v.optional(v.string()),
    pipeline_step: v.optional(v.float64()),
    progress_pct: v.optional(v.float64()),
    eta_seconds: v.optional(v.float64()),
    disk_used_mb: v.optional(v.float64()),
    disk_total_mb: v.optional(v.float64()),
    memory_used_mb: v.optional(v.float64()),
    errors_since_last: v.optional(v.float64()),
    findings_since_last: v.optional(v.float64()),
    created_at: v.float64(),
  })
    .index("by_project", ["lab_project_id", "created_at"]),

  // Research Figures — publication figure tracking
  research_figures: defineTable({
    lab_project_id: v.id("lab_projects"),
    paper_id: v.optional(v.id("research_papers")),
    figure_number: v.optional(v.float64()),
    title: v.string(),
    caption: v.optional(v.string()),
    generation_script: v.optional(v.string()),
    source_data: v.optional(v.string()),
    storage_url: v.optional(v.string()),
    thumbnail_url: v.optional(v.string()),
    used_in_paper: v.optional(v.boolean()),
    used_on_site: v.optional(v.boolean()),
    created_at: v.float64(),
  })
    .index("by_project", ["lab_project_id"])
    .index("by_paper", ["paper_id"]),

  // Ideas Backlog — speculations and future directions
  ideas_backlog: defineTable({
    lab_project_id: v.optional(v.id("lab_projects")),
    title: v.string(),
    description: v.string(),
    domain: v.optional(v.string()),
    priority: v.string(),
    promoted_to_project_id: v.optional(v.id("lab_projects")),
    source: v.optional(v.string()),
    created_at: v.float64(),
  })
    .index("by_project", ["lab_project_id"])
    .index("by_priority", ["priority"]),

  // ============================================================================
  // TEAM COLLABORATION (RBAC, Shared Workspaces, Audit Log)
  // ============================================================================

  // Workspace Members — User roles within each workspace
  workspace_members: defineTable({
    workspace_id: v.id("workspaces"),
    user_id: v.id("users"),
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    invited_by: v.optional(v.id("users")), // Who invited this member
    invite_token: v.optional(v.string()), // One-time token for email invite
    invite_token_expires_at: v.optional(v.number()), // 7-day expiry
    invite_accepted_at: v.optional(v.number()), // When invite was accepted
    added_at: v.number(), // When member was added to workspace
    updated_at: v.number(),
  })
    .index("by_workspace", ["workspace_id"])
    .index("by_user", ["user_id"])
    .index("by_email", ["email"])
    .index("by_workspace_user", ["workspace_id", "user_id"])
    .index("by_invite_token", ["invite_token"]),

  // Audit Log — Track all team collaboration actions
  workspace_audit_log: defineTable({
    workspace_id: v.id("workspaces"),
    user_id: v.optional(v.id("users")), // Who performed the action
    user_email: v.optional(v.string()), // Email for reference
    action: v.union(
      v.literal("invite_user"),
      v.literal("accept_invite"),
      v.literal("change_role"),
      v.literal("remove_user"),
      v.literal("create_content"),
      v.literal("edit_content"),
      v.literal("delete_content"),
      v.literal("update_settings"),
      v.literal("workspace_created"),
      v.literal("workspace_deleted")
    ),
    resource_type: v.optional(v.string()), // "user", "document", "project", "workspace_settings"
    resource_id: v.optional(v.string()), // ID of the affected resource
    resource_name: v.optional(v.string()), // Human-readable name
    details: v.optional(v.object({
      // Flexible object for action-specific details
      old_value: v.optional(v.any()),
      new_value: v.optional(v.any()),
      target_email: v.optional(v.string()),
      target_user_id: v.optional(v.string()),
    })),
    timestamp: v.number(),
  })
    .index("by_workspace", ["workspace_id"])
    .index("by_user", ["user_id"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"])
    .index("by_workspace_timestamp", ["workspace_id", "timestamp"]),

  // Workspace Invitations — Pending email invitations
  workspace_invitations: defineTable({
    workspace_id: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    invite_token: v.string(), // One-time token
    invite_token_expires_at: v.number(), // 7-day expiry
    invited_by: v.id("users"),
    sent_at: v.number(),
    accepted_at: v.optional(v.number()),
  })
    .index("by_workspace", ["workspace_id"])
    .index("by_email", ["email"])
    .index("by_invite_token", ["invite_token"])
    .index("by_workspace_email", ["workspace_id", "email"]),
});
