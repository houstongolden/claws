# Welcome to Research OS

Your autonomous research workspace is live at `{{SUBDOMAIN}}`.

## What's Running

- Research agent with access to literature databases, computation tools, and experiment DAGs
- Proactive monitoring: experiment tracking, literature watch, finding synthesis
- Connected to Hubify Labs for experiment execution
- Multi-model consensus for cross-validation

## Getting Started

### 1. Define Your Research Focus

Edit `/data/USER.md` to tell the agent:
- What domain you're working in
- Your active research questions
- Key papers and datasets
- Methodology preferences

### 2. Check Your Research Toolkit

Run `hubify research tools check` to verify which APIs are available. You may need to set API keys for:
- NASA ADS (`NASA_ADS_API_KEY`)
- Wolfram Alpha (`WOLFRAM_ALPHA_APP_ID`)
- Perplexity (`PERPLEXITY_API_KEY`)

### 3. Run Your First Search

Try: "Search for recent papers on [your topic]"

The agent will search arXiv, Semantic Scholar, and NASA ADS, then summarize findings.

### 4. Launch an Experiment

Try: "Design an experiment to test [hypothesis]"

The agent will create an experiment DAG entry, design methodology, and begin execution.

### 5. Connect Telegram (optional)

Get research alerts — major findings, experiment completions, and cost approvals — on your phone.

## Pre-installed Skills

| Skill | What it does |
|-------|-------------|
| `literature-search` | Search papers across arXiv, Semantic Scholar, NASA ADS |
| `data-analysis` | Query astronomical and scientific databases |
| `equation-validation` | Dual-verify math: Wolfram Alpha + DeepSeek R1 |
| `experiment-runner` | Execute experiments via DAG system |
| `research-synthesis` | Compile findings into publishable summaries |
| `multi-model-consensus` | Cross-validate with multiple LLMs |

## Key Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent's research identity |
| `USER.md` | Your research profile and preferences |
| `MEMORY.md` | Long-term findings and methodology notes |
| `AGENTS.md` | Workspace rules and safety guidelines |
| `HEARTBEAT.md` | Proactive research schedule |
| `HUB.yaml` | Workspace configuration |

---

*Delete this file after you've completed onboarding. Your agent will remember everything.*
