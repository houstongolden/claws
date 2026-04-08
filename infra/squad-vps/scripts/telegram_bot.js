#!/usr/bin/env node
/**
 * Telegram Bot — Chat with Astro Sage
 *
 * Long-polling Telegram bot that lets Houston chat with the squad lead.
 * Commands:
 *   /status  — git log, pipeline status, machine health
 *   /activate — trigger research pipeline
 *   /team    — show 5 agents with roles and last commit
 *   /paper   — paper stats (line count, sections, last edit)
 *   /commits — last 5 commits with author + message
 *   (text)   — conversational chat with Sage via Claude API
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN — from BotFather
 *   ANTHROPIC_API_KEY  — for Claude conversations
 *   CONVEX_URL         — for reporting activity
 *   SQUAD_ID           — Convex squad ID
 */

const { execSync } = require("child_process");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CONVEX_URL = process.env.CONVEX_URL || "";
const SQUAD_ID = process.env.SQUAD_ID || "";
const REPO_DIR = "/workspace/repo";
const PAPER_FILE = path.join(REPO_DIR, "bigbounce.md");

if (!BOT_TOKEN) {
  console.log("[bot] TELEGRAM_BOT_TOKEN not set, exiting");
  process.exit(0);
}

console.log("[bot] Astro Sage Telegram bot starting...");

// ── Telegram API ────────────────────────────────────────

function telegramApi(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${BOT_TOKEN}/${method}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sendMessage(chatId, text) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: "Markdown",
  });
}

// ── Claude API ──────────────────────────────────────────

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_KEY) {
      resolve("(Claude API key not configured)");
      return;
    }

    const data = JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system:
        "You are Astro Sage, lead researcher for the Big Bounce cosmology paper project. " +
        "You lead a team of 5 AI agents (sage, nova, tensor, atlas, keane) researching " +
        "cyclic cosmology. You're talking to Houston, your human founder. " +
        "Be conversational, knowledgeable, and occasionally reference your team's work. " +
        "Keep responses concise (under 500 words).",
      messages: [{ role: "user", content: prompt }],
    });

    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            resolve(body.content?.[0]?.text || "(empty response)");
          } catch {
            resolve("(failed to parse Claude response)");
          }
        });
      }
    );
    req.on("error", () => resolve("(Claude API error)"));
    req.write(data);
    req.end();
  });
}

// ── Convex Reporting ────────────────────────────────────

function reportActivity(title, body) {
  if (!CONVEX_URL || !SQUAD_ID) return;
  const url = new URL("/api/pipeline/activity", CONVEX_URL);
  const data = JSON.stringify({
    squad_id: SQUAD_ID,
    agent_id: "astro-sage-v1",
    agent_role: "lead",
    event_type: "vps_action",
    title,
    body,
  });

  const proto = url.protocol === "https:" ? https : http;
  const req = proto.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
  });
  req.on("error", () => {});
  req.write(data);
  req.end();
}

// ── Shell Helpers ───────────────────────────────────────

function sh(cmd, cwd = REPO_DIR) {
  try {
    return execSync(cmd, { cwd, timeout: 10000, encoding: "utf-8" }).trim();
  } catch {
    return "(command failed)";
  }
}

// ── Command Handlers ────────────────────────────────────

function handleStatus(chatId) {
  const gitLog = sh("git log --oneline -5");
  const uptime = sh("uptime", "/");
  const disk = sh("df -h /workspace | tail -1", "/");
  const lastPipeline = sh("tail -3 /workspace/.hubify/pipeline.log 2>/dev/null || echo 'no pipeline log'", "/");

  const msg =
    "*Status*\n\n" +
    `*Uptime:* \`${uptime}\`\n` +
    `*Disk:* \`${disk}\`\n\n` +
    `*Last 5 commits:*\n\`\`\`\n${gitLog}\n\`\`\`\n\n` +
    `*Pipeline log:*\n\`\`\`\n${lastPipeline}\n\`\`\``;

  return sendMessage(chatId, msg);
}

