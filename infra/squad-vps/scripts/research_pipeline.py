#!/usr/bin/env python3
"""
Research Pipeline — AI-Assisted Paper Refinement for bigbounce.md

Author: Houston Golden (Founder, BAMF / Hubify)
AI Research Assistants: 5 autonomous agents that help refine, validate,
and strengthen the paper under Houston's direction.

This paper represents years of Houston's original research and imagination
in theoretical cosmology, dating back to studies at Cambridge. The core
ideas, novel theoretical frameworks, and creative insights are Houston's —
the AI agents serve as research assistants that help formalize, validate,
cite, and refine the mathematical and scientific presentation.

This script runs on the Fly.io VPS and orchestrates 5 AI research assistants to:
1. Analyze the paper by section
2. Research improvements (arXiv, DeepSeek, Perplexity)
3. Edit bigbounce.md directly
4. Commit and push changes
5. Report activity to Convex

AI Research Assistants:
  - astro-sage-v1: Lead Research Assistant & Synthesizer
  - astro-nova-v1: Literature Review Assistant (citations)
  - astro-tensor-v1: Mathematical Validation Assistant
  - astro-atlas-v1: Observational Data Assistant
  - astro-keane-v1: Peer Review & QA Assistant

Environment vars required:
  - ANTHROPIC_API_KEY
  - CONVEX_URL (deployment URL for HTTP endpoints)
  - GITHUB_PAT
  - GITHUB_REPO (e.g. "Hubify-Projects/bigbounce")
"""

import os
import re
import sys
import json
import time
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode, quote
from urllib.error import URLError

# ── Configuration ──────────────────────────────────────────

REPO_DIR = Path("/workspace/repo")
PAPER_FILE = REPO_DIR / "bigbounce.md"
CONVEX_URL = os.environ.get("CONVEX_URL", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "")
SQUAD_ID = os.environ.get("SQUAD_ID", "")

# Principal Investigator / Author
AUTHOR = "Houston Golden"
AUTHOR_AFFILIATION = "Founder, BAMF / Hubify"

# AI Research Assistants (not authors — assistants under Houston's direction)
AGENTS = {
    "astro-sage-v1": {"role": "lead_assistant", "specialty": "narrative, abstract, conclusions"},
    "astro-nova-v1": {"role": "literature_assistant", "specialty": "citations, references, literature review"},
    "astro-tensor-v1": {"role": "math_assistant", "specialty": "equations, derivations, mathematical proofs"},
    "astro-atlas-v1": {"role": "data_assistant", "specialty": "observational data, predictions, measurements"},
    "astro-keane-v1": {"role": "qa_assistant", "specialty": "consistency, formatting, quality assurance"},
}

# ── Utility Functions ──────────────────────────────────────

def log(msg: str):
    """Log with timestamp."""
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def report_activity(agent_id: str, event_type: str, title: str, body: str):
    """Report activity to Convex HTTP endpoint."""
    if not CONVEX_URL or not SQUAD_ID:
        log(f"[skip-report] {agent_id}: {title}")
        return

    url = f"{CONVEX_URL}/api/pipeline/activity"
    payload = json.dumps({
        "squad_id": SQUAD_ID,
        "agent_id": agent_id,
        "agent_role": AGENTS.get(agent_id, {}).get("role", "contributor"),
        "event_type": event_type,
        "title": title,
        "body": body,
    }).encode()

    try:
        req = Request(url, data=payload, headers={"Content-Type": "application/json"})
        urlopen(req, timeout=10)
    except Exception as e:
        log(f"[report-error] {e}")


def report_paper_version(commit_sha: str, agent_id: str, edit_type: str, rationale: str, sections: list):
    """Report a paper version to Convex."""
    if not CONVEX_URL or not SQUAD_ID:
        return

    url = f"{CONVEX_URL}/api/pipeline/paper-version"
    payload = json.dumps({
        "squad_id": SQUAD_ID,
        "commit_sha": commit_sha,
        "author_agent": agent_id,
        "edit_type": edit_type,
        "rationale": rationale,
        "sections_changed": sections,
    }).encode()

    try:
        req = Request(url, data=payload, headers={"Content-Type": "application/json"})
        urlopen(req, timeout=10)
    except Exception as e:
        log(f"[report-error] {e}")


def git_pull():
    """Pull latest changes."""
    subprocess.run(["git", "pull", "--rebase"], cwd=REPO_DIR, capture_output=True)


