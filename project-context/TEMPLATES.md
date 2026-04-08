# Hubify Workspace Templates

**Last Updated:** 2026-02-21  
**Status:** All templates built, tested, and ready for provisioning

---

## Overview

Each Hubify workspace is built from a template. Templates define:
- **SOUL.md** — Agent personality and workflow philosophy
- **AGENTS.md** — Core instructions and task patterns
- **Pre-installed skills** — Tools and integrations baked in
- **Default memory structure** — Files for notes, learnings, tasks
- **Dashboard UI** — Optional customization of web interface

---

## Built-in Templates (All Available)

### 1. **MyOS** — Full Personal Operating System

**Best For:** Founders, builders, and power users  
**Icon:** 🤖  
**Live Installs:** 1,247+

#### What You Get

- **Personality:** You're {{USERNAME}}'s personal operating system. You run 24/7, think like them, own their goals.
- **Pre-installed Skills:**
  - `strava` — Fitness tracking and accountability
  - `github` — Code, PRs, deployments
  - `telegram-topics` — Chat and notifications
  - `apple-reminders` — Task management
  - `things-mac` — Advanced todo tracking
  - `weather` — Local weather and planning
  - `gog` — Email drafts (never send)

#### Directory Structure

```
myos/
  SOUL.md              # Full personality: who you are, what you do
  AGENTS.md            # Instructions: core patterns, workflows
  USER.md              # User profile (personalized on install)
  MEMORY.md            # Long-term memory template
  HEARTBEAT.md         # Daily automation checklist
  WELCOME.md           # Onboarding message
  skills/
    strava/           # Fitness sync
    github/           # Code integration
    telegram-topics/  # Chat system
    apple-reminders/  # Todo management
    things-mac/       # Advanced todos
    weather/          # Local weather
    gog/              # Email assistant
  knowledge/          # Knowledge base (evergreen)
  learnings/          # Daily learnings log
  memory/             # Episodic memory (YYYY-MM-DD.md files)
  projects/           # User workspace
```

#### SOUL.md Excerpt

> *You are {{USERNAME}}'s personal operating system.*  
> *You live in the cloud, run 24/7, and think like them.*  
> *You own everything: fitness, code, communications, plans, and decisions.*

---

### 2. **Dev OS** — Code-Focused Developer Environment

**Best For:** Developers, engineers, technical teams  
**Icon:** 💻  
**Live Installs:** 892+

#### What You Get

- **Personality:** You're {{USERNAME}}'s coding partner. You live in Dev OS — a purpose-built environment for shipping code fast.
- **Workflow:** Read code → Review PRs → Suggest alternatives → Write tests → Push for shipping
- **Pre-installed Skills:**
  - `github` — Full GitHub integration (PRs, issues, repos)
  - `coding-agent` — Code review and generation
  - `things-mac` — Task/todo management
  - `session-logs` — Development session history

#### Core Philosophy

**From SOUL.md:**
> *Bias toward code, not conversation.*  
> *Don't explain what you did. Show the diff.*  
> *Code review is your superpower.*  
> *Automate the repetitive.*  
> *Ship > Perfect.*

#### AGENTS.md Rules

- ✅ **PRs only** — Never push to main
- ✅ **Tests are real** — Every feature gets tested
- ✅ **Code review first** — Understand before changing
- ✅ **Automate repetitive work** — Tests, docs, changelogs
- ✅ **Respect the codebase** — Learn patterns, don't override

#### Directory Structure

```
devos/
  SOUL.md              # Developer philosophy
  AGENTS.md            # Code instructions, PR workflow
  USER.md              # User profile
  MEMORY.md            # Codebase learnings
  HEARTBEAT.md         # Daily code checks
  WELCOME.md           # Developer onboarding
  skills/
    github/            # PR reviews, code changes
    coding-agent/      # Code generation, refactoring
    things-mac/        # Dev todos
    session-logs/      # Track what you built
  knowledge/           # Architecture patterns
  learnings/           # Technical lessons learned
  memory/              # Daily dev logs
  projects/            # Codebases to work on
```

---

### 3. **Founder OS** — Go-to-Market Growth Engine

**Best For:** Entrepreneurs, founders, agency operators  
**Icon:** 🚀  
**Live Installs:** 756+

#### What You Get

- **Personality:** You're {{USERNAME}}'s co-founder in the Founder OS. You run 24/7 in the cloud. You own growth: sales pipeline, content, messaging, partnerships.
- **Workflow:** Track deals → Write copy → Build partnerships → Measure results → Iterate
- **Pre-installed Skills:**
  - `github` — Product repo access
  - `apple-reminders` — Sales tasks
  - `gog` — Email drafting
  - LinkedIn/CRM integration (coming)
  - Analytics integration (coming)

#### Core Philosophy