function handleActivate(chatId) {
  sendMessage(chatId, "Triggering research pipeline...");
  reportActivity("Pipeline triggered via Telegram", "Houston activated pipeline from Telegram bot");

  try {
    execSync(
      'nohup python3 /workspace/scripts/research_pipeline.py > /workspace/.hubify/pipeline.log 2>&1 &',
      { cwd: "/workspace", timeout: 5000 }
    );
    return sendMessage(chatId, "Pipeline started. Check /status in a few minutes for results.");
  } catch {
    return sendMessage(chatId, "Failed to start pipeline. Check VPS logs.");
  }
}

function handleTeam(chatId) {
  const agents = [
    { id: "astro-sage-v1", role: "Lead Researcher & Synthesizer", emoji: "S" },
    { id: "astro-nova-v1", role: "Literature Review & Citations", emoji: "N" },
    { id: "astro-tensor-v1", role: "Mathematical Validation", emoji: "T" },
    { id: "astro-atlas-v1", role: "Observational Data Analysis", emoji: "A" },
    { id: "astro-keane-v1", role: "Peer Review & QA", emoji: "K" },
  ];

  let msg = "*The Squad*\n\n";
  for (const a of agents) {
    const lastCommit = sh(`git log --all --oneline -1 --author="${a.id}" 2>/dev/null || echo "no commits yet"`);
    msg += `*[${a.emoji}] ${a.id}*\n   ${a.role}\n   Last: \`${lastCommit}\`\n\n`;
  }

  return sendMessage(chatId, msg);
}

function handlePaper(chatId) {
  if (!fs.existsSync(PAPER_FILE)) {
    return sendMessage(chatId, "bigbounce.md not found");
  }

  const content = fs.readFileSync(PAPER_FILE, "utf-8");
  const lines = content.split("\n").length;
  const words = content.split(/\s+/).length;
  const sections = (content.match(/^#{1,3}\s/gm) || []).length;
  const lastEdit = sh(`git log -1 --format="%ar by %an: %s" -- bigbounce.md`);

  const msg =
    "*Paper Stats*\n\n" +
    `*Lines:* ${lines}\n` +
    `*Words:* ${words}\n` +
    `*Sections:* ${sections}\n` +
    `*Last edit:* ${lastEdit}\n`;

  return sendMessage(chatId, msg);
}

function handleCommits(chatId) {
  const log = sh('git log --oneline -5 --format="[%h] %s (%ar)"');
  return sendMessage(chatId, `*Recent Commits*\n\n\`\`\`\n${log}\n\`\`\``);
}

async function handleChat(chatId, text) {
  const response = await callClaude(text);
  reportActivity("Telegram chat", `Houston: ${text.slice(0, 100)}`);
  return sendMessage(chatId, response);
}

// ── Long Polling Loop ───────────────────────────────────

let offset = 0;

async function poll() {
  try {
    const result = await telegramApi("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    });

    if (result.ok && result.result) {
      for (const update of result.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg || !msg.text) continue;

        const chatId = msg.chat.id;
        const text = msg.text.trim();

        console.log(`[bot] ${msg.from?.username || "unknown"}: ${text}`);

        if (text === "/status" || text === "/status@AstroSageBot") {
          await handleStatus(chatId);
        } else if (text === "/activate" || text === "/activate@AstroSageBot") {
          await handleActivate(chatId);
        } else if (text === "/team" || text === "/team@AstroSageBot") {
          await handleTeam(chatId);
        } else if (text === "/paper" || text === "/paper@AstroSageBot") {
          await handlePaper(chatId);
        } else if (text === "/commits" || text === "/commits@AstroSageBot") {
          await handleCommits(chatId);
        } else if (text.startsWith("/")) {
          await sendMessage(chatId,
            "Commands:\n" +
            "/status - Machine & pipeline status\n" +
            "/activate - Trigger research pipeline\n" +
            "/team - Show agent team\n" +
            "/paper - Paper statistics\n" +
            "/commits - Recent commits\n" +
            "Or just type a message to chat with Sage"
          );
        } else {
          await handleChat(chatId, text);
        }
      }
    }
  } catch (e) {
    console.error("[bot] Poll error:", e.message);
  }

  // Continue polling
  setTimeout(poll, 1000);
}

// Start
console.log("[bot] Astro Sage bot online, starting long-poll...");
poll();