def git_commit_push(agent_id: str, commit_type: str, message: str) -> str:
    """Stage, commit, and push changes. Returns commit SHA."""
    subprocess.run(["git", "add", "bigbounce.md"], cwd=REPO_DIR, capture_output=True)

    # Check if there are staged changes
    result = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=REPO_DIR, capture_output=True
    )
    if result.returncode == 0:
        log(f"[{agent_id}] No changes to commit")
        return ""

    commit_msg = f"[{agent_id}] {commit_type}: {message}"
    subprocess.run(
        ["git", "commit", "-m", commit_msg],
        cwd=REPO_DIR, capture_output=True
    )

    subprocess.run(["git", "push"], cwd=REPO_DIR, capture_output=True)

    # Get commit SHA
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_DIR, capture_output=True, text=True
    )
    return result.stdout.strip()


def call_claude(system: str, prompt: str, max_tokens: int = 4096) -> str:
    """Call Claude API for reasoning."""
    if not ANTHROPIC_API_KEY:
        log("[error] ANTHROPIC_API_KEY not set")
        return ""

    url = "https://api.anthropic.com/v1/messages"
    payload = json.dumps({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    try:
        req = Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        })
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data.get("content", [{}])[0].get("text", "")
    except Exception as e:
        log(f"[claude-error] {e}")
        return ""


def call_deepseek(system: str, prompt: str) -> str:
    """Call DeepSeek R1 for math verification."""
    if not DEEPSEEK_API_KEY:
        return ""

    url = "https://api.deepseek.com/v1/chat/completions"
    payload = json.dumps({
        "model": "deepseek-reasoner",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 4096,
    }).encode()

    try:
        req = Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        })
        resp = urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        log(f"[deepseek-error] {e}")
        return ""


def call_perplexity(prompt: str) -> str:
    """Call Perplexity for web-grounded research."""
    if not PERPLEXITY_API_KEY:
        return ""

    url = "https://api.perplexity.ai/chat/completions"
    payload = json.dumps({
        "model": "sonar",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048,
    }).encode()

    try:
        req = Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        })
        resp = urlopen(req, timeout=60)
        data = json.loads(resp.read())
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        log(f"[perplexity-error] {e}")
        return ""


def search_arxiv(query: str, max_results: int = 5) -> list:
    """Search arXiv for papers."""
    params = urlencode({
        "search_query": f"all:{quote(query)}",
        "start": "0",
        "max_results": str(max_results),
        "sortBy": "relevance",
    })
    url = f"http://export.arxiv.org/api/query?{params}"

    try:
        resp = urlopen(url, timeout=30)
        xml = resp.read().decode()
        # Simple XML parsing for titles and IDs
        entries = re.findall(r"<entry>(.*?)</entry>", xml, re.DOTALL)
        papers = []
        for entry in entries:
            title = re.search(r"<title>(.*?)</title>", entry, re.DOTALL)
            arxiv_id = re.search(r"<id>(.*?)</id>", entry)
            authors = re.findall(r"<name>(.*?)</name>", entry)
            summary = re.search(r"<summary>(.*?)</summary>", entry, re.DOTALL)
            if title:
                papers.append({
                    "title": title.group(1).strip().replace("\n", " "),
                    "id": arxiv_id.group(1).strip() if arxiv_id else "",
                    "authors": authors[:3],
                    "summary": summary.group(1).strip()[:300] if summary else "",
                })
        return papers
    except Exception as e:
        log(f"[arxiv-error] {e}")
        return []


# ── Section Parser ─────────────────────────────────────────

def parse_sections(content: str) -> list:
    """Parse markdown into sections by headers."""
    sections = []
    lines = content.split("\n")
    current_header = "Preamble"
    current_lines = []

    for line in lines:
        header_match = re.match(r"^(#{1,3})\s+(.+)", line)
        if header_match:
            if current_lines:
                sections.append({
                    "header": current_header,
                    "content": "\n".join(current_lines),
                    "level": current_lines[0].count("#") if current_lines[0].startswith("#") else 0,
                })
            current_header = header_match.group(2).strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_lines:
        sections.append({
            "header": current_header,
            "content": "\n".join(current_lines),
        })

    return sections


def apply_edit(content: str, old_text: str, new_text: str) -> str:
    """Apply a text replacement edit to the paper content."""
    if old_text in content:
        return content.replace(old_text, new_text, 1)
    return content


# ── Agent Pipeline Steps ───────────────────────────────────