**From SOUL.md:**
> *You're not a chatbot. You're {{USERNAME}}'s go-to-market engine.*  
> *Growth is everything.*  
> *Move fast and iterate.*  
> *Be convincing.*  
> *Own the full funnel.*  
> *Network is moat.*

#### AGENTS.md Rules

- ✅ **ALWAYS DRAFT, NEVER SEND** — All external comms go to {{USERNAME}} first
- ✅ **Metrics over activity** — Revenue, users, brand, momentum
- ✅ **Copy is strategy** — Every word matters
- ✅ **Customers are real** — Understand their problems
- ✅ **Relationship capital** — Your network is your moat

#### Directory Structure

```
founderos/
  SOUL.md              # Founder philosophy: growth, metrics, messaging
  AGENTS.md            # GTM instructions, sales, content workflow
  USER.md              # Company profile (personalized)
  MEMORY.md            # Market trends, customer insights
  HEARTBEAT.md         # Weekly GTM checklist
  WELCOME.md           # Founder onboarding
  skills/
    github/            # Product integration
    apple-reminders/   # Sales todo tracking
    gog/               # Email drafts (always draft, never send!)
  knowledge/           # GTM playbooks, sales scripts
  learnings/           # Deal learnings, customer feedback
  memory/              # Daily sales log, market intel
  projects/            # Campaigns, products, partnerships
```

---

### 4. **Research OS** — Deep Knowledge & Synthesis

**Best For:** Researchers, academics, knowledge workers  
**Icon:** 🔬  
**Live Installs:** 421+

#### What You Get

- **Pre-installed Skills:**
  - `arxiv` — Academic papers
  - `perplexity` — Fast research
  - `knowledge-hub` — Synthesis and indexing
  - `things-mac` — Research tasks

#### Core Workflow

1. Find papers and research sources
2. Synthesize findings into knowledge bases
3. Track learnings and insights
4. Connect ideas across topics

---

### 5. **Company OS** — AI Company Orchestration

**Best For:** Founders and operators running AI-native companies
**Icon:** 🏢
**Slug:** `company-os`
**Live Installs:** 0 (new)

#### What You Get

- **Personality:** Chief of Staff — orchestrates an executive team of AI agents (CEO, CTO, CMO, COO), tracks OKRs, manages delegation, enforces approval gates, maintains audit trail
- **Pre-installed Skills:**
  - `company-briefing` — Full company status report (goals, agents, budget, decisions needed)
  - `morning-brief` — Daily priority orientation
  - `meeting-notes` — Structured notes from any transcript
  - `quick-capture` — Save decisions and context instantly
  - `web-research` — Competitive intel and market research
  - `email-draft` — Company communications (always draft, never send)
  - `github` — Engineering activity and PR oversight

#### Core Philosophy

**From SOUL.md:**
> *You're not a chatbot. You're the operating system of an AI-native company.*
> *The mission is everything. Org clarity before execution. Delegate aggressively, verify precisely.*
> *Budget is real. Audit everything. Be direct with {{USERNAME}}.*

#### Goal Hierarchy

```
Mission (why we exist)
  └── Objectives (quarterly goals)
        └── Projects (scoped work streams)
              └── Tasks (delegated to agents or humans)
```

#### Directory Structure

```
companyos/
  SOUL.md              # Chief of Staff personality and philosophy
  AGENTS.md            # Org management, delegation, audit, safety rules
  USER.md              # Company profile, OKRs, org chart, budget (personalized)
  MEMORY.md            # Company long-term memory (decisions, agent performance)
  HEARTBEAT.md         # Company proactive checklist (goals, agents, budget, intel)
  WELCOME.md           # Company OS onboarding — mission, OKRs, agent activation
  skills/
    company-briefing/  # Full company status report
    github/            # Engineering oversight
    gog/               # Email drafting (draft only)
    things-mac/        # Task management
    apple-reminders/   # Reminders
    weather/           # Weather (for briefings)
  knowledge/           # Org chart, goals, competitive intel
  learnings/           # Competitive intel, agent learnings
  memory/              # Daily logs, audit trail, budget tracker
```

#### Approval Gates (Always Required)

- All external communications (draft first, {{USERNAME}} sends)
- Budget spend above user-defined threshold
- Agent hiring, firing, or scope changes
- Changes to company mission or objectives
- Code commits to main branches

---

### 6. **Client OS** — Agency Project Management

**Best For:** Agencies, service providers, client management  
**Icon:** 📋  
**Live Installs:** 534+

#### What You Get

- **Pre-installed Skills:**
  - `project-tracker` — Client projects
  - `client-comms` — Communication logs
  - `deliverables` — Output tracking
  - `reporting` — Weekly/monthly reports

#### Key Feature

**White-label ready** — Customize branding, client name, color scheme. Ready to rebrand for client delivery.

---

### 6. **Minimal** — Blank Canvas

**Best For:** Power users building custom workflows  
**Icon:** 🎨  
**Live Installs:** 189+

#### What You Get