def step_analyze(content: str) -> list:
    """Step 1: Sage analyzes the paper and identifies weak sections."""
    log("[sage] Analyzing paper for weak sections...")
    report_activity("astro-sage-v1", "work_started", "Analyzing paper sections", "Identifying weak areas for improvement")

    sections = parse_sections(content)
    section_list = "\n".join([f"- {s['header']}: {len(s['content'])} chars" for s in sections])

    analysis = call_claude(
        system="You are astro-sage, lead AI research assistant for the Big Bounce cosmology paper "
               "authored by Houston Golden. Your role is to help Houston refine and strengthen HIS paper. "
               "Houston is the author and principal investigator — you are an AI research assistant helping "
               "formalize and validate his ideas.\n\n"
               "Analyze the paper and identify the 3 most improvable sections. "
               "For each, explain WHY it's weak (vague claims? missing citations? incomplete math? unsupported assertions? novelty_misattribution?).\n\n"
               "CRITICAL: Pay special attention to novelty claims. The modified Friedmann equation with torsion correction "
               "is from Poplawski (2010-2012), NOT novel. Einstein-Cartan theory is from Cartan/Kibble/Sciama. "
               "If any section presents existing results as novel discoveries, flag it as 'novelty_misattribution'.\n\n"
               "AUTHORSHIP: Houston Golden is the author. He has worked on these cosmological ideas for years, "
               "originally inspired by studies at Cambridge. AI agents (including you) help with formalization, "
               "validation, and citation — but the core ideas are Houston's. Always maintain this attribution.",
        prompt=f"Here are the paper sections:\n\n{section_list}\n\nFull paper:\n\n{content[:8000]}\n\n"
               "Return a JSON array of objects with keys: section_header, issue_type (one of: vague_claims, missing_citations, incomplete_math, unsupported_assertions, weak_narrative, novelty_misattribution), "
               "description, assigned_agent (one of: astro-sage-v1, astro-nova-v1, astro-tensor-v1, astro-atlas-v1, astro-keane-v1). "
               "Only return the JSON array, no other text.",
        max_tokens=2048,
    )

    try:
        # Extract JSON from response
        json_match = re.search(r"\[.*\]", analysis, re.DOTALL)
        if json_match:
            issues = json.loads(json_match.group(0))
            log(f"[sage] Found {len(issues)} issues to address")
            return issues
    except json.JSONDecodeError as e:
        log(f"[sage] Failed to parse analysis: {e}")

    return []


def step_nova_citations(content: str, issues: list) -> list:
    """Step 2: Nova researches citations for sections needing them."""
    nova_issues = [i for i in issues if i.get("assigned_agent") == "astro-nova-v1" or i.get("issue_type") == "missing_citations"]
    if not nova_issues:
        return []

    log(f"[nova] Researching citations for {len(nova_issues)} sections...")
    report_activity("astro-nova-v1", "work_started", "Researching citations", f"Finding references for {len(nova_issues)} sections")

    edits = []
    for issue in nova_issues[:2]:  # Limit to 2 per cycle
        section_header = issue.get("section_header", "")

        # Search arXiv for relevant papers
        papers = search_arxiv(f"Big Bounce cosmology {section_header}", max_results=3)

        if papers:
            citations_text = "\n".join([
                f"  - {p['title']} ({', '.join(p['authors'][:2])})"
                for p in papers
            ])

            # Ask Claude to integrate citations
            edit_suggestion = call_claude(
                system="You are astro-nova, literature review research assistant for Houston Golden's Big Bounce paper. "
                       "Given a paper section and new citations, produce a specific text edit. "
                       "Return JSON with keys: old_text (exact text to replace), new_text (replacement with citations integrated), rationale.",
                prompt=f"Section: {section_header}\n\nCurrent text from paper:\n{content[:4000]}\n\n"
                       f"New citations found:\n{citations_text}\n\n"
                       "Produce a minimal, targeted edit that adds or improves citations in this section. "
                       "The old_text must be an EXACT substring of the paper. Return only JSON.",
                max_tokens=2048,
            )

            try:
                json_match = re.search(r"\{.*\}", edit_suggestion, re.DOTALL)
                if json_match:
                    edit = json.loads(json_match.group(0))
                    edit["agent"] = "astro-nova-v1"
                    edit["section"] = section_header
                    edits.append(edit)
            except json.JSONDecodeError:
                pass

    return edits


def step_tensor_math(content: str, issues: list) -> list:
    """Step 3: Tensor verifies and improves mathematical content."""
    tensor_issues = [i for i in issues if i.get("assigned_agent") == "astro-tensor-v1" or i.get("issue_type") == "incomplete_math"]
    if not tensor_issues:
        return []

    log(f"[tensor] Verifying math for {len(tensor_issues)} sections...")
    report_activity("astro-tensor-v1", "work_started", "Verifying mathematics", f"Checking equations in {len(tensor_issues)} sections")

    edits = []
    for issue in tensor_issues[:2]:
        section_header = issue.get("section_header", "")

        # Use DeepSeek R1 for math verification
        math_review = call_deepseek(
            system="You are a mathematical physicist specializing in cosmology. "
                   "Review the mathematical content and identify errors, incomplete derivations, or missing steps.",
            prompt=f"Review the mathematics in this section about: {section_header}\n\n"
                   f"Paper content:\n{content[:6000]}\n\n"
                   "If you find issues, produce a JSON object with: old_text, new_text, rationale. "
                   "The old_text must be exact. If math is correct, return empty JSON {}."
        )

        if math_review and math_review.strip() != "{}":
            try:
                json_match = re.search(r"\{.*\}", math_review, re.DOTALL)
                if json_match:
                    edit = json.loads(json_match.group(0))
                    if edit.get("old_text"):
                        edit["agent"] = "astro-tensor-v1"
                        edit["section"] = section_header
                        edits.append(edit)
            except json.JSONDecodeError:
                pass

    return edits


def step_atlas_data(content: str, issues: list) -> list:
    """Step 4: Atlas validates observational data and predictions."""
    atlas_issues = [i for i in issues if i.get("assigned_agent") == "astro-atlas-v1" or i.get("issue_type") == "unsupported_assertions"]
    if not atlas_issues:
        return []

    log(f"[atlas] Validating data for {len(atlas_issues)} sections...")
    report_activity("astro-atlas-v1", "work_started", "Validating observational data", f"Fact-checking {len(atlas_issues)} sections")

    edits = []
    for issue in atlas_issues[:2]:
        section_header = issue.get("section_header", "")

        # Use Perplexity for fact-checking observational claims
        fact_check = call_perplexity(
            f"Fact-check this cosmology claim about '{section_header}' from the Big Bounce theory paper. "
            f"Are the observational data points and measurements accurate? What are the latest values? "
            f"Context: {issue.get('description', '')}"
        )

        if fact_check:
            edit_suggestion = call_claude(
                system="You are astro-atlas, observational data research assistant for Houston Golden's Big Bounce paper. "
                       "Given fact-checking results, produce a specific text edit for the paper. "
                       "Return JSON with: old_text, new_text, rationale.",
                prompt=f"Section: {section_header}\n\nPaper content:\n{content[:4000]}\n\n"
                       f"Fact-checking results:\n{fact_check}\n\n"
                       "Produce a minimal edit to correct or strengthen data claims. "
                       "The old_text must be exact. Return only JSON.",
                max_tokens=2048,
            )

            try:
                json_match = re.search(r"\{.*\}", edit_suggestion, re.DOTALL)
                if json_match:
                    edit = json.loads(json_match.group(0))
                    if edit.get("old_text"):
                        edit["agent"] = "astro-atlas-v1"
                        edit["section"] = section_header
                        edits.append(edit)
            except json.JSONDecodeError:
                pass

    return edits


def step_sage_rewrite(content: str, issues: list) -> list:
    """Step 5: Sage rewrites sections for coherence."""
    sage_issues = [i for i in issues if i.get("assigned_agent") == "astro-sage-v1" or i.get("issue_type") == "weak_narrative"]
    if not sage_issues:
        return []

    log(f"[sage] Rewriting {len(sage_issues)} sections for coherence...")
    report_activity("astro-sage-v1", "work_started", "Rewriting for coherence", f"Improving {len(sage_issues)} sections")

    edits = []
    for issue in sage_issues[:2]:
        section_header = issue.get("section_header", "")

        edit_suggestion = call_claude(
            system="You are astro-sage, lead AI research assistant for Houston Golden's Big Bounce paper. "
                   "Rewrite the specified section to improve clarity, coherence, and scientific rigor "
                   "while preserving Houston's voice and original ideas. "
                   "Return JSON with: old_text (exact substring to replace), new_text (improved version), rationale.",
            prompt=f"Improve section '{section_header}' in this paper:\n\n{content[:6000]}\n\n"
                   f"Issue: {issue.get('description', '')}\n\n"
                   "The old_text must be an exact substring. Keep the same level of technical detail. Return only JSON.",
            max_tokens=4096,
        )

        try:
            json_match = re.search(r"\{.*\}", edit_suggestion, re.DOTALL)
            if json_match:
                edit = json.loads(json_match.group(0))
                if edit.get("old_text"):
                    edit["agent"] = "astro-sage-v1"
                    edit["section"] = section_header
                    edits.append(edit)
        except json.JSONDecodeError:
            pass

    return edits