- **Reserved structure only** — No pre-installed skills
- **Blank slate** — Install and customize as you go
- **Full flexibility** — Build your exact workflow

---

## Template Provisioning Flow

### User Journey

1. **Visit /templates** → Browse template gallery
2. **Click template card** → See full spec + description
3. **Click "Use Template"** → Enter workspace name
4. **Select template** (optional, pre-selected)
5. **Click "Create Workspace"** → Provision starts
6. **~90 seconds** → Workspace ready at `username.hubify.com`
7. **Template files seeded** → All SOUL.md, AGENTS.md, skills ready
8. **Run `hubify connect`** → Sync local + cloud

### API Flow

```
POST /api/workspaces
├── Input: { templateId: "myos", name: "houston" }
├── Verify auth (Clerk)
├── Rate limit check (10 req/min)
├── Create hub in Convex
├── Create Fly app: hubify-ws-houston
├── Create persistent volume: /data
├── Provision machine with template Docker image
├── Update hub with machine details
└── Return: { hubId, machineId, workspaceUrl, status: "provisioning" }

[~90 seconds later]
├── Machine boots
├── Seed template files from /opt/workspace/ → /data/
├── Personalize SOUL.md, USER.md ({{USERNAME}} → actual user)
├── Start OpenClaw gateway + dashboard
└── Workspace live at yourname.hubify.com
```

---

## Creating Your Own Template

### Step 1: Fork Existing Template

```bash
# Start with MyOS
cp -r infra/workspace/templates/myos templates/my-custom-os
```

### Step 2: Customize SOUL.md

```markdown
# SOUL.md — Your Custom Persona

*Who is this agent for? What's their philosophy?*

## Who You Are

[Your personality, values, workflow...]

## Boundaries

[Rules and constraints...]
```

### Step 3: Customize AGENTS.md

```markdown
# AGENTS.md — Your Custom Instructions

[Core principles, workflows, patterns specific to this template...]
```

### Step 4: Add Skills

Place skill folders in `skills/` directory:

```
my-custom-os/skills/
  skill-1/SKILL.md
  skill-2/SKILL.md
  custom-integration/
    SKILL.md
    config.yaml
```

### Step 5: Publish

```bash
hubify template publish \
  --name "My Custom OS" \
  --slug my-custom-os \
  --icon "🚀" \
  --description "For when you need X"
```

Your template appears in the gallery within minutes.

---

## Template Update Flow

### Scenario: You Update MyOS

1. **Modify** `infra/workspace/templates/myos/SOUL.md`
2. **Rebuild Docker image** (automatic via CI/CD)
3. **Existing workspaces:** Option to "update to latest template"
4. **New workspaces:** Always get the latest version

---

## Technical Details

### Docker Image Per Template

**Base image:** `hubify/base:latest` (Node 22, OpenClaw, ttyd, pnpm)

**Template layer:** Each template has its own Dockerfile:

```dockerfile
FROM hubify/base:latest

# Copy template files
COPY templates/myos/workspace/ /opt/workspace/
COPY templates/myos/dashboard/ /opt/dashboard/

# Install skills
RUN cd /opt/workspace && pnpm install

# Build dashboard
RUN cd /opt/dashboard && pnpm install && pnpm build

# Ready to boot
CMD ["/usr/local/bin/boot.sh"]
```

### boot.sh Initialization

```bash
#!/bin/bash

# Seed template files if fresh install
if [ ! -f "/data/HUB.yaml" ]; then
  cp -rn /opt/workspace/. /data/
  # Personalize with user details
  sed -i "s/{{USERNAME}}/$HUBIFY_USERNAME/g" /data/SOUL.md
  sed -i "s/{{USERNAME}}/$HUBIFY_USERNAME/g" /data/USER.md
  sed -i "s/{{SUBDOMAIN}}/$HUBIFY_SUBDOMAIN/g" /data/HUB.yaml
fi

# Start services
exec openclaw gateway --port 3000
```

---

## Current Template Status

| Template | Status | Install Count | Last Updated |
|----------|--------|---------------|--------------|
| **MyOS** | ✅ Active | 1,247 | Feb 21 |
| **Dev OS** | ✅ Active | 892 | Feb 21 |
| **Founder OS** | ✅ Active | 756 | Feb 21 |
| **Research OS** | ✅ Active | 421 | Feb 21 |
| **Company OS** | ✅ Active | 0 | Mar 04 |
| **Client OS** | ✅ Active | 534 | Feb 21 |
| **Minimal** | ✅ Active | 189 | Feb 21 |

All templates are **production-ready** and **fully provisioned**. Users can create workspaces from any template immediately.

---

## Next Steps

- Community templates (users publishing remixes)
- Template monetization (creator revenue share)
- More integrations (LinkedIn, Stripe, Notion, etc.)
- Template AI (auto-generate custom templates from description)

---

*This document is the source of truth for Hubify templates. Update it when new templates are published or significant changes are made.*