def step_novelty_verification(content: str) -> list:
    """Step 5b: Verify novelty claims — distinguish existing work from new contributions."""
    log("[keane] Running novelty verification...")
    report_activity("astro-keane-v1", "work_started", "Novelty verification",
                    "Checking all equations and claims for proper attribution vs. novel contributions")

    # Search arXiv for prior work on the specific equations
    prior_work = search_arxiv("Einstein-Cartan torsion bounce cosmology Poplawski modified Friedmann", max_results=5)
    prior_work.extend(search_arxiv("spin-torsion cosmological bounce critical density", max_results=3))

    prior_work_text = "\n".join([
        f"- {p['title']} ({', '.join(p['authors'][:2])}) {p['id']}"
        for p in prior_work
    ])

    novelty_review = call_claude(
        system="You are astro-keane, peer review research assistant for Houston Golden's Big Bounce paper. "
               "Your task is NOVELTY VERIFICATION.\n\n"
               "CONTEXT: Houston Golden is the author and has been developing these cosmological ideas for years, "
               "originally inspired by studies at Cambridge. He is an amateur theoretical cosmologist who has used "
               "AI research tools (OpenAI Deep Research, Anthropic Claude, Manus) to help formalize and refine his ideas. "
               "The creative/imaginative work is his — the AI agents help with formalization and validation.\n\n"
               "For EVERY equation and theoretical claim in this paper, determine:\n"
               "1. EXISTING: Well-known result from the literature (cite the original source)\n"
               "2. MODIFIED: Author's modification/extension of existing work (cite original + explain what Houston changed)\n"
               "3. COMBINED: Author's novel combination of existing ideas (cite the originals, credit Houston's synthesis)\n"
               "4. NOVEL: Genuinely new contribution by the author (explain exactly what Houston proposes that is new)\n\n"
               "Common traps to catch:\n"
               "- The modified Friedmann equation with torsion correction is from Poplawski (2010-2012), NOT novel\n"
               "- The bounce condition (H=0 at critical density) is a trivial algebraic consequence, NOT novel\n"
               "- Einstein-Cartan theory dates to Cartan (1922), Kibble (1961), Sciama (1962)\n"
               "- w → -1 at bounce point is a known generic feature of bounce cosmologies\n\n"
               "Be honest and accurate. Houston wants scientific integrity — do NOT overclaim novelty, "
               "but DO credit his genuine contributions: novel combinations, new parameter constraints, "
               "new interpretive frameworks, new predictions, or creative syntheses.\n\n"
               "Return a JSON array of edit objects with: old_text, new_text, rationale.\n"
               "Each edit should ADD proper attribution where missing, or ADD a clear statement about what "
               "is novel vs. what builds on prior work. The old_text must be an EXACT substring.",
        prompt=f"Verify novelty claims in this paper:\n\n{content[:12000]}\n\n"
               f"Known prior work found on arXiv:\n{prior_work_text}\n\n"
               "Produce edits that ensure EVERY equation has proper attribution and no existing results "
               "are presented as novel. Add a 'Prior Work' or 'Related Work' note where needed. "
               "Return only the JSON array (max 3 edits).",
        max_tokens=4096,
    )

    edits = []
    try:
        json_match = re.search(r"\[.*\]", novelty_review, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group(0))
            for edit in parsed:
                if edit.get("old_text") and edit.get("new_text"):
                    edit["agent"] = "astro-keane-v1"
                    edit["section"] = "novelty_verification"
                    edits.append(edit)
            log(f"[keane] Novelty verification: {len(edits)} attribution fixes needed")
    except json.JSONDecodeError:
        log("[keane] Failed to parse novelty review response")

    return edits


def step_keane_review(content: str) -> list:
    """Step 6: Keane does final quality review."""
    log("[keane] Running quality review...")
    report_activity("astro-keane-v1", "work_started", "Quality review", "Checking consistency and formatting")

    review = call_claude(
        system="You are astro-keane, peer review research assistant for Houston Golden's Big Bounce paper. "
               "Review the paper for inconsistencies, formatting issues, and quality problems. "
               "Return a JSON array of edit objects with: old_text, new_text, rationale. "
               "Focus on small fixes: typos, inconsistent terminology, formatting issues. "
               "Ensure Houston Golden is credited as author throughout. "
               "Each old_text must be an exact substring. Return only the JSON array.",
        prompt=f"Review this paper for quality issues:\n\n{content[:8000]}\n\n"
               "Return up to 3 small fixes as a JSON array.",
        max_tokens=2048,
    )

    try:
        json_match = re.search(r"\[.*\]", review, re.DOTALL)
        if json_match:
            edits = json.loads(json_match.group(0))
            for edit in edits:
                edit["agent"] = "astro-keane-v1"
                edit["section"] = "quality"
            return edits
    except json.JSONDecodeError:
        pass

    return []


# ── Extended Pipeline Stages ────────────────────────────────

def generate_figures():
    """Generate publication-quality figures using the standalone script."""
    log("[pipeline] Running figure generation...")
    report_activity("astro-atlas-v1", "work_started", "Generating figures",
                    "Running matplotlib figure generator")

    script = Path("/workspace/scripts/generate_figures.py")
    if not script.exists():
        log("[pipeline] generate_figures.py not found, skipping figure generation")
        return

    try:
        result = subprocess.run(
            ["python3", str(script)],
            cwd=Path("/workspace"),
            capture_output=True, text=True, timeout=300
        )
        log(f"[pipeline] Figure generation stdout: {result.stdout[-500:]}")
        if result.returncode == 0:
            report_activity("astro-atlas-v1", "work_completed", "Figures generated",
                            result.stdout[-200:] if result.stdout else "Completed")
        else:
            log(f"[pipeline] Figure generation stderr: {result.stderr[-500:]}")
            report_activity("astro-atlas-v1", "vps_action", "Figure generation failed",
                            result.stderr[-200:] if result.stderr else "Unknown error")
    except subprocess.TimeoutExpired:
        log("[pipeline] Figure generation timed out after 300s")
    except Exception as e:
        log(f"[pipeline] Figure generation error: {e}")


def generate_arxiv_version():
    """Generate ArXiv short version and supplementary materials."""
    log("[sage] Generating ArXiv short version...")
    report_activity("astro-sage-v1", "work_started", "Generating ArXiv version",
                    "Creating condensed PRL-style paper (~15 pages)")

    content = PAPER_FILE.read_text() if PAPER_FILE.exists() else ""
    if not content:
        return

    arxiv_md = call_claude(
        system="You are astro-sage, lead AI research assistant. Condense this full paper into an ArXiv-ready "
               "PRL-style document (~15 pages). Keep core equations, main results, key figures. "
               "Remove supplementary details, move them to a separate supplementary document. "
               "Use proper academic formatting: abstract, introduction, methods, results, discussion, "
               "conclusion, references. Keep citations in [Author, Year] format.\n\n"
               "AUTHORSHIP: The paper is authored by Houston Golden. Include an acknowledgments section "
               "that transparently credits AI research assistance (Anthropic Claude, OpenAI, DeepSeek) "
               "in formalizing equations, validating mathematics, and literature review. "
               "The author line should read: 'Houston Golden' with affiliation.",
        prompt=f"Condense this full paper for ArXiv submission:\n\n{content[:30000]}",
        max_tokens=8192,
    )

    if arxiv_md and len(arxiv_md) > 1000:
        arxiv_file = REPO_DIR / "bigbounce-arxiv.md"
        arxiv_file.write_text(arxiv_md)
        log(f"[sage] ArXiv version written: {len(arxiv_md)} chars")

        subprocess.run(["git", "add", "bigbounce-arxiv.md"], cwd=REPO_DIR, capture_output=True)
        sha = git_commit_push("astro-sage-v1", "arxiv", "Generate ArXiv short version")
        if sha:
            report_paper_version(sha, "astro-sage-v1", "arxiv_generation",
                                "Generated ArXiv-ready condensed version", ["full-paper"])
            report_activity("astro-sage-v1", "work_completed", "ArXiv version generated",
                            f"Condensed to {len(arxiv_md)} chars")

    # Generate supplementary
    supp_md = call_claude(
        system="You are astro-sage. Extract all supplementary material from this paper: "
               "detailed derivations, appendices, data tables, methodology details. "
               "Format as a standalone supplementary document.",
        prompt=f"Extract supplementary material from:\n\n{content[:30000]}",
        max_tokens=8192,
    )

    if supp_md and len(supp_md) > 500:
        supp_file = REPO_DIR / "bigbounce-supplementary.md"
        supp_file.write_text(supp_md)
        subprocess.run(["git", "add", "bigbounce-supplementary.md"], cwd=REPO_DIR, capture_output=True)
        sha = git_commit_push("astro-sage-v1", "supplementary", "Generate supplementary materials")
        if sha:
            report_paper_version(sha, "astro-sage-v1", "supplementary_generation",
                                "Generated supplementary materials", ["appendices"])


def run_math_validation():
    """Run math validation using DeepSeek R1 and existing Python scripts."""
    log("[tensor] Running math validation...")
    report_activity("astro-tensor-v1", "work_started", "Math validation",
                    "Verifying key equations with DeepSeek R1")

    content = PAPER_FILE.read_text() if PAPER_FILE.exists() else ""
    if not content:
        return

    # Run existing validation script if present
    validation_script = REPO_DIR / "code" / "mathematical-validation-modified-friedmann-equations.py"
    script_output = ""
    if validation_script.exists():
        try:
            result = subprocess.run(
                ["python3", str(validation_script)],
                cwd=REPO_DIR, capture_output=True, text=True, timeout=120
            )
            script_output = result.stdout[:3000]
            log(f"[tensor] Validation script output: {len(script_output)} chars")
        except Exception as e:
            log(f"[tensor] Validation script failed: {e}")

    # Use DeepSeek R1 to verify key derivations
    key_equations = call_claude(
        system="Extract the 5 most important equations/derivations from this cosmology paper. "
               "Return each equation and its surrounding context (2-3 sentences before and after).",
        prompt=f"Paper:\n\n{content[:20000]}",
        max_tokens=4096,
    )

    validation_results = []
    if key_equations:
        verification = call_deepseek(
            system="You are a mathematical physicist. Verify the following equations and derivations. "
                   "For each, state PASS or FAIL, explain any issues, and note dimensional consistency.",
            prompt=f"Verify these equations from a Big Bounce cosmology paper:\n\n{key_equations}\n\n"
                   f"Additional context from Python validation:\n{script_output[:2000]}"
        )
        if verification:
            validation_results.append(verification)

    # Write validation report
    report_dir = REPO_DIR / "validation"
    report_dir.mkdir(exist_ok=True)
    report_file = report_dir / "math-validation-report.md"

    report_content = f"""# Math Validation Report
Generated: {time.strftime("%Y-%m-%d %H:%M:%S UTC")}
Agent: astro-tensor-v1 (DeepSeek R1)

## Automated Script Results
{script_output if script_output else "No validation script found"}

## DeepSeek R1 Verification
{validation_results[0] if validation_results else "Verification not available"}
"""
    report_file.write_text(report_content)
    subprocess.run(["git", "add", "validation/"], cwd=REPO_DIR, capture_output=True)
    sha = git_commit_push("astro-tensor-v1", "validation", "Math validation report")
    if sha:
        report_paper_version(sha, "astro-tensor-v1", "math_validation",
                            "Generated math validation report", ["validation"])
        report_activity("astro-tensor-v1", "work_completed", "Math validation complete",
                        f"Report generated with {len(validation_results)} verifications")


# ── Main Pipeline ──────────────────────────────────────────

def run_pipeline():
    """Execute the full research pipeline."""
    log("=" * 60)
    log("RESEARCH PIPELINE STARTING")
    log("=" * 60)

    # Ensure we have the paper
    if not PAPER_FILE.exists():
        log(f"[error] Paper not found at {PAPER_FILE}")
        report_activity("astro-sage-v1", "vps_action", "Pipeline failed", "bigbounce.md not found")
        return

    # Pull latest
    git_pull()

    # Read paper
    content = PAPER_FILE.read_text()
    log(f"Paper loaded: {len(content)} chars, {len(content.splitlines())} lines")

    report_activity("astro-sage-v1", "vps_action", "Pipeline started",
                    f"Paper: {len(content)} chars, {len(content.splitlines())} lines")

    # Step 1: Analyze
    issues = step_analyze(content)
    if not issues:
        log("[pipeline] No issues found, paper looks good")
        report_activity("astro-sage-v1", "work_completed", "Pipeline complete", "No issues found")
        return

    # Steps 2-5: Each agent works on their assigned issues
    all_edits = []
    all_edits.extend(step_nova_citations(content, issues))
    all_edits.extend(step_tensor_math(content, issues))
    all_edits.extend(step_atlas_data(content, issues))
    all_edits.extend(step_sage_rewrite(content, issues))

    # Apply edits and commit per agent
    edits_by_agent = {}
    for edit in all_edits:
        agent = edit.get("agent", "astro-sage-v1")
        if agent not in edits_by_agent:
            edits_by_agent[agent] = []
        edits_by_agent[agent].append(edit)

    total_applied = 0
    for agent_id, edits in edits_by_agent.items():
        # Re-read paper for each agent (in case previous agent modified it)
        content = PAPER_FILE.read_text()
        applied = 0

        for edit in edits:
            old_text = edit.get("old_text", "")
            new_text = edit.get("new_text", "")
            if old_text and new_text and old_text != new_text:
                new_content = apply_edit(content, old_text, new_text)
                if new_content != content:
                    content = new_content
                    applied += 1
                    log(f"[{agent_id}] Applied edit in section: {edit.get('section', 'unknown')}")

        if applied > 0:
            PAPER_FILE.write_text(content)
            rationale = edits[0].get("rationale", "Improved paper content")
            sections = list(set(e.get("section", "") for e in edits if e.get("section")))
            commit_type = {
                "astro-nova-v1": "citations",
                "astro-tensor-v1": "math",
                "astro-atlas-v1": "data",
                "astro-sage-v1": "rewrite",
            }.get(agent_id, "edit")

            sha = git_commit_push(agent_id, commit_type, f"{applied} edits: {rationale[:80]}")
            if sha:
                report_paper_version(sha, agent_id, commit_type, rationale, sections)
                report_activity(agent_id, "work_completed",
                                f"Applied {applied} edits",
                                f"Sections: {', '.join(sections)}")
            total_applied += applied

    # Step 5b: Novelty verification (runs every cycle regardless of edits)
    content = PAPER_FILE.read_text()
    novelty_edits = step_novelty_verification(content)
    novelty_applied = 0
    for edit in novelty_edits:
        old_text = edit.get("old_text", "")
        new_text = edit.get("new_text", "")
        if old_text and new_text and old_text != new_text:
            new_content = apply_edit(content, old_text, new_text)
            if new_content != content:
                content = new_content
                novelty_applied += 1

    if novelty_applied > 0:
        PAPER_FILE.write_text(content)
        sha = git_commit_push("astro-keane-v1", "novelty", f"{novelty_applied} novelty attribution fixes")
        if sha:
            report_paper_version(sha, "astro-keane-v1", "novelty_verification",
                                "Added proper attribution for existing equations and frameworks", ["novelty"])
            report_activity("astro-keane-v1", "work_completed",
                            f"Applied {novelty_applied} novelty attribution fixes",
                            "Ensured equations properly cite prior work and claims of novelty are accurate")
        total_applied += novelty_applied

    # Step 6: Keane quality review
    if total_applied > 0:
        content = PAPER_FILE.read_text()
        qa_edits = step_keane_review(content)
        qa_applied = 0
        for edit in qa_edits:
            old_text = edit.get("old_text", "")
            new_text = edit.get("new_text", "")
            if old_text and new_text and old_text != new_text:
                new_content = apply_edit(content, old_text, new_text)
                if new_content != content:
                    content = new_content
                    qa_applied += 1

        if qa_applied > 0:
            PAPER_FILE.write_text(content)
            sha = git_commit_push("astro-keane-v1", "qa", f"{qa_applied} quality fixes")
            if sha:
                report_paper_version(sha, "astro-keane-v1", "qa", "Quality review fixes", ["quality"])
                report_activity("astro-keane-v1", "work_completed",
                                f"Applied {qa_applied} quality fixes", "Consistency and formatting improvements")
            total_applied += qa_applied

    log(f"Edit phase complete: {total_applied} total edits applied")

    # Extended stages: figures, ArXiv version, math validation
    try:
        generate_figures()
    except Exception as e:
        log(f"[pipeline] Figure generation failed: {e}")

    try:
        generate_arxiv_version()
    except Exception as e:
        log(f"[pipeline] ArXiv version generation failed: {e}")

    try:
        run_math_validation()
    except Exception as e:
        log(f"[pipeline] Math validation failed: {e}")

    log(f"Pipeline complete: {total_applied} edits + extended stages")
    report_activity("astro-sage-v1", "vps_action", "Pipeline completed",
                    f"Applied {total_applied} edits + figure gen + ArXiv version + math validation")


if __name__ == "__main__":
    try:
        run_pipeline()
    except Exception as e:
        log(f"[FATAL] Pipeline crashed: {e}")
        report_activity("astro-sage-v1", "vps_action", "Pipeline crashed", str(e))
        sys.exit(1)
