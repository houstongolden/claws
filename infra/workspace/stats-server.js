#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');

const PORT = 4000;
const DATA = '/data';

function safeLs(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}
function safeRead(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch { return null; }
}

// ── Health metrics cache (30s TTL) ──
var healthCache = { data: null, ts: 0 };

function getHealth() {
  var now = Date.now();
  if (healthCache.data && now - healthCache.ts < 30000) return healthCache.data;

  var memUsedMb = 0, memTotalMb = 0;
  try {
    var meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    var totalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
    var availMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
    if (totalMatch) memTotalMb = Math.round(parseInt(totalMatch[1]) / 1024);
    if (availMatch) memUsedMb = memTotalMb - Math.round(parseInt(availMatch[1]) / 1024);
  } catch {}

  var uptimeSecs = Math.floor(process.uptime());

  var dataSizeBytes = 0;
  function sizeDir(dir, depth) {
    if (depth <= 0) return;
    try {
      var entries = fs.readdirSync(dir);
      for (var e of entries) {
        if (e.startsWith('.')) continue;
        var full = path.join(dir, e);
        try {
          var st = fs.statSync(full);
          if (st.isDirectory()) sizeDir(full, depth - 1);
          else dataSizeBytes += st.size;
        } catch {}
      }
    } catch {}
  }
  sizeDir(DATA, 3);

  healthCache.data = { memUsedMb, memTotalMb, uptimeSecs, dataSizeBytes };
  healthCache.ts = now;
  return healthCache.data;
}

function getStats() {
  const mem = safeLs(path.join(DATA, 'memory')).filter(f => f.endsWith('.md')).length;
  const skills = safeLs(path.join(DATA, 'skills')).filter(f => {
    try { return fs.statSync(path.join(DATA, 'skills', f)).isDirectory(); } catch { return false; }
  }).length;
  const learnings = safeLs(path.join(DATA, 'learnings')).filter(f => f.endsWith('.md') || f.endsWith('.txt')).length;
  let daysActive = 0, createdAt = null;
  const ts = safeRead(path.join(DATA, '.created_at'));
  if (ts) {
    const epoch = parseInt(ts.trim());
    if (!isNaN(epoch)) {
      createdAt = new Date(epoch * 1000).toISOString();
      daysActive = Math.floor((Date.now() / 1000 - epoch) / 86400);
    }
  } else {
    // Fallback: use HUB.yaml mtime
    try {
      const s = fs.statSync(path.join(DATA, 'HUB.yaml'));
      createdAt = s.birthtime.toISOString();
      daysActive = Math.floor((Date.now() - s.birthtimeMs) / 86400000);
    } catch {}
  }
  return { memory: mem, skills, learnings, daysActive, createdAt, health: getHealth() };
}

function listFiles(subpath) {
  const base = path.join(DATA, subpath || '');
  const allowed = path.resolve(DATA);
  const target = path.resolve(base);
  if (!target.startsWith(allowed)) return { error: 'forbidden' };
  const entries = safeLs(target);
  // Filter out blocked files from listing
  return entries.filter(name => !isBlocked(name)).map(name => {
    const full = path.join(target, name);
    let isDir = false, size = 0, mtime = null;
    try {
      const s = fs.statSync(full);
      isDir = s.isDirectory();
      size = s.size;
      mtime = s.mtime.toISOString();
    } catch {}
    return { name, isDir, size, mtime, path: path.join(subpath || '', name) };
  }).sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
}

function isBlocked(filename) {
  // Security: Block reading sensitive files
  // Allowlist: specific JSON files that the dashboard needs to display
  const allowlist = ['notifications.json', 'execution-log.json', 'heartbeat-state.json', '.tasks.json'];
  if (allowlist.includes(filename)) return false;

  // Patterns: *.json, .env*, *secrets*, *key*, *token*, *password*, *credential*
  const denylists = [
    /^\.env/i,           // .env, .env.local, .env.production, etc.
    /\.json$/i,           // *.json files (config, keys, tokens, etc.)
    /secrets/i,           // *secrets*, SECRETS, etc.
    /key/i,               // *key*, API_KEY, etc.
    /token/i,             // *token*, TOKENS, etc.
    /password/i,          // *password*, PASSWD, etc.
    /credential/i,        // *credential*, CREDENTIALS, etc.
    /private/i,           // *private*, PRIVATE_KEY, etc.
    /openssh_private/i,   // SSH keys
    /aws_access_key/i,    // AWS credentials
    /\.pgpass$/i,         // PostgreSQL password file
    /\.netrc$/i,          // FTP credentials
    /\.ssh\/config$/i,    // SSH config
  ];

  for (const pattern of denylists) {
    if (pattern.test(filename)) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════
// Git Sync — Push/pull workspace templates to a GitHub repo
// ══════════════════════════════════════════════════════════════════════

const GIT_IGNORE_CONTENT = `# Hubify workspace — never commit secrets or ephemeral data
openclaw.json
.workspace-password
.created_at
.onboarded
.first-boot-message
.smartsync/
.git-sync/
gateway.log
memory/
learnings/
*.log
.env*
node_modules/
`;

function getGitHubToken() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'openclaw.json'), 'utf8')); } catch {}
  return (cfg.env || {}).GITHUB_TOKEN || '';
}

function gitExec(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: DATA, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

function gitRemoteUrl(repoUrl, token) {
  // Convert https://github.com/owner/repo to https://x-access-token:TOKEN@github.com/owner/repo
  return repoUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
}

function getGitSyncState() {
  const stateFile = path.join(DATA, '.git-sync', 'state.json');
  const raw = safeRead(stateFile);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return {};
}

function saveGitSyncState(state) {
  const dir = path.join(DATA, '.git-sync');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2));
}

function fileContent(subpath) {
  const base = path.join(DATA, subpath || '');
  const allowed = path.resolve(DATA);
  const target = path.resolve(base);
  if (!target.startsWith(allowed)) return { error: 'forbidden' };

  // Security: check filename against denylist
  const filename = path.basename(target);
  if (isBlocked(filename)) {
    return { error: 'forbidden: sensitive file' };
  }

  const content = safeRead(target);
  if (content === null) return { error: 'not found' };
  return { content, path: subpath };
}

function parseSkillFrontmatter(content) {
  if (!content || !content.startsWith('---')) return {};
  const end = content.indexOf('---', 3);
  if (end === -1) return {};
  const fm = content.slice(3, end).trim();
  const result = {};
  fm.split('\n').forEach(line => {
    const m = line.match(/^(\w[\w_]*)\s*:\s*"?([^"]*)"?\s*$/);
    if (m) result[m[1]] = m[2].trim();
  });
  // Parse try_me from metadata block
  const tryMatch = content.match(/try_me:\s*['"](.+?)['"]/);
  if (tryMatch) result.try_me = tryMatch[1];
  // Parse triggers
  const triggers = [];
  const trigSection = content.match(/triggers:\s*\n((?:\s+-\s+"[^"]+"\n?)+)/);
  if (trigSection) {
    trigSection[1].replace(/-\s+"([^"]+)"/g, (_, t) => triggers.push(t));
  }
  if (triggers.length) result.triggers = triggers;
  return result;
}

function listSkills() {
  const skillsDir = path.join(DATA, 'skills');
  const dirs = safeLs(skillsDir).filter(f => {
    try { return fs.statSync(path.join(skillsDir, f)).isDirectory(); } catch { return false; }
  });
  return dirs.map(name => {
    const skillMd = path.join(skillsDir, name, 'SKILL.md');
    const readme = path.join(skillsDir, name, 'README.md');
    const content = safeRead(skillMd) || safeRead(readme) || '';
    const lines = content.split('\n').filter(l => l.trim());
    let description = lines.find(l => !l.startsWith('#') && !l.startsWith('---')) || lines[0] || '';
    description = description.replace(/^#+\s*/, '').trim();
    const fm = parseSkillFrontmatter(content);
    return {
      name,
      description: fm.description || description,
      content,
      version: fm.version || null,
      tier: fm.tier || null,
      category: fm.category || null,
      try_me: fm.try_me || null,
      triggers: fm.triggers || []
    };
  });
}

function getSkillCatalog() {
  return [
    { name: 'morning-brief', description: 'Daily orientation brief — priorities, calendar, and what matters today', tier: 'universal', category: 'productivity', try_me: 'Say: "Give me my morning brief"', installed: false },
    { name: 'meeting-notes', description: 'Paste a transcript and get structured notes with decisions and action items', tier: 'universal', category: 'productivity', try_me: 'Paste any transcript and say "meeting notes"', installed: false },
    { name: 'quick-capture', description: 'Fast note-to-memory — capture tasks, facts, decisions with one message', tier: 'universal', category: 'productivity', try_me: 'Say: "Remember that the API deadline is March 15"', installed: false },
    { name: 'web-research', description: 'Search the web and summarize findings — quick lookups or deep research', tier: 'universal', category: 'research', try_me: 'Say: "Research the latest on [any topic]"', installed: false },
    { name: 'email-draft', description: 'Draft emails matched to your style — never sends without approval', tier: 'universal', category: 'communication', try_me: 'Say: "Draft an email to my team about the product launch"', installed: false },
    { name: 'task-manager', description: 'Create, update, and manage tasks via natural language — your AI project manager', tier: 'universal', category: 'productivity', try_me: 'Say: "Create a task to redesign the landing page, high priority, due Friday"', installed: false },
    { name: 'github', description: 'GitHub integration — PRs, issues, CI/CD monitoring', tier: 'template', category: 'dev', try_me: 'Say: "Check my open PRs"', installed: false },
    { name: 'strava', description: 'Strava fitness tracking — workouts, streaks, accountability', tier: 'template', category: 'fitness', try_me: 'Say: "How was my workout this week?"', installed: false },
    { name: 'weather', description: 'Weather forecasts for your location', tier: 'template', category: 'productivity', try_me: 'Say: "What\'s the weather today?"', installed: false },
    { name: 'gog', description: 'Google Calendar + Gmail integration', tier: 'template', category: 'productivity', try_me: 'Say: "What\'s on my calendar?"', installed: false },
    { name: 'coding-agent', description: 'Autonomous coding agent — builds features, fixes bugs, writes tests', tier: 'advanced', category: 'dev', try_me: 'Say: "Build a REST API for user management"', installed: false },
    { name: 'apple-reminders', description: 'Sync with Apple Reminders', tier: 'template', category: 'productivity', try_me: 'Say: "Show my reminders"', installed: false },
  ];
}

function getIntegrations() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'openclaw.json'), 'utf8')); } catch {}
  const env = cfg.env || {};

  const defs = [
    { id: 'github',    name: 'GitHub',    icon: 'github',   envVar: 'GITHUB_TOKEN',          logoUrl: 'https://github.githubassets.com/favicons/favicon-dark.svg' },
    { id: 'slack',     name: 'Slack',     icon: 'slack',    envVar: 'SLACK_TOKEN',            logoUrl: 'https://www.google.com/s2/favicons?domain=slack.com&sz=64' },
    { id: 'gmail',     name: 'Gmail',     icon: 'mail',     envVar: 'GOOGLE_CLIENT_ID',       logoUrl: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=64' },
    { id: 'notion',    name: 'Notion',    icon: 'notebook', envVar: 'NOTION_API_KEY',         logoUrl: 'https://www.google.com/s2/favicons?domain=notion.so&sz=64' },
    { id: 'strava',    name: 'Strava',    icon: 'activity', envVar: 'STRAVA_ACCESS_TOKEN',    logoUrl: 'https://www.google.com/s2/favicons?domain=strava.com&sz=64' },
    { id: 'twitter',   name: 'Twitter/X', icon: 'twitter',  envVar: 'TWITTER_API_KEY',        logoUrl: 'https://www.google.com/s2/favicons?domain=x.com&sz=64' },
    { id: 'anthropic', name: 'Anthropic', icon: 'cpu',      envVar: 'ANTHROPIC_API_KEY',      logoUrl: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64' },
    { id: 'openai',    name: 'OpenAI',    icon: 'bot',      envVar: 'OPENAI_API_KEY',         logoUrl: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64' },
  ];

  // Scan skills for integration keyword mentions
  const skillsDir = path.join(DATA, 'skills');
  const skillDirs = safeLs(skillsDir).filter(f => {
    try { return fs.statSync(path.join(skillsDir, f)).isDirectory(); } catch { return false; }
  });
  const skillContents = {};
  skillDirs.forEach(name => {
    const content = safeRead(path.join(skillsDir, name, 'SKILL.md')) || '';
    skillContents[name] = content.toLowerCase();
  });

  return defs.map(d => {
    const linkedSkills = [];
    const keyword = d.id.toLowerCase();
    for (const [skillName, content] of Object.entries(skillContents)) {
      if (content.includes(keyword) || content.includes(d.envVar.toLowerCase())) {
        linkedSkills.push(skillName);
      }
    }
    return {
      ...d,
      connected: !!env[d.envVar],
      linkedSkills
    };
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Workspace-Token');
}

/**
 * Validate a hubify workspace JWT token.
 * Returns { valid: true, payload } or { valid: false, error }
 * Uses HS256 with WORKSPACE_JWT_SECRET from environment.
 * Pure Node.js — no npm deps.
 */
function validateWorkspaceJwt(token) {
  const secret = (process.env.WORKSPACE_JWT_SECRET || '').trim();
  if (!secret) return { valid: false, error: 'no secret configured' };
  if (!token) return { valid: false, error: 'no token' };

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'malformed jwt' };

    const [headerB64, payloadB64, sigB64] = parts;

    // Verify signature
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    if (expectedSig !== sigB64) return { valid: false, error: 'invalid signature' };

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return { valid: false, error: 'token expired' };
    }

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Issue a workspace JWT token (HS256).
 * Valid for 24 hours. Used for workspace-level auth.
 */
function issueWorkspaceJwt(username) {
  const secret = (process.env.WORKSPACE_JWT_SECRET || '').trim();
  if (!secret) throw new Error('WORKSPACE_JWT_SECRET not set');

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 86400; // 24 hours
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    username: username,
    iss: 'hubify-workspace',
    iat: now,
    exp: now + expiresIn
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${headerB64}.${payloadB64}`;
  
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${sig}`;
}

// ══════════════════════════════════════════════════════════════════════
// Template Views — scoped dashboard configurations for workspace switcher
// ══════════════════════════════════════════════════════════════════════

var TEMPLATE_VIEWS = {
  myos: {
    name: 'MyOS', accent: '#D4A574', accentDim: 'rgba(212,165,116,0.08)',
    agentName: 'Myo', monogram: 'M',
    nav: [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'projects', label: 'Projects', icon: 'folder' },
      { id: 'tasks', label: 'Tasks', icon: 'check-circle' },
      { id: 'fitness', label: 'Fitness', icon: 'activity' },
      { id: 'comms', label: 'Comms', icon: 'mail' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'dev-os': {
    name: 'Dev OS', accent: '#60A5FA', accentDim: 'rgba(96,165,250,0.08)',
    agentName: 'Codex', monogram: 'D',
    nav: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'repos', label: 'Repos', icon: 'github' },
      { id: 'cicd', label: 'CI/CD', icon: 'activity' },
      { id: 'reviews', label: 'Reviews', icon: 'eye' },
      { id: 'deploy', label: 'Deploys', icon: 'arrow-up' },
      { id: 'issues', label: 'Issues', icon: 'circle' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'founder-os': {
    name: 'Founder OS', accent: '#34D399', accentDim: 'rgba(52,211,153,0.08)',
    agentName: 'Scout', monogram: 'F',
    nav: [
      { id: 'home', label: 'Command', icon: 'home' },
      { id: 'pipeline', label: 'Pipeline', icon: 'activity' },
      { id: 'content', label: 'Content', icon: 'edit' },
      { id: 'outreach', label: 'Outreach', icon: 'mail' },
      { id: 'analytics', label: 'Analytics', icon: 'eye' },
      { id: 'intel', label: 'Intel', icon: 'search' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'research-os': {
    name: 'Research OS', accent: '#A78BFA', accentDim: 'rgba(167,139,250,0.08)',
    agentName: 'Scholar', monogram: 'R',
    nav: [
      { id: 'home', label: 'Library', icon: 'home' },
      { id: 'papers', label: 'Papers', icon: 'file-text' },
      { id: 'notes', label: 'Notes', icon: 'edit' },
      { id: 'synthesis', label: 'Synthesis', icon: 'cpu' },
      { id: 'graph', label: 'Knowledge', icon: 'layout' },
      { id: 'search', label: 'Deep Search', icon: 'search' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  minimal: {
    name: 'Minimal', accent: '#E2E8F0', accentDim: 'rgba(226,232,240,0.06)',
    agentName: 'Agent', monogram: '\u2014',
    nav: [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'skills', label: 'Skills', icon: 'zap' },
      { id: 'memory', label: 'Memory', icon: 'circle' },
      { id: 'terminal', label: 'Terminal', icon: 'terminal' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'content-machine': {
    name: 'Content Machine', accent: '#FF6B6B', accentDim: 'rgba(255,107,107,0.08)',
    agentName: 'Quill', monogram: 'CM',
    nav: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'trends', label: 'Trends', icon: 'activity' },
      { id: 'content', label: 'Content', icon: 'edit' },
      { id: 'visuals', label: 'Visuals', icon: 'image' },
      { id: 'queue', label: 'Queue', icon: 'clock' },
      { id: 'analytics', label: 'Analytics', icon: 'eye' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'health-coach-os': {
    name: 'Health Coach OS', accent: '#4ECB71', accentDim: 'rgba(78,203,113,0.08)',
    agentName: 'Coach', monogram: 'HC',
    nav: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'meals', label: 'Meals', icon: 'circle' },
      { id: 'plan', label: 'Meal Plan', icon: 'check-circle' },
      { id: 'grocery', label: 'Groceries', icon: 'grid' },
      { id: 'health', label: 'Health', icon: 'activity' },
      { id: 'coach', label: 'Coach', icon: 'message-circle' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'rpg-life-os': {
    name: 'RPG Life OS', accent: '#9D4EDD', accentDim: 'rgba(157,78,221,0.08)',
    agentName: 'Game Master', monogram: 'XP',
    nav: [
      { id: 'home', label: 'Character', icon: 'home' },
      { id: 'quests', label: 'Quests', icon: 'zap' },
      { id: 'xp', label: 'XP & Streaks', icon: 'activity' },
      { id: 'achievements', label: 'Achievements', icon: 'check-circle' },
      { id: 'leaderboard', label: 'Leaderboard', icon: 'eye' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'autonomous-dev-team': {
    name: 'Autonomous Dev Team', accent: '#3B82F6', accentDim: 'rgba(59,130,246,0.08)',
    agentName: 'Codex', monogram: 'AT',
    nav: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'brief', label: 'Project Brief', icon: 'file-text' },
      { id: 'build', label: 'Build', icon: 'settings' },
      { id: 'test', label: 'Testing', icon: 'check-circle' },
      { id: 'deploy', label: 'Deploy', icon: 'arrow-up' },
      { id: 'heal', label: 'Self-Heal', icon: 'puzzle' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'seo-empire': {
    name: 'SEO Empire Builder', accent: '#F97316', accentDim: 'rgba(249,115,22,0.08)',
    agentName: 'Scout', monogram: 'SE',
    nav: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'keywords', label: 'Keywords', icon: 'search' },
      { id: 'strategy', label: 'Strategy', icon: 'layout' },
      { id: 'content', label: 'Content', icon: 'edit' },
      { id: 'backlinks', label: 'Backlinks', icon: 'link' },
      { id: 'rankings', label: 'Rankings', icon: 'activity' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  },
  'company-os': {
    name: 'Company OS', accent: '#818CF8', accentDim: 'rgba(129,140,248,0.08)',
    agentName: 'Ops', monogram: 'CO',
    nav: [
      { id: 'home', label: 'Command', icon: 'home' },
      { id: 'team', label: 'Team', icon: 'activity' },
      { id: 'ops', label: 'Operations', icon: 'settings' },
      { id: 'finance', label: 'Finance', icon: 'circle' },
      { id: 'comms', label: 'Comms', icon: 'mail' },
      { id: 'docs', label: 'Docs', icon: 'file-text' },
      { id: 'heartbeats', label: 'Heartbeats', icon: 'heart' },
      { id: 'integrations', label: 'Integrations', icon: 'link' },
      { id: 'git', label: 'Git Sync', icon: 'github' }
    ]
  }
};

// ══════════════════════════════════════════════════════════════════════
// Agent Modes — persona switching within a template
// ══════════════════════════════════════════════════════════════════════

const AGENT_MODES = {
  personal: {
    label: "Personal",
    soul_file: "SOUL.md", // Default template SOUL.md
    description: "Your personal AI assistant — fitness, projects, inbox, and proactive support"
  },
  founder: {
    label: "Founder",
    soul_file: "SOUL-founder.md",
    description: "Strategic advisor — company building, OKRs, competitive analysis, fundraising"
  },
  dev: {
    label: "Dev",
    soul_file: "SOUL-dev.md",
    description: "Senior engineer — code review, architecture, CI/CD, debugging, docs"
  },
  research: {
    label: "Research",
    soul_file: "SOUL-research.md",
    description: "Deep researcher — literature review, data analysis, hypothesis testing"
  }
};

// ── Template View Override — agent-driven customization ──
// Persisted to /data/.template-view-override.json
// Merged on top of base TEMPLATE_VIEWS entry so agents can customize their workspace appearance

function getTemplateViewOverride() {
  var raw = safeRead(path.join(DATA, '.template-view-override.json'));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveTemplateViewOverride(override) {
  fs.writeFileSync(path.join(DATA, '.template-view-override.json'), JSON.stringify(override, null, 2));
}

function getTemplateConfig() {
  var slug = smartsyncGetTemplateSlug();
  var version = smartsyncGetCurrentVersion();
  var base = TEMPLATE_VIEWS[slug] || TEMPLATE_VIEWS['myos'];
  var override = getTemplateViewOverride();

  // Merge override on top of base view
  var view = Object.assign({}, base);
  if (override) {
    if (override.accent) { view.accent = override.accent; view.accentDim = override.accentDim || hexToAccentDim(override.accent); }
    if (override.agentName) view.agentName = override.agentName;
    if (override.monogram) view.monogram = override.monogram;
    if (override.name) view.name = override.name;
    if (override.nav) view.nav = override.nav; // Full nav replacement
    if (override.navAppend && Array.isArray(override.navAppend)) {
      // Append items (deduplicate by id)
      var existingIds = view.nav.map(function(n) { return n.id; });
      var appended = view.nav.slice();
      override.navAppend.forEach(function(item) {
        if (existingIds.indexOf(item.id) === -1) appended.push(item);
      });
      view.nav = appended;
    }
  }

  return {
    template: slug,
    templateVersion: version,
    view: view,
    availableTemplates: Object.keys(TEMPLATE_VIEWS)
  };
}

function hexToAccentDim(hex) {
  // Convert #RRGGBB to rgba(r,g,b,0.08)
  var r = parseInt(hex.slice(1, 3), 16) || 0;
  var g = parseInt(hex.slice(3, 5), 16) || 0;
  var b = parseInt(hex.slice(5, 7), 16) || 0;
  return 'rgba(' + r + ',' + g + ',' + b + ',0.08)';
}

// ── GET /self — Agent Self-Awareness ──
// Returns everything the agent needs to understand itself and its capabilities
function getSelf() {
  var slug = smartsyncGetTemplateSlug();
  var version = smartsyncGetCurrentVersion();
  var tc = getTemplateConfig();
  var view = tc.view;
  var stats = getStats();

  // Cron jobs
  var cronJobs = [];
  var cronRaw = safeRead(path.join(DATA, 'cron', 'jobs.json'));
  if (cronRaw) {
    try { cronJobs = JSON.parse(cronRaw).jobs || []; } catch {}
  }

  // Memory files
  var memFiles = safeLs(path.join(DATA, 'memory')).filter(function(f) { return f.endsWith('.md'); });

  // Skills
  var skillDirs = safeLs(path.join(DATA, 'skills')).filter(function(f) {
    try { return fs.statSync(path.join(DATA, 'skills', f)).isDirectory(); } catch { return false; }
  });

  // Pages directory
  var pageFiles = safeLs(path.join(DATA, 'pages')).filter(function(f) { return f.endsWith('.md'); });

  var availableIcons = [
    'home', 'folder', 'activity', 'mail', 'heart', 'link', 'github',
    'eye', 'arrow-up', 'circle', 'edit', 'search', 'cpu', 'layout',
    'file-text', 'zap', 'terminal', 'settings', 'clock', 'image',
    'grid', 'check-circle', 'message-circle', 'notebook', 'puzzle',
    'bot', 'star', 'globe', 'book', 'code', 'database', 'download',
    'upload', 'play', 'pause', 'refresh', 'trash', 'lock', 'unlock',
    'flag', 'bell', 'calendar', 'camera', 'compass', 'feather',
    'headphones', 'map', 'mic', 'monitor', 'pen-tool', 'phone',
    'printer', 'radio', 'scissors', 'shield', 'shopping-cart',
    'speaker', 'sun', 'thermometer', 'tool', 'truck', 'tv',
    'umbrella', 'video', 'watch', 'wifi', 'wind'
  ];

  return {
    identity: {
      username: process.env.HUBIFY_USERNAME || 'workspace',
      hubId: process.env.HUB_ID || 'unknown',
      url: 'https://' + (process.env.HUBIFY_USERNAME || 'workspace') + '.hubify.com',
      template: slug,
      templateVersion: version,
      agentName: view.agentName,
      monogram: view.monogram
    },
    capabilities: [
      'file-read-write: Full access to /data/ filesystem',
      'shell: Execute bash commands, install packages, run scripts',
      'http: Make API calls via curl',
      'dashboard-api: http://127.0.0.1:4000/ — all workspace management endpoints',
      'template-view: Customize dashboard appearance (accent color, nav items, agent name)',
      'dashboard-blocks: Modify homepage widget layout',
      'git: Local version control, GitHub sync',
      'skills: Install, create, and execute skills',
      'memory: Structured memory system (daily notes, long-term, learnings)',
      'cron: Scheduled autonomous tasks',
      'pages: Create custom nav pages as markdown files in /data/pages/'
    ],
    api: {
      self: { method: 'GET', path: '/self', description: 'This endpoint — your identity and capabilities' },
      templateView: {
        method: 'POST', path: '/template-view',
        description: 'Customize your dashboard appearance',
        schema: {
          agentName: 'string — your display name in the sidebar',
          monogram: 'string — 1-2 character monogram shown in sidebar avatar',
          accent: 'string — hex color like #D4A574 for accent throughout dashboard',
          name: 'string — template display name in sidebar header',
          navAppend: 'array — add nav items: [{id, label, icon}]. Creates /data/pages/{id}.md for content.',
          nav: 'array — full nav replacement (use navAppend instead to keep existing items)'
        }
      },
      dashboardBlocks: { method: 'POST', path: '/dashboard-blocks', description: 'Modify homepage widget blocks' },
      stats: { method: 'GET', path: '/stats', description: 'Workspace statistics' },
      files: { method: 'GET', path: '/files?path=subdir', description: 'List files in workspace' },
      fileContent: { method: 'GET', path: '/files/content?path=file.md', description: 'Read file content' },
      fileWrite: { method: 'POST', path: '/files/write', description: 'Write file content', schema: { path: 'string', content: 'string' } },
      tasks: { method: 'GET', path: '/tasks', description: 'List all tasks' },
      taskAdd: { method: 'POST', path: '/tasks/add', description: 'Create a task' },
      memoryAppend: { method: 'POST', path: '/memory/append', description: 'Append to today\'s memory' },
      gitStatus: { method: 'GET', path: '/git/status', description: 'Git status of workspace' },
      gitCommit: { method: 'POST', path: '/git/local-commit', description: 'Commit workspace changes' }
    },
    state: {
      nav: view.nav,
      accent: view.accent,
      agentName: view.agentName,
      skills: skillDirs,
      skillCount: skillDirs.length,
      memoryFiles: memFiles.length,
      cronJobs: cronJobs.map(function(j) { return { id: j.jobId, name: j.name, schedule: j.schedule, enabled: j.enabled }; }),
      pages: pageFiles,
      stats: stats
    },
    availableIcons: availableIcons,
    guidance: 'You can evolve your workspace to match your human\'s needs. Change your name, colors, add nav pages for topics you track. Create /data/pages/{id}.md files for custom nav page content.'
  };
}

// ══════════════════════════════════════════════════════════════════════
// Dashboard v2 endpoints — context, onboarding, agent-activity
// ══════════════════════════════════════════════════════════════════════

function getContext() {
  // Parse USER.md for structured user context
  const userMd = safeRead(path.join(DATA, 'USER.md')) || '';
  const user = {};

  // Extract **Name:** field
  const nameMatch = userMd.match(/\*\*Name:\*\*\s*(.+)/i);
  user.name = nameMatch ? nameMatch[1].trim() : (process.env.HUBIFY_USERNAME || 'user');

  // Extract timezone
  const tzMatch = userMd.match(/\*\*Timezone:\*\*\s*(.+)/i) || userMd.match(/timezone[:\s]+(.+)/i);
  user.timezone = tzMatch ? tzMatch[1].trim() : null;

  // Extract Priority Stack (bullet list under ## Priority Stack)
  user.priorityStack = [];
  const prioMatch = userMd.match(/##\s*Priority Stack\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  if (prioMatch) {
    const lines = prioMatch[1].split('\n');
    for (const line of lines) {
      const bullet = line.match(/^[\s]*[-*]\s+(.+)/);
      if (bullet) user.priorityStack.push(bullet[1].trim());
    }
  }

  // Extract Active Projects (markdown table rows)
  user.activeProjects = [];
  const projMatch = userMd.match(/##\s*Active Projects\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  if (projMatch) {
    const lines = projMatch[1].split('\n');
    for (const line of lines) {
      // Match table rows: | project | status | next_action |
      const row = line.match(/\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
      if (row && !row[1].trim().startsWith('---') && !row[1].trim().toLowerCase().startsWith('project')) {
        const proj = row[1].trim();
        const stat = row[2].trim();
        const next = row[3].trim();
        // Filter out placeholder entries from template USER.md
        if (/^\[.*\]$/.test(proj) || /^\[.*\]$/.test(next)) continue;
        user.activeProjects.push({
          project: proj,
          status: stat,
          next_action: next
        });
      }
    }
  }

  // Extract Tools I Use
  user.tools = [];
  const toolsMatch = userMd.match(/##\s*Tools I Use\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  if (toolsMatch) {
    const lines = toolsMatch[1].split('\n');
    for (const line of lines) {
      const bullet = line.match(/^[\s]*[-*]\s+(.+)/);
      if (bullet) user.tools.push(bullet[1].trim());
    }
  }

  // Extract What I'm Building
  const buildMatch = userMd.match(/##\s*What I'm Building\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  user.building = '';
  if (buildMatch) {
    const lines = buildMatch[1].split('\n').filter(l => l.trim());
    user.building = lines.map(l => l.replace(/^[\s]*[-*]\s+/, '').trim()).join('; ');
  }

  // Memory — curated MEMORY.md + recent daily files
  const memory = {};
  memory.curated = safeRead(path.join(DATA, 'MEMORY.md')) || '';

  // Recent memory files (memory/YYYY-MM-DD.md) sorted desc
  const memDir = path.join(DATA, 'memory');
  const memFiles = safeLs(memDir)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 7);
  memory.recent = memFiles.map(f => {
    const content = safeRead(path.join(memDir, f)) || '';
    const nonEmpty = content.split('\n').filter(l => l.trim()).slice(0, 5);
    return { date: f.replace('.md', ''), preview: nonEmpty.join('\n') };
  });

  // Learnings files
  const learnDir = path.join(DATA, 'learnings');
  const learnFiles = safeLs(learnDir)
    .filter(f => f.endsWith('.md') || f.endsWith('.txt'))
    .sort((a, b) => {
      try {
        const sa = fs.statSync(path.join(learnDir, a)).mtimeMs;
        const sb = fs.statSync(path.join(learnDir, b)).mtimeMs;
        return sb - sa;
      } catch { return 0; }
    })
    .slice(0, 5);
  const learnings = learnFiles.map(f => {
    const content = safeRead(path.join(learnDir, f)) || '';
    const lines = content.split('\n').filter(l => l.trim()).slice(0, 3);
    return { name: f, preview: lines.join('\n') };
  });

  // Heartbeat
  const heartbeat = safeRead(path.join(DATA, 'HEARTBEAT.md')) || '';

  // Structured tasks summary (top 10 active)
  var tasksSummary = [];
  try {
    var tData = readTasks();
    var active = (tData.tasks || []).filter(function(t) { return t.status !== 'done'; });
    var prioOrd = { urgent: 0, high: 1, medium: 2, low: 3 };
    active.sort(function(a, b) { return (prioOrd[a.priority] || 2) - (prioOrd[b.priority] || 2); });
    tasksSummary = active.slice(0, 10).map(function(t) {
      return { id: t.id, title: t.title, status: t.status, priority: t.priority, assignee: t.assignee, dueDate: t.dueDate };
    });
  } catch {}

  return { user, memory, learnings, heartbeat, templateConfig: getTemplateConfig(), tasksSummary: tasksSummary };
}

function getSkippedSteps() {
  const raw = safeRead(path.join(DATA, '.onboard-skipped.json'));
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function getOnboardingStatus() {
  const steps = {};
  const skipped = getSkippedSteps();

  // 1. meetAgent: .first-boot-message deleted OR memory files exist OR any gateway messages exist
  const firstBootExists = fs.existsSync(path.join(DATA, '.first-boot-message'));
  const memFiles = safeLs(path.join(DATA, 'memory')).filter(f => f.endsWith('.md'));
  // Also check if gateway has conversation history
  const gatewayLogExists = fs.existsSync(path.join(DATA, 'gateway.log'));
  let hasGatewayMessages = false;
  if (gatewayLogExists) {
    const logContent = safeRead(path.join(DATA, 'gateway.log')) || '';
    hasGatewayMessages = logContent.length > 200; // Gateway log with actual messages
  }
  steps.meetAgent = { complete: !firstBootExists || memFiles.length > 0 || hasGatewayMessages, label: 'Meet your agent' };

  // 2. shareContext: USER.md modified (lower threshold: 200 chars, no placeholder text)
  const userMd = safeRead(path.join(DATA, 'USER.md')) || '';
  const hasPlaceholder = userMd.includes('[your primary') || userMd.includes('[your ');
  steps.shareContext = { complete: !hasPlaceholder && userMd.length > 200, label: 'Tell your agent about you' };

  // 3. connectTools: Any env var set OR any skill installed
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'openclaw.json'), 'utf8')); } catch {}
  const env = cfg.env || {};
  const hasAnyEnv = Object.values(env).some(v => v && v.length > 0);
  // Also check if any skills are installed (skill dirs in /data/skills/)
  const skillDirs = safeLs(path.join(DATA, 'skills')).filter(f => {
    try { return fs.statSync(path.join(DATA, 'skills', f)).isDirectory(); } catch { return false; }
  });
  steps.connectTools = { complete: hasAnyEnv || skillDirs.length > 0, label: 'Connect an integration' };

  // 4. setupTelegram: TELEGRAM_BOT_TOKEN or TELEGRAM_TOKEN in openclaw.json
  const hasTelegram = !!(env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_TOKEN);
  steps.setupTelegram = { complete: hasTelegram, label: 'Set up Telegram' };

  // 5. reviewHeartbeat: HEARTBEAT.md has no {{USERNAME}} template vars AND heartbeat actually ran
  const heartbeat = safeRead(path.join(DATA, 'HEARTBEAT.md')) || '';
  const hasTemplate = heartbeat.includes('{{USERNAME}}') || heartbeat.includes('{{SUBDOMAIN}}');
  // Also check if heartbeat-state.json has any non-null lastChecks (heartbeat actually ran)
  const hbState = safeRead(path.join(DATA, 'memory', 'heartbeat-state.json'));
  let heartbeatRan = false;
  if (hbState) {
    try {
      const parsed = JSON.parse(hbState);
      heartbeatRan = Object.values(parsed.lastChecks || {}).some(v => v !== null);
    } catch {}
  }
  const heartbeatReviewed = heartbeat.length > 0 && !hasTemplate;
  steps.reviewHeartbeat = { complete: heartbeatReviewed || heartbeatRan, label: 'Review heartbeat schedule' };

  // Apply skipped overrides — organic completion always takes priority
  for (const key of Object.keys(steps)) {
    if (!steps[key].complete && skipped[key]) {
      steps[key].complete = true;
      steps[key].skipped = true;
    }
  }

  const completedCount = Object.values(steps).filter(s => s.complete).length;
  const totalSteps = Object.keys(steps).length;
  const isOnboarded = fs.existsSync(path.join(DATA, '.onboarded'));

  return {
    isOnboarded,
    steps,
    completedCount,
    totalSteps,
    progress: Math.round((completedCount / totalSteps) * 100)
  };
}

function getAgentActivity() {
  const dirs = ['memory', 'learnings', 'skills', 'knowledge'];
  const recentFileChanges = [];

  for (const dir of dirs) {
    const base = path.join(DATA, dir);
    try {
      walkRecent(base, dir, recentFileChanges, 3); // max depth 3
    } catch {}
  }

  // Sort by mtime desc, take top 20
  recentFileChanges.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  return { recentFileChanges: recentFileChanges.slice(0, 20) };
}

// ══════════════════════════════════════════════════════════════════════
// Heartbeat, Cron Log, Budget — Phase 3 endpoints
// ══════════════════════════════════════════════════════════════════════

function getHeartbeatState() {
  // Read heartbeat-state.json (seeded by boot.sh)
  const stateFile = path.join(DATA, 'memory', 'heartbeat-state.json');
  let state = { lastChecks: { tasks: null, git: null, system: null, morning: null }, lastMessageSent: null };
  const raw = safeRead(stateFile);
  if (raw) {
    try { state = JSON.parse(raw); } catch {}
  }

  // Scan memory files for heartbeat entries as fallback
  const memDir = path.join(DATA, 'memory');
  const memFiles = safeLs(memDir).filter(f => f.endsWith('.md')).sort((a, b) => b.localeCompare(a)).slice(0, 3);
  const heartbeatMentions = [];
  for (const f of memFiles) {
    const content = safeRead(path.join(memDir, f)) || '';
    const lines = content.split('\n');
    for (const line of lines) {
      if (/heartbeat|cron|check-in|health.check/i.test(line)) {
        heartbeatMentions.push({ file: f, line: line.trim().slice(0, 120) });
      }
    }
  }

  // Parse HEARTBEAT.md for schedule info
  const heartbeatMd = safeRead(path.join(DATA, 'HEARTBEAT.md')) || '';
  const schedules = {};
  const cronMatch = heartbeatMd.match(/\*\/\d+\s+\*\s+\*\s+\*\s+\*/g);
  if (cronMatch) schedules.heartbeat = cronMatch[0];
  const gitCronMatch = heartbeatMd.match(/0\s+9\s+\*\s+\*\s+\*/);
  if (gitCronMatch) schedules.git = gitCronMatch[0];
  const sysCronMatch = heartbeatMd.match(/0\s+3\s+\*\s+\*\s+\*/);
  if (sysCronMatch) schedules.system = sysCronMatch[0];

  return {
    lastChecks: state.lastChecks || {},
    lastMessageSent: state.lastMessageSent || null,
    nextScheduled: {
      heartbeat: schedules.heartbeat || '*/30 * * * *',
      git: schedules.git || '0 9 * * *',
      system: schedules.system || '0 3 * * *'
    },
    recentMentions: heartbeatMentions.slice(0, 10)
  };
}

function getCronLog() {
  const entries = [];

  // Try structured cron log first
  const cronLogPaths = [
    path.join(DATA, '.openclaw', 'cron.log'),
    path.join(DATA, 'cron.log'),
    path.join(DATA, '.openclaw', 'logs', 'cron.log')
  ];

  for (const logPath of cronLogPaths) {
    const content = safeRead(logPath);
    if (content) {
      const lines = content.split('\n').filter(l => l.trim()).slice(-50);
      for (const line of lines) {
        // Parse common log formats: [timestamp] cron-name status duration
        const match = line.match(/\[([^\]]+)\]\s+(\S+)\s+(ok|error|success|fail\w*)\s*(?:(\d+)ms)?/i);
        if (match) {
          entries.push({
            ran_at: match[1],
            name: match[2],
            status: /ok|success/i.test(match[3]) ? 'ok' : 'error',
            duration_ms: match[4] ? parseInt(match[4]) : null,
            raw: line.slice(0, 200)
          });
        } else {
          // Fallback: just capture the line
          const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
          entries.push({
            ran_at: tsMatch ? tsMatch[1] : null,
            name: 'cron',
            status: /error|fail/i.test(line) ? 'error' : 'ok',
            duration_ms: null,
            raw: line.slice(0, 200)
          });
        }
      }
      break; // Use first found log
    }
  }

  // Fallback: scan memory files for heartbeat entries
  if (!entries.length) {
    const memDir = path.join(DATA, 'memory');
    const memFiles = safeLs(memDir).filter(f => f.endsWith('.md')).sort((a, b) => b.localeCompare(a)).slice(0, 7);
    for (const f of memFiles) {
      const content = safeRead(path.join(memDir, f)) || '';
      const lines = content.split('\n');
      for (const line of lines) {
        if (/heartbeat|cron|scheduled.check/i.test(line) && line.trim().length > 5) {
          entries.push({
            ran_at: f.replace('.md', ''),
            name: 'heartbeat',
            status: /error|fail/i.test(line) ? 'error' : 'ok',
            duration_ms: null,
            raw: line.trim().slice(0, 200)
          });
        }
      }
    }
  }

  return { entries: entries.slice(-20).reverse() };
}

function getBudget() {
  const result = {
    provider: 'openrouter',
    today: { estimated_cost_cents: 0, requests: 0, tokens_in: 0, tokens_out: 0 },
    period: { days: 1, estimated_cost_cents: 0 },
    limits: { daily_limit_cents: null, monthly_limit_cents: null },
    models_used: []
  };

  // Try to parse usage logs
  const usageLogPaths = [
    path.join(DATA, '.openclaw', 'usage.log'),
    path.join(DATA, '.openclaw', 'logs', 'usage.log'),
    path.join(DATA, 'gateway.log')
  ];

  const modelCounts = {};
  const todayStr = new Date().toISOString().slice(0, 10);
  let totalRequests = 0;
  let todayRequests = 0;
  let daysWithData = new Set();

  for (const logPath of usageLogPaths) {
    const content = safeRead(logPath);
    if (!content) continue;

    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      // Look for model usage indicators
      const modelMatch = line.match(/model[=:]\s*"?([a-zA-Z0-9\/-]+)/i);
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (modelMatch) {
        const model = modelMatch[1];
        if (!modelCounts[model]) modelCounts[model] = { total: 0, today: 0 };
        modelCounts[model].total++;
        totalRequests++;
        if (dateMatch) daysWithData.add(dateMatch[1]);
        if (dateMatch && dateMatch[1] === todayStr) {
          modelCounts[model].today++;
          todayRequests++;
        }
      }
    }
    break;
  }

  // Estimate costs based on model pricing (rough per-request estimates in cents)
  const MODEL_COSTS = {
    'haiku': 0.005,
    'claude-haiku': 0.005,
    'claude-haiku-4-5': 0.005,
    'gemini-flash': 0.003,
    'gemini-2.0-flash': 0.003,
    'sonnet': 0.15,
    'claude-sonnet': 0.15,
    'claude-sonnet-4-6': 0.15,
    'gpt-5.3-codex': 0.12,
    'sonar': 0.05,
    'sonar-pro': 0.10,
    'auto': 0.08,
    'openrouter/auto': 0.08,
  };

  function estimateCost(model, count) {
    for (const [key, cost] of Object.entries(MODEL_COSTS)) {
      if (model.toLowerCase().includes(key)) return cost * count;
    }
    return 0.05 * count; // default estimate
  }

  let todayCost = 0;
  let totalCost = 0;
  for (const [model, counts] of Object.entries(modelCounts)) {
    const todayEst = estimateCost(model, counts.today);
    const totalEst = estimateCost(model, counts.total);
    todayCost += todayEst;
    totalCost += totalEst;
    result.models_used.push({
      model: model,
      requests: counts.total,
      today_requests: counts.today,
      est_cost_cents: Math.round(totalEst * 100) / 100
    });
  }

  // Also count cron executions for estimation if no logs found
  if (!totalRequests) {
    // Estimate from heartbeat state — assume 48 haiku calls/day (every 30 min)
    const hbState = getHeartbeatState();
    const checks = Object.values(hbState.lastChecks || {}).filter(v => v !== null);
    if (checks.length > 0) {
      result.models_used.push({ model: 'haiku-4.5 (heartbeats)', requests: 48, today_requests: 48, est_cost_cents: 0.24 });
      todayCost = 0.24;
      todayRequests = 48;
    }
  }

  const numDays = Math.max(1, daysWithData.size);
  result.today.estimated_cost_cents = Math.round(todayCost * 100) / 100;
  result.today.requests = todayRequests;
  result.period.days = numDays;
  result.period.estimated_cost_cents = Math.round(totalCost * 100) / 100;

  return result;
}

function walkRecent(dirPath, relPath, results, maxDepth) {
  if (maxDepth <= 0) return;
  const entries = safeLs(dirPath);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = path.join(dirPath, entry);
    const rel = relPath + '/' + entry;
    try {
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walkRecent(full, rel, results, maxDepth - 1);
      } else {
        results.push({ path: rel, mtime: st.mtime.toISOString(), size: st.size });
      }
    } catch {}
  }
}

// ══════════════════════════════════════════════════════════════════════
// SmartSync helpers — pure Node.js, no npm deps
// ══════════════════════════════════════════════════════════════════════

function smartsyncGetCurrentVersion() {
  // 1. Check .smartsync/version.json
  const vf = path.join(DATA, '.smartsync', 'version.json');
  const raw = safeRead(vf);
  if (raw) {
    try { return JSON.parse(raw).version; } catch {}
  }
  // 2. Parse HUB.yaml for template_version
  const hub = safeRead(path.join(DATA, 'HUB.yaml')) || '';
  const match = hub.match(/template_version:\s*"([^"]+)"/);
  if (match) return match[1];
  // 3. Default
  return '1.0.0';
}

function smartsyncGetTemplateSlug() {
  const hub = safeRead(path.join(DATA, 'HUB.yaml')) || '';
  const match = hub.match(/template:\s*"([^"]+)"/);
  return match ? match[1] : 'myos';
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function smartsyncCheck(res) {
  const currentVersion = smartsyncGetCurrentVersion();
  const slug = smartsyncGetTemplateSlug();
  const url = `https://hubify.com/api/templates/check-update?template=${encodeURIComponent(slug)}&current_version=${encodeURIComponent(currentVersion)}`;
  httpsGet(url).then(data => {
    json(res, { ...data, currentVersion });
  }).catch(err => {
    json(res, { error: err.message, currentVersion, hasUpdate: false }, 502);
  });
}

function smartsyncApply(body, res) {
  try {
    var payload = JSON.parse(body);
  } catch {
    return json(res, { ok: false, error: 'invalid json' }, 400);
  }
  const acceptedFiles = payload.acceptedFiles || [];
  const targetVersion = payload.version;
  if (!targetVersion) return json(res, { ok: false, error: 'version required' }, 400);
  if (!acceptedFiles.length) return json(res, { ok: false, error: 'no files accepted' }, 400);

  const slug = smartsyncGetTemplateSlug();
  const url = `https://hubify.com/api/templates/version-files?template=${encodeURIComponent(slug)}&version=${encodeURIComponent(targetVersion)}`;

  httpsGet(url).then(data => {
    if (data.error) return json(res, { ok: false, error: data.error }, 502);

    let manifest;
    try { manifest = JSON.parse(data.manifest); } catch { return json(res, { ok: false, error: 'bad manifest' }, 502); }

    const allFiles = [
      ...(manifest.files || []).map(f => ({ ...f, type: 'template' })),
      ...(manifest.dashboardFiles || []).map(f => ({ ...f, type: 'dashboard' })),
    ];

    // Support special tokens: __all_template__ and __all_dashboard__
    const acceptAllTemplate = acceptedFiles.includes('__all_template__');
    const acceptAllDashboard = acceptedFiles.includes('__all_dashboard__');

    let filesUpdated = 0;
    const updatedPaths = [];

    for (const file of allFiles) {
      const accepted = acceptedFiles.includes(file.path)
        || (file.type === 'template' && acceptAllTemplate)
        || (file.type === 'dashboard' && acceptAllDashboard);
      if (!accepted) continue;

      const content = file.encoding === 'base64'
        ? Buffer.from(file.content, 'base64')
        : file.content;

      // Write template files to /data/
      if (file.type === 'template') {
        const target = path.resolve(path.join(DATA, file.path));
        if (!target.startsWith(path.resolve(DATA))) continue; // path traversal guard
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, content);
        filesUpdated++;
        updatedPaths.push(file.path);
      }

      // Write dashboard files to /opt/dashboard/ for hot-reload
      // Also persist to /data/.smartsync/dashboard/ for boot overlay
      if (file.type === 'dashboard') {
        const dashTarget = path.resolve(path.join('/opt/dashboard', file.path));
        if (dashTarget.startsWith(path.resolve('/opt/dashboard'))) {
          const dir = path.dirname(dashTarget);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(dashTarget, content);
        }
        // Persist for boot overlay
        const overlayTarget = path.resolve(path.join(DATA, '.smartsync', 'dashboard', file.path));
        if (overlayTarget.startsWith(path.resolve(DATA))) {
          const dir = path.dirname(overlayTarget);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(overlayTarget, content);
        }
        filesUpdated++;
        updatedPaths.push('dashboard/' + file.path);
      }
    }

    // Save originals for three-way merge on future updates
    const originalsDir = path.join(DATA, '.smartsync', 'originals');
    for (const file of allFiles) {
      const accepted = acceptedFiles.includes(file.path)
        || (file.type === 'template' && acceptAllTemplate)
        || (file.type === 'dashboard' && acceptAllDashboard);
      if (!accepted || file.type !== 'template') continue;
      const origTarget = path.resolve(path.join(originalsDir, file.path));
      if (!origTarget.startsWith(path.resolve(originalsDir))) continue;
      const dir = path.dirname(origTarget);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const content = file.encoding === 'base64'
        ? Buffer.from(file.content, 'base64')
        : file.content;
      fs.writeFileSync(origTarget, content);
    }

    // Save version tracking
    const syncDir = path.join(DATA, '.smartsync');
    if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });
    fs.writeFileSync(path.join(syncDir, 'version.json'), JSON.stringify({
      version: targetVersion,
      appliedAt: Date.now(),
      appliedFiles: updatedPaths,
    }, null, 2));

    const hasDashboardUpdates = updatedPaths.some(p => p.startsWith('dashboard/'));
    json(res, { ok: true, filesUpdated, hasDashboardUpdates });
  }).catch(err => {
    json(res, { ok: false, error: err.message }, 502);
  });
}

// ══════════════════════════════════════════════════════════════════════
// SSE (Server-Sent Events) — real-time dashboard updates
// ══════════════════════════════════════════════════════════════════════

var sseClients = [];

function sseEmit(eventType, data) {
  const payload = 'event: ' + eventType + '\ndata: ' + JSON.stringify(data) + '\n\n';
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Debounced file watcher — max 1 event per second per path
var sseLastEmit = {};
function sseDebouncedEmit(eventType, data, key) {
  const now = Date.now();
  const k = key || eventType;
  if (sseLastEmit[k] && now - sseLastEmit[k] < 1000) return;
  sseLastEmit[k] = now;
  sseEmit(eventType, data);
}

// ══════════════════════════════════════════════════════════════════════
// Notification Center — emit, read, dismiss notifications
// ══════════════════════════════════════════════════════════════════════

const NOTIF_FILE = path.join(DATA, 'notifications.json');
const NOTIF_CAP = 200;

function readNotifications() {
  const raw = safeRead(NOTIF_FILE);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return { notifications: [], preferences: { heartbeat: true, skill_run: true, file_change: false, system: true, gateway: true } };
}

function writeNotifications(data) {
  fs.writeFileSync(NOTIF_FILE, JSON.stringify(data, null, 2));
}

function emitNotification(type, title, body, source, meta) {
  const data = readNotifications();
  const prefs = data.preferences || {};
  // Check if this notification type is enabled
  if (prefs[type] === false) return null;

  const notif = {
    id: 'ntf_' + crypto.randomBytes(6).toString('hex'),
    type: type,
    title: title,
    body: body || '',
    timestamp: new Date().toISOString(),
    read: false,
    dismissed: false,
    source: source || '',
    meta: meta || {}
  };

  data.notifications.unshift(notif);
  // FIFO cap
  if (data.notifications.length > NOTIF_CAP) {
    data.notifications = data.notifications.slice(0, NOTIF_CAP);
  }
  writeNotifications(data);
  sseEmit('notification', notif);
  return notif;
}

// ══════════════════════════════════════════════════════════════════════
// Skill Execution Tracking
// ══════════════════════════════════════════════════════════════════════

const EXEC_LOG_FILE = path.join(DATA, 'skills', 'execution-log.json');
const EXEC_CAP = 500;

function readExecLog() {
  const raw = safeRead(EXEC_LOG_FILE);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return { executions: [], stats: {} };
}

function writeExecLog(data) {
  const dir = path.dirname(EXEC_LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EXEC_LOG_FILE, JSON.stringify(data, null, 2));
}

function logSkillExecution(skill, status, durationMs, trigger, summary) {
  const data = readExecLog();
  const exec = {
    id: 'exec_' + crypto.randomBytes(6).toString('hex'),
    skill: skill,
    started_at: new Date(Date.now() - (durationMs || 0)).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: durationMs || 0,
    status: status || 'success',
    trigger: trigger || 'user',
    summary: summary || ''
  };

  data.executions.unshift(exec);
  if (data.executions.length > EXEC_CAP) {
    data.executions = data.executions.slice(0, EXEC_CAP);
  }

  // Update per-skill stats
  if (!data.stats[skill]) {
    data.stats[skill] = { total_runs: 0, successes: 0, failures: 0, avg_duration_ms: 0, last_run: null };
  }
  const s = data.stats[skill];
  s.total_runs++;
  if (status === 'success') s.successes++;
  else s.failures++;
  s.avg_duration_ms = Math.round(((s.avg_duration_ms * (s.total_runs - 1)) + (durationMs || 0)) / s.total_runs);
  s.last_run = exec.completed_at;

  writeExecLog(data);

  // Emit notification
  emitNotification('skill_run',
    skill + ' ' + (status === 'success' ? 'completed' : 'failed'),
    summary || (status === 'success' ? 'Ran in ' + (durationMs || 0) + 'ms' : 'Execution failed'),
    'skill:' + skill,
    { skill, status, duration_ms: durationMs }
  );

  // SSE event
  sseEmit('skill-execution', { skill, status, duration_ms: durationMs, timestamp: exec.completed_at });
  return exec;
}

// ══════════════════════════════════════════════════════════════════════
// Memory Timeline helpers
// ══════════════════════════════════════════════════════════════════════

function categorizeEntry(title) {
  const t = (title || '').toLowerCase();
  if (/heartbeat|cron|check-in|health.check/i.test(t)) return 'heartbeats';
  if (/meeting|standup|sync|retro/i.test(t)) return 'meetings';
  if (/task|todo|action.item|deadline/i.test(t)) return 'tasks';
  if (/decision|decided|chose|approved/i.test(t)) return 'decisions';
  if (/learn|til|insight|discovery/i.test(t)) return 'learnings';
  if (/note|capture|remember|memo/i.test(t)) return 'notes';
  return 'other';
}

function getMemoryTimeline(query) {
  const memDir = path.join(DATA, 'memory');
  const memoryMd = safeRead(path.join(DATA, 'MEMORY.md')) || '';
  const files = safeLs(memDir).filter(f => f.endsWith('.md')).sort((a, b) => b.localeCompare(a));
  const q = (query || '').toLowerCase();

  const timeline = [];
  let totalEntries = 0;
  let totalBytes = 0;
  const categories = {};

  for (const f of files) {
    const date = f.replace('.md', '');
    const content = safeRead(path.join(memDir, f)) || '';
    const size = Buffer.byteLength(content, 'utf8');
    totalBytes += size;

    // Parse entries (### headers)
    const entries = [];
    const lines = content.split('\n');
    let current = null;
    for (const line of lines) {
      if (line.startsWith('### ')) {
        if (current) entries.push(current);
        current = { title: line.slice(4).trim(), body: '', category: '' };
      } else if (current) {
        current.body += line + '\n';
      }
    }
    if (current) entries.push(current);

    // Categorize each entry
    entries.forEach(e => {
      e.category = categorizeEntry(e.title);
      categories[e.category] = (categories[e.category] || 0) + 1;
    });

    totalEntries += entries.length;

    // Filter by search query if present
    let matchedCount = entries.length;
    let matchedEntries = entries;
    if (q) {
      matchedEntries = entries.filter(e =>
        e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q)
      );
      matchedCount = matchedEntries.length;
      if (matchedCount === 0) continue; // Skip days with no matches
    }

    timeline.push({
      date: date,
      entriesCount: entries.length,
      matchedCount: matchedCount,
      entries: matchedEntries.map(e => ({ title: e.title, body: e.body.trim().slice(0, 200), category: e.category })),
      sizeBytes: size
    });
  }

  // Curated MEMORY.md stats
  const curatedLines = memoryMd.split('\n').filter(l => l.trim()).length;

  // Growth rate: entries per day over last 7 days
  const recent7 = timeline.slice(0, 7);
  const recentTotal = recent7.reduce((sum, d) => sum + d.entriesCount, 0);
  const growthRate = recent7.length > 0 ? Math.round((recentTotal / recent7.length) * 10) / 10 : 0;

  return {
    timeline: timeline,
    stats: {
      totalDays: files.length,
      totalEntries: totalEntries,
      totalBytes: totalBytes,
      curatedLines: curatedLines,
      categories: categories,
      growthRate: growthRate
    }
  };
}

function searchMemory(query) {
  if (!query) return { results: [] };
  const q = query.toLowerCase();
  const results = [];

  // Search MEMORY.md
  const memoryMd = safeRead(path.join(DATA, 'MEMORY.md')) || '';
  const mdLines = memoryMd.split('\n');
  mdLines.forEach((line, idx) => {
    if (line.toLowerCase().includes(q)) {
      results.push({ file: 'MEMORY.md', line: idx + 1, text: line.trim().slice(0, 200), type: 'curated' });
    }
  });

  // Search memory/*.md files
  const memDir = path.join(DATA, 'memory');
  const files = safeLs(memDir).filter(f => f.endsWith('.md')).sort((a, b) => b.localeCompare(a));
  for (const f of files) {
    const content = safeRead(path.join(memDir, f)) || '';
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(q)) {
        results.push({ file: 'memory/' + f, line: idx + 1, text: line.trim().slice(0, 200), type: 'daily' });
      }
    });
    if (results.length > 100) break; // Cap results
  }

  return { results: results.slice(0, 100), query: query };
}

function teachMemory(category, fact) {
  const memPath = path.join(DATA, 'MEMORY.md');
  let content = safeRead(memPath) || '# Agent Memory\n';
  const catMap = {
    'Preferences': '## Preferences',
    'Facts': '## Facts',
    'Contacts': '## Contacts',
    'Decisions': '## Decisions'
  };

  const header = catMap[category] || '## ' + category;
  const entry = '\n- ' + fact;

  if (content.includes(header)) {
    // Append after the header section
    const idx = content.indexOf(header);
    const nextSection = content.indexOf('\n## ', idx + header.length);
    if (nextSection > -1) {
      content = content.slice(0, nextSection) + entry + '\n' + content.slice(nextSection);
    } else {
      content += entry + '\n';
    }
  } else {
    // Add new section at end
    content += '\n' + header + '\n' + entry + '\n';
  }

  fs.writeFileSync(memPath, content, 'utf8');
  return { ok: true, category: category };
}

// Watch key directories for changes
var watchDirs = ['memory', 'skills', 'learnings', 'knowledge'];
var watchers = [];

function initFileWatchers() {
  // NOTE: fs.watch({ recursive: true }) is NOT supported on Linux (only macOS/Windows).
  // On Linux/Alpine containers it causes inotify floods that block the event loop.
  // Use non-recursive watch on top-level dirs only.
  for (const dir of watchDirs) {
    const fullDir = path.join(DATA, dir);
    try {
      if (!fs.existsSync(fullDir)) continue;
      const watcher = fs.watch(fullDir, (eventType, filename) => {
        if (!filename || filename.startsWith('.')) return;
        sseDebouncedEmit('file-change', {
          path: dir + '/' + filename,
          type: eventType === 'rename' ? 'created' : 'modified',
          timestamp: new Date().toISOString()
        }, 'file:' + dir + '/' + filename);

        // Special: heartbeat-state.json changed
        if (filename === 'heartbeat-state.json') {
          try {
            const raw = fs.readFileSync(path.join(fullDir, filename), 'utf8');
            const state = JSON.parse(raw);
            const lastCheck = Object.entries(state.lastChecks || {}).find(([k, v]) => v !== null);
            if (lastCheck) {
              sseDebouncedEmit('heartbeat', {
                check: lastCheck[0],
                status: 'ok',
                timestamp: lastCheck[1]
              }, 'heartbeat');
              // Emit notification for heartbeat
              emitNotification('heartbeat', 'Heartbeat: ' + lastCheck[0], 'Check completed at ' + new Date(lastCheck[1] < 1e12 ? lastCheck[1] * 1000 : lastCheck[1]).toLocaleTimeString(), 'cron:heartbeat', { check: lastCheck[0] });
            }
          } catch {}
        }
      });
      watcher.on('error', () => {}); // Prevent unhandled errors from crashing
      watchers.push(watcher);
    } catch {}
  }

  // Watch skill subdirectories for execution detection (auto-detect skill runs)
  var skillExecDebounce = {};
  var skillsDir = path.join(DATA, 'skills');
  try {
    if (fs.existsSync(skillsDir)) {
      var skillDirNames = safeLs(skillsDir).filter(f => {
        try { return fs.statSync(path.join(skillsDir, f)).isDirectory(); } catch { return false; }
      });
      for (var sd of skillDirNames) {
        try {
          var sdPath = path.join(skillsDir, sd);
          var sdWatcher = fs.watch(sdPath, (evt, fname) => {
            if (!fname || fname === 'SKILL.md' || fname.startsWith('.')) return;
            var skillName = sd;
            var now = Date.now();
            if (skillExecDebounce[skillName] && now - skillExecDebounce[skillName] < 60000) return;
            skillExecDebounce[skillName] = now;
            logSkillExecution(skillName, 'success', 0, 'auto-detected', 'File changed: ' + fname);
          });
          sdWatcher.on('error', () => {});
          watchers.push(sdWatcher);
        } catch {}
      }
    }
  } catch {}

  // Watch gateway status changes (port 3000 availability)
  var lastGatewayState = null;
  setInterval(() => {
    const sock = new net.Socket();
    let done = false;
    sock.setTimeout(2000);
    sock.once('connect', () => {
      if (done) return;
      done = true;
      sock.destroy();
      if (lastGatewayState !== true) {
        lastGatewayState = true;
        sseDebouncedEmit('gateway-status', { running: true }, 'gateway');
        emitNotification('gateway', 'Gateway Online', 'OpenClaw gateway is running', 'system:gateway');
      }
    });
    sock.once('error', () => {
      if (done) return;
      done = true;
      sock.destroy();
      if (lastGatewayState !== false) {
        lastGatewayState = false;
        sseDebouncedEmit('gateway-status', { running: false }, 'gateway');
        emitNotification('gateway', 'Gateway Offline', 'OpenClaw gateway stopped responding', 'system:gateway');
      }
    });
    sock.once('timeout', () => {
      if (done) return;
      done = true;
      sock.destroy();
    });
    sock.connect(3000, '127.0.0.1');
  }, 15000);
}

// Initialize watchers after server starts (delay to let boot complete)
setTimeout(initFileWatchers, 5000);

// ══════════════════════════════════════════════════════════════════════
// Phase 11: Structured Task Management — JSON-backed CRUD
// ══════════════════════════════════════════════════════════════════════

var TASKS_FILE = path.join(DATA, '.tasks.json');
var TASKS_MIGRATED = false;

function readTasks() {
  var raw = safeRead(TASKS_FILE);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  // First load — try migrating from USER.md
  if (!TASKS_MIGRATED) {
    TASKS_MIGRATED = true;
    return migrateUserMdTasks();
  }
  return { tasks: [], projects: [], labels: ['design','frontend','research','bug','feature','content','ops'] };
}

function writeTasks(data) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
}

function migrateUserMdTasks() {
  var data = { tasks: [], projects: [], labels: ['design','frontend','research','bug','feature','content','ops'] };
  var userMd = safeRead(path.join(DATA, 'USER.md')) || '';
  var projMatch = userMd.match(/##\s*Active Projects\s*\n([\s\S]*?)(?=\n##|\n---|\s*$)/i);
  if (projMatch) {
    var lines = projMatch[1].split('\n');
    for (var i = 0; i < lines.length; i++) {
      var row = lines[i].match(/\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
      if (row && !row[1].trim().startsWith('---') && !row[1].trim().toLowerCase().startsWith('project')) {
        var proj = row[1].trim();
        var stat = row[2].trim().toLowerCase();
        var next = row[3].trim();
        if (/^\[.*\]$/.test(proj) || /^\[.*\]$/.test(next)) continue;
        var mappedStatus = 'todo';
        if (/active|in.?progress|working/i.test(stat)) mappedStatus = 'in_progress';
        else if (/done|complete|finished/i.test(stat)) mappedStatus = 'done';
        else if (/review|waiting/i.test(stat)) mappedStatus = 'review';
        else if (/paused|blocked/i.test(stat)) mappedStatus = 'backlog';
        var now = new Date().toISOString();
        data.tasks.push({
          id: 'tsk_' + crypto.randomBytes(6).toString('hex'),
          title: proj,
          description: next !== 'TBD' ? next : '',
          status: mappedStatus,
          priority: 'medium',
          assignee: 'human',
          project: '',
          dueDate: '',
          labels: [],
          createdAt: now,
          updatedAt: now,
          completedAt: mappedStatus === 'done' ? now : null,
          parentId: null,
          blockedBy: [],
          notes: ''
        });
      }
    }
  }
  if (data.tasks.length > 0) writeTasks(data);
  return data;
}

function generateTaskId() {
  return 'tsk_' + crypto.randomBytes(6).toString('hex');
}

function generateProjectId() {
  return 'prj_' + crypto.randomBytes(6).toString('hex');
}

function generateSubtaskId() {
  return 'sub_' + crypto.randomBytes(4).toString('hex');
}

function json(res, data, status) {
  cors(res);
  res.writeHead(status || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // JWT Auth validation endpoint (called by nginx auth_request)
  if (pathname === '/auth/validate' && (req.method === 'GET' || req.method === 'HEAD')) {
    // Token resolution order:
    // 1. Cookie: hubify_ws_token (browser sets this after login)
    // 2. X-Workspace-Token header (nginx forwards cookie value here)
    // 3. Authorization: Bearer <token> header
    // 4. ?token= query param (fallback for direct testing)
    const cookieHeader = req.headers['cookie'] || '';
    const cookieMatch = cookieHeader.match(/hubify_ws_token=([^;]+)/);
    const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';

    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const token = cookieToken
      || req.headers['x-workspace-token']
      || bearerToken
      || url.searchParams.get('token')
      || '';

    // Verify username matches this workspace (prevents token cross-use between workspaces)
    const expectedUsername = process.env.HUBIFY_USERNAME;

    // SECURITY: HUBIFY_USERNAME must be set — if not, this workspace is misconfigured.
    // Reject all auth requests with 500 to avoid silently accepting any valid JWT.
    if (!expectedUsername) {
      cors(res);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'workspace misconfigured: HUBIFY_USERNAME not set' }));
      return;
    }

    const result = validateWorkspaceJwt(token);
    if (result.valid) {
      // Extra check: token must be for this workspace's user (always enforced)
      if (result.payload.username !== expectedUsername) {
        cors(res);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'wrong workspace' }));
        return;
      }
      cors(res);
      res.setHeader('X-Auth-Username', result.payload.username || '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, username: result.payload.username }));
    } else {
      cors(res);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: result.error }));
    }
    return;
  }

  // ── First-boot detection ──
  if (pathname === '/first-boot' && req.method === 'GET') {
    const isFirstBoot = fs.existsSync(path.join(DATA, '.first-boot-message'))
      && !fs.existsSync(path.join(DATA, '.onboarded'));
    return json(res, { firstBoot: isFirstBoot });
  }

  // ── Mark onboarding complete ──
  if (pathname === '/mark-onboarded' && req.method === 'POST') {
    try {
      fs.writeFileSync(path.join(DATA, '.onboarded'), Date.now().toString());
    } catch {}
    return json(res, { ok: true });
  }

  // ── Skip individual onboarding step ──
  if (pathname === '/skip-step' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { key } = JSON.parse(body);
        if (!key) return json(res, { error: 'missing key' }, 400);
        const skippedPath = path.join(DATA, '.onboard-skipped.json');
        let skipped = {};
        try { skipped = JSON.parse(fs.readFileSync(skippedPath, 'utf8')); } catch {}
        skipped[key] = { skippedAt: Date.now() };
        try { fs.writeFileSync(skippedPath, JSON.stringify(skipped, null, 2)); } catch {}
        return json(res, getOnboardingStatus());
      } catch { return json(res, { error: 'invalid body' }, 400); }
    });
    return;
  }

  if (pathname === '/stats' && req.method === 'GET') {
    // Validate JWT before serving stats
    const cookieHeader = req.headers['cookie'] || '';
    const cookieMatch = cookieHeader.match(/hubify_ws_token=([^;]+)/);
    const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';

    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const token = cookieToken
      || req.headers['x-workspace-token']
      || bearerToken
      || url.searchParams.get('token')
      || '';

    const expectedUsername = process.env.HUBIFY_USERNAME;

    const result = validateWorkspaceJwt(token);
    if (!result.valid) {
      cors(res);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: result.error }));
      return;
    }

    // Extra check: token must be for this workspace's user
    if (expectedUsername && result.payload.username !== expectedUsername) {
      cors(res);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'wrong workspace' }));
      return;
    }

    return json(res, getStats());
  }

  if (pathname === '/files' && req.method === 'GET') {
    const p = url.searchParams.get('path') || '';
    return json(res, listFiles(p));
  }

  if (pathname === '/files/content' && req.method === 'GET') {
    const p = url.searchParams.get('path') || '';
    return json(res, fileContent(p));
  }

  if (pathname === '/skills-list' && req.method === 'GET') {
    return json(res, listSkills());
  }

  if (pathname === '/integrations' && req.method === 'GET') {
    return json(res, getIntegrations());
  }

  if (pathname === '/gateway-restart' && req.method === 'POST') {
    // Gateway is PID 1 (exec in boot.sh), so killing it restarts the container.
    // Fly auto-restart re-runs boot.sh which starts gateway with correct --bind lan.
    // Send response first, then kill after a short delay so the client gets the 200.
    json(res, { ok: true, message: 'Container restarting (gateway is PID 1)' });
    setTimeout(() => {
      exec('pkill -f "openclaw gateway" || true');
    }, 200);
    return;
  }

  // ── Gateway token (for Control UI auth) ──
  if (pathname === '/gateway-token' && req.method === 'GET') {
    // Read the gateway auth credential from openclaw.json (supports token + password modes)
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'openclaw.json'), 'utf8'));
      const auth = cfg.gateway && cfg.gateway.auth;
      const mode = auth && auth.mode || 'token';
      const credential = auth && (auth.password || auth.token);
      if (credential) return json(res, { token: credential, mode: mode });
      return json(res, { error: 'no auth configured' }, 404);
    } catch (e) {
      return json(res, { error: 'failed to read config' }, 500);
    }
  }

  if (pathname === '/gateway-status' && req.method === 'GET') {
    const sock = new net.Socket();
    let responded = false;
    sock.setTimeout(1500);
    sock.once('connect', () => {
      responded = true;
      sock.destroy();
      json(res, { running: true });
    });
    sock.once('error', () => {
      if (!responded) { responded = true; json(res, { running: false }); }
    });
    sock.once('timeout', () => {
      if (!responded) { responded = true; sock.destroy(); json(res, { running: false }); }
    });
    sock.connect(3000, '127.0.0.1');
    return;
  }

  if (pathname === '/install-skill' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        if (!name || !/^[a-z0-9-]+$/.test(name)) return json(res, { ok: false, error: 'invalid name' }, 400);
        exec(`cd /data && clawhub install ${name}`, { timeout: 30000 }, (err, stdout, stderr) => {
          if (err) {
            // Fallback: check /opt/defaults/skills/ and /opt/templates/*/skills/ for local copy
            const localPaths = [
              path.join('/opt/defaults/skills', name),
              ...safeLs('/opt/templates').map(t => path.join('/opt/templates', t, 'skills', name))
            ];
            for (const src of localPaths) {
              try {
                if (fs.statSync(src).isDirectory()) {
                  const dest = path.join(DATA, 'skills', name);
                  fs.mkdirSync(dest, { recursive: true });
                  // Copy skill files
                  safeLs(src).forEach(f => {
                    const content = safeRead(path.join(src, f));
                    if (content !== null) fs.writeFileSync(path.join(dest, f), content);
                  });
                  return json(res, { ok: true, output: 'Installed from local template' });
                }
              } catch {}
            }
            return json(res, { ok: false, error: stderr || err.message }, 500);
          }
          return json(res, { ok: true, output: stdout });
        });
      } catch (e) {
        return json(res, { ok: false, error: 'bad request' }, 400);
      }
    });
    return;
  }

  // ── Skill catalog ──
  if (pathname === '/skill-catalog' && req.method === 'GET') {
    const catalog = getSkillCatalog();
    const installed = listSkills().map(s => s.name);
    catalog.forEach(s => { s.installed = installed.includes(s.name); });
    return json(res, catalog);
  }

  // ── Write file ──
  if (pathname === '/files/write' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { path: filePath, content } = JSON.parse(body);
        if (!filePath || typeof content !== 'string') return json(res, { ok: false, error: 'missing path or content' }, 400);
        const target = path.resolve(path.join(DATA, filePath));
        const allowed = path.resolve(DATA);
        if (!target.startsWith(allowed + '/')) return json(res, { ok: false, error: 'forbidden: path traversal' }, 403);
        const filename = path.basename(target);
        if (isBlocked(filename)) return json(res, { ok: false, error: 'forbidden: sensitive file' }, 403);
        // Ensure parent directory exists (auto-create)
        const dir = path.dirname(target);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, content, 'utf8');
        return json(res, { ok: true });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ── Configure integration ──
  if (pathname === '/integrations/configure' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { id, envVar, value } = JSON.parse(body);
        if (!id || !envVar || typeof value !== 'string') return json(res, { ok: false, error: 'missing fields' }, 400);
        // Validate envVar is one of our known integration env vars
        const validVars = ['GITHUB_TOKEN','SLACK_TOKEN','GOOGLE_CLIENT_ID','NOTION_API_KEY','STRAVA_ACCESS_TOKEN','TWITTER_API_KEY','ANTHROPIC_API_KEY','OPENAI_API_KEY'];
        if (!validVars.includes(envVar)) return json(res, { ok: false, error: 'invalid env var' }, 400);
        const cfgPath = path.join(DATA, 'openclaw.json');
        let cfg = {};
        try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
        if (!cfg.env) cfg.env = {};
        if (value) {
          cfg.env[envVar] = value;
        } else {
          delete cfg.env[envVar];
        }
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
        return json(res, { ok: true });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ── (Removed POST /login endpoint — auth now entirely via Clerk JWT cookie) ──

  // ══════════════════════════════════════════════════════════════════════
  // SmartSync — Template Versioning & Live Update Endpoints
  // ══════════════════════════════════════════════════════════════════════

  if (pathname === '/smartsync/check' && req.method === 'GET') {
    smartsyncCheck(res);
    return;
  }

  if (pathname === '/smartsync/apply' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => smartsyncApply(body, res));
    return;
  }

  if (pathname === '/smartsync/status' && req.method === 'GET') {
    const versionFile = path.join(DATA, '.smartsync', 'version.json');
    const raw = safeRead(versionFile);
    if (raw) {
      try { return json(res, JSON.parse(raw)); } catch {}
    }
    return json(res, { version: '1.0.0', neverSynced: true });
  }

  // SmartSync: Per-file manifest with local comparison
  if (pathname === '/smartsync/manifest' && req.method === 'GET') {
    const version = url.searchParams.get('version');
    if (!version) return json(res, { error: 'version query param required' }, 400);
    const slug = smartsyncGetTemplateSlug();
    const manifestUrl = `https://hubify.com/api/templates/version-files?template=${encodeURIComponent(slug)}&version=${encodeURIComponent(version)}`;
    httpsGet(manifestUrl).then(data => {
      if (data.error) return json(res, { error: data.error }, 502);
      let manifest;
      try { manifest = JSON.parse(data.manifest); } catch { return json(res, { error: 'bad manifest' }, 502); }
      const files = [];
      for (const f of (manifest.files || [])) {
        const localPath = path.join(DATA, f.path);
        const localExists = fs.existsSync(localPath);
        let localHash = null;
        if (localExists) {
          try { localHash = crypto.createHash('sha256').update(fs.readFileSync(localPath)).digest('hex'); } catch {}
        }
        // Check originals for three-way merge
        const origPath = path.join(DATA, '.smartsync', 'originals', f.path);
        const origExists = fs.existsSync(origPath);
        let origHash = null;
        if (origExists) {
          try { origHash = crypto.createHash('sha256').update(fs.readFileSync(origPath)).digest('hex'); } catch {}
        }
        let status = 'unchanged';
        let conflict = false;
        if (!localExists) {
          status = 'added';
        } else if (localHash !== f.hash) {
          status = 'modified';
          // Three-way conflict detection
          if (origHash && origHash !== localHash && origHash !== f.hash) {
            conflict = true; // user changed AND template changed
          } else if (origHash && origHash !== localHash && origHash === f.hash) {
            status = 'user-only'; // only user changed, template didn't — skip
          }
        }
        files.push({
          path: f.path, size: f.size, hash: f.hash, type: 'template',
          status, conflict, localHash, origHash,
        });
      }
      for (const f of (manifest.dashboardFiles || [])) {
        files.push({
          path: f.path, size: f.size, hash: f.hash, type: 'dashboard',
          status: 'modified', conflict: false, localHash: null, origHash: null,
        });
      }
      json(res, { version: data.version, changelog: data.changelog, files });
    }).catch(err => {
      json(res, { error: err.message }, 502);
    });
    return;
  }

  // SmartSync: Get local file hash for comparison
  if (pathname === '/smartsync/local-hash' && req.method === 'GET') {
    const filePath = url.searchParams.get('path');
    if (!filePath) return json(res, { error: 'path query param required' }, 400);
    const target = path.resolve(path.join(DATA, filePath));
    if (!target.startsWith(path.resolve(DATA))) return json(res, { error: 'forbidden' }, 403);
    if (!fs.existsSync(target)) return json(res, { hash: null, exists: false });
    try {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
      const size = fs.statSync(target).size;
      return json(res, { hash, size, exists: true });
    } catch (e) {
      return json(res, { error: e.message }, 500);
    }
  }

  // SmartSync: Get local file content for diff preview
  if (pathname === '/smartsync/local-content' && req.method === 'GET') {
    const filePath = url.searchParams.get('path');
    if (!filePath) return json(res, { error: 'path query param required' }, 400);
    const target = path.resolve(path.join(DATA, filePath));
    if (!target.startsWith(path.resolve(DATA))) return json(res, { error: 'forbidden' }, 403);
    if (!fs.existsSync(target)) return json(res, { content: null, exists: false });
    try {
      const content = fs.readFileSync(target, 'utf8');
      return json(res, { content, exists: true });
    } catch (e) {
      return json(res, { error: e.message }, 500);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Git Sync — Push/pull workspace templates to a GitHub repo
  // ══════════════════════════════════════════════════════════════════════

  if (pathname === '/git/status' && req.method === 'GET') {
    const gitDir = path.join(DATA, '.git');
    const initialized = fs.existsSync(gitDir);
    const token = getGitHubToken();
    const state = getGitSyncState();

    if (!initialized) {
      return json(res, { initialized: false, hasToken: !!token });
    }

    (async () => {
      try {
        let remote = '';
        try { remote = await gitExec('git remote get-url origin'); } catch {}
        // Strip token from remote URL before returning
        const safeRemote = remote.replace(/x-access-token:[^@]+@/, '');

        let branch = '';
        try { branch = await gitExec('git rev-parse --abbrev-ref HEAD'); } catch {}

        let dirty = '';
        try { dirty = await gitExec('git status --porcelain'); } catch {}
        const dirtyFiles = dirty ? dirty.split('\n').filter(l => l.trim()).length : 0;

        return json(res, {
          initialized: true,
          remote: safeRemote,
          branch: branch || 'main',
          dirtyFiles,
          lastSyncAt: state.lastSyncAt || null,
          lastSyncType: state.lastSyncType || null,
          hasToken: !!token,
        });
      } catch (e) {
        return json(res, { initialized: true, error: e.message, hasToken: !!token });
      }
    })();
    return;
  }

  if (pathname === '/git/init' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      (async () => {
        try {
          const { repoUrl, branch } = JSON.parse(body);
          if (!repoUrl || !repoUrl.startsWith('https://github.com/')) {
            return json(res, { ok: false, error: 'Invalid repo URL — must start with https://github.com/' }, 400);
          }
          const branchName = branch || 'main';
          const token = getGitHubToken();
          if (!token) {
            return json(res, { ok: false, error: 'No GITHUB_TOKEN configured. Add it in Integrations first.' }, 400);
          }
          const authUrl = gitRemoteUrl(repoUrl, token);

          // Write .gitignore
          fs.writeFileSync(path.join(DATA, '.gitignore'), GIT_IGNORE_CONTENT);

          // Init repo if needed
          const gitDir = path.join(DATA, '.git');
          if (!fs.existsSync(gitDir)) {
            await gitExec('git init');
            await gitExec('git config user.email "agent@hubify.com"');
            await gitExec('git config user.name "Hubify Agent"');
          }

          // Set remote (update if exists)
          try { await gitExec('git remote remove origin'); } catch {}
          await gitExec(`git remote add origin ${authUrl}`);

          // Try to fetch — if remote has commits, merge them
          let hasRemote = false;
          try {
            await gitExec(`git fetch origin ${branchName}`);
            hasRemote = true;
          } catch {}

          if (hasRemote) {
            // Merge remote into local (allow unrelated histories for first sync)
            try {
              await gitExec(`git checkout -B ${branchName}`);
              await gitExec(`git merge origin/${branchName} --allow-unrelated-histories -m "Hubify: merge remote"`);
            } catch (e) {
              // Merge conflict — still initialized, user can resolve
              saveGitSyncState({ lastSyncAt: Date.now(), lastSyncType: 'init', repoUrl, branch: branchName });
              return json(res, { ok: true, merged: false, conflict: true, message: 'Initialized with merge conflicts. Resolve in terminal.' });
            }
          } else {
            // Empty remote — do initial commit and push
            await gitExec(`git checkout -B ${branchName}`);
            await gitExec('git add -A');
            try {
              await gitExec('git commit -m "Initial Hubify workspace sync"');
            } catch {} // Nothing to commit is ok
            await gitExec(`git push -u origin ${branchName}`);
          }

          saveGitSyncState({ lastSyncAt: Date.now(), lastSyncType: 'init', repoUrl, branch: branchName });
          return json(res, { ok: true, merged: hasRemote, branch: branchName });
        } catch (e) {
          return json(res, { ok: false, error: e.message }, 500);
        }
      })();
    });
    return;
  }

  if (pathname === '/git/push' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      (async () => {
        try {
          let payload = {};
          try { payload = JSON.parse(body); } catch {}
          const message = payload.message || `Hubify sync ${new Date().toISOString().slice(0, 16)}`;

          const token = getGitHubToken();
          if (!token) return json(res, { ok: false, error: 'No GITHUB_TOKEN configured' }, 400);

          // Ensure .gitignore is current
          fs.writeFileSync(path.join(DATA, '.gitignore'), GIT_IGNORE_CONTENT);

          // Update remote URL with current token (handles token rotation)
          const state = getGitSyncState();
          if (state.repoUrl) {
            try { await gitExec('git remote remove origin'); } catch {}
            await gitExec(`git remote add origin ${gitRemoteUrl(state.repoUrl, token)}`);
          }

          await gitExec('git add -A');

          // Check if there's anything to commit
          let status = '';
          try { status = await gitExec('git status --porcelain'); } catch {}
          if (!status.trim()) {
            return json(res, { ok: true, pushed: false, message: 'No changes to push' });
          }

          await gitExec(`git commit -m "${message.replace(/"/g, '\\"')}"`);

          const branch = state.branch || 'main';
          await gitExec(`git push origin ${branch}`);

          saveGitSyncState({ ...state, lastSyncAt: Date.now(), lastSyncType: 'push' });
          return json(res, { ok: true, pushed: true });
        } catch (e) {
          return json(res, { ok: false, error: e.message }, 500);
        }
      })();
    });
    return;
  }

  if (pathname === '/git/pull' && req.method === 'POST') {
    (async () => {
      try {
        const token = getGitHubToken();
        if (!token) return json(res, { ok: false, error: 'No GITHUB_TOKEN configured' }, 400);

        const state = getGitSyncState();
        if (state.repoUrl) {
          try { await gitExec('git remote remove origin'); } catch {}
          await gitExec(`git remote add origin ${gitRemoteUrl(state.repoUrl, token)}`);
        }

        const branch = state.branch || 'main';

        // Stash local changes
        let hadStash = false;
        try {
          const stashOut = await gitExec('git stash');
          hadStash = !stashOut.includes('No local changes');
        } catch {}

        await gitExec(`git pull origin ${branch}`);

        // Pop stash if we had one
        let stashConflict = false;
        if (hadStash) {
          try {
            await gitExec('git stash pop');
          } catch {
            stashConflict = true;
          }
        }

        saveGitSyncState({ ...state, lastSyncAt: Date.now(), lastSyncType: 'pull' });
        return json(res, { ok: true, stashConflict });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    })();
    return;
  }

  if (pathname === '/git/diff' && req.method === 'GET') {
    (async () => {
      try {
        const state = getGitSyncState();
        const token = getGitHubToken();
        if (state.repoUrl && token) {
          try { await gitExec('git remote remove origin'); } catch {}
          await gitExec(`git remote add origin ${gitRemoteUrl(state.repoUrl, token)}`);
        }

        const branch = state.branch || 'main';
        await gitExec(`git fetch origin ${branch}`);

        let diff = '';
        try { diff = await gitExec(`git diff HEAD..origin/${branch} --stat`); } catch {}

        return json(res, { ok: true, diff: diff || 'No differences', branch });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    })();
    return;
  }

  // ── Local Git Commit (no GitHub token needed) ──
  if (pathname === '/git/local-commit' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      (async () => {
        try {
          var payload = JSON.parse(body);
          var message = payload.message || 'Auto-commit';

          // Auto-init git if .git missing (handles existing machines)
          if (!fs.existsSync(path.join(DATA, '.git'))) {
            await gitExec('git init');
            await gitExec('git config user.email "agent@hubify.com"');
            await gitExec('git config user.name "Hubify Agent"');
            // Write local .gitignore if missing
            if (!fs.existsSync(path.join(DATA, '.gitignore'))) {
              fs.writeFileSync(path.join(DATA, '.gitignore'), [
                'openclaw.json', '.workspace-password', '.created_at', '.onboarded',
                '.first-boot-message', '.smartsync/', '.git-sync/', '*.log', '.env*',
                'node_modules/', 'backups/', 'agents/main/agent/'
              ].join('\n') + '\n');
            }
          }

          await gitExec('git add -A');

          // Check if there are changes to commit
          var statusOut = '';
          try { statusOut = await gitExec('git status --porcelain'); } catch {}
          if (!statusOut.trim()) {
            return json(res, { ok: true, noChanges: true, message: 'Nothing to commit' });
          }

          var result = await gitExec('git commit -m "' + message.replace(/"/g, '\\"') + '"');
          var sha = await gitExec('git rev-parse HEAD');
          var shortSha = await gitExec('git rev-parse --short HEAD');

          // Count files changed
          var filesChanged = 0;
          try {
            var numstat = await gitExec('git diff HEAD~1 --numstat');
            filesChanged = numstat.split('\n').filter(Boolean).length;
          } catch { filesChanged = 1; }

          var timestamp = Date.now();

          // Fire-and-forget: record commit to Convex
          var convexUrl = process.env.CONVEX_URL || 'https://judicious-dinosaur-987.convex.cloud';
          var hubId = process.env.HUB_ID || 'unknown';
          try {
            var commitType = message.startsWith('Auto-commit') ? 'auto' : 'manual';
            if (message.startsWith('Initial workspace')) commitType = 'initial';
            https.request(convexUrl + '/api/mutation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }, () => {}).on('error', () => {}).end(JSON.stringify({
              path: 'workspaceCommits:recordCommit',
              args: {
                hub_id: hubId, sha: sha, short_sha: shortSha,
                message: message, author: 'Hubify Agent',
                files_changed: filesChanged, commit_type: commitType,
                timestamp: timestamp,
              }
            }));
          } catch {}

          return json(res, {
            ok: true, sha: sha, shortSha: shortSha,
            message: message, timestamp: timestamp,
            filesChanged: filesChanged,
          });
        } catch (e) {
          return json(res, { ok: false, error: e.message }, 500);
        }
      })();
    });
    return;
  }

  // ── Git Log (paginated commit history) ──
  if (pathname === '/git/log' && req.method === 'GET') {
    (async () => {
      try {
        if (!fs.existsSync(path.join(DATA, '.git'))) {
          return json(res, { ok: true, commits: [], message: 'No git repo' });
        }

        var url = new URL(req.url, 'http://localhost');
        var limit = parseInt(url.searchParams.get('limit') || '20', 10);
        var offset = parseInt(url.searchParams.get('offset') || '0', 10);

        var logOut = await gitExec(
          'git log --pretty=format:"%H|%h|%s|%an|%at" --skip=' + offset + ' -n ' + limit
        );

        var commits = logOut.split('\n').filter(Boolean).map(function(line) {
          var parts = line.replace(/^"|"$/g, '').split('|');
          return {
            sha: parts[0], shortSha: parts[1], message: parts[2],
            author: parts[3], timestamp: parseInt(parts[4], 10) * 1000,
          };
        });

        return json(res, { ok: true, commits: commits });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    })();
    return;
  }

  // ── Git Rollback (safe — creates new commit, no history rewrite) ──
  if (pathname === '/git/rollback' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      (async () => {
        try {
          var payload = JSON.parse(body);
          var targetSha = payload.sha;
          if (!targetSha) return json(res, { ok: false, error: 'Missing sha' }, 400);

          // Validate SHA is a real commit
          var objType = await gitExec('git cat-file -t ' + targetSha);
          if (objType.trim() !== 'commit') {
            return json(res, { ok: false, error: 'Invalid commit SHA' }, 400);
          }

          var shortTarget = await gitExec('git rev-parse --short ' + targetSha);

          // Checkout files from target commit (not HEAD) and create new commit
          await gitExec('git checkout ' + targetSha + ' -- .');
          await gitExec('git add -A');
          var commitMsg = 'Rollback to ' + shortTarget.trim();
          await gitExec('git commit -m "' + commitMsg + '" --allow-empty');

          var newSha = await gitExec('git rev-parse HEAD');
          var newShortSha = await gitExec('git rev-parse --short HEAD');

          // Fire-and-forget: record rollback to Convex
          var convexUrl = process.env.CONVEX_URL || 'https://judicious-dinosaur-987.convex.cloud';
          var hubId = process.env.HUB_ID || 'unknown';
          try {
            https.request(convexUrl + '/api/mutation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }, () => {}).on('error', () => {}).end(JSON.stringify({
              path: 'workspaceCommits:recordCommit',
              args: {
                hub_id: hubId, sha: newSha, short_sha: newShortSha,
                message: commitMsg, author: 'Hubify Agent',
                files_changed: 0, commit_type: 'rollback',
                timestamp: Date.now(),
              }
            }));
          } catch {}

          return json(res, {
            ok: true, newSha: newSha, newShortSha: newShortSha,
            rolledBackTo: shortTarget.trim(),
          });
        } catch (e) {
          return json(res, { ok: false, error: e.message }, 500);
        }
      })();
    });
    return;
  }

  // ── Export Workspace as Template ──
  if (pathname === '/workspace/export-template' && req.method === 'POST') {
    (async () => {
      try {
        // Privacy deny-list — NEVER include these
        var denyList = [
          'memory/', 'learnings/', 'USER.md', 'MEMORY.md', 'agents/main/agent/',
          'openclaw.json', '.workspace-password', 'backups/', '.git/', '.git-sync/',
          'knowledge/squads/', 'knowledge/subscriptions/', 'cron/jobs.json',
          '.created_at', '.onboarded', '.first-boot-message', '.smartsync/',
          '.welcomed', '.first-boot-done', 'stats.log', 'ttyd.log',
        ];

        function isDenied(relPath) {
          for (var i = 0; i < denyList.length; i++) {
            if (relPath === denyList[i] || relPath.startsWith(denyList[i])) return true;
          }
          if (/\.log$/.test(relPath) || /\.env/.test(relPath)) return true;
          return false;
        }

        // Walk /data recursively (max depth 5)
        function walkDir(dir, base, depth) {
          if (depth > 5) return [];
          var results = [];
          var entries;
          try { entries = fs.readdirSync(dir); } catch { return []; }
          for (var i = 0; i < entries.length; i++) {
            var name = entries[i];
            var fullPath = path.join(dir, name);
            var relPath = base ? base + '/' + name : name;
            if (isDenied(relPath)) continue;
            var stat;
            try { stat = fs.statSync(fullPath); } catch { continue; }
            if (stat.isDirectory()) {
              results = results.concat(walkDir(fullPath, relPath, depth + 1));
            } else if (stat.isFile() && stat.size < 1024 * 100) { // Max 100KB per file
              var content = safeRead(fullPath);
              if (content !== null) {
                var hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
                results.push({ path: relPath, hash: hash, content: content, size: stat.size });
              }
            }
          }
          return results;
        }

        var files = walkDir(DATA, '', 0);

        // Sanitize HUB.yaml: replace username/hub_id with placeholders
        var username = process.env.HUBIFY_USERNAME || '';
        var hubId = process.env.HUB_ID || '';
        for (var i = 0; i < files.length; i++) {
          if (files[i].path === 'HUB.yaml' || files[i].path === 'SOUL.md') {
            if (username) {
              files[i].content = files[i].content.replace(new RegExp(username, 'g'), '{{USERNAME}}');
            }
            if (hubId) {
              files[i].content = files[i].content.replace(new RegExp(hubId, 'g'), '{{HUB_ID}}');
            }
          }
        }

        // Extract metadata from HUB.yaml
        var hubYaml = files.find(function(f) { return f.path === 'HUB.yaml'; });
        var templateName = '';
        var description = '';
        var tags = [];
        if (hubYaml) {
          var nameMatch = hubYaml.content.match(/name:\s*"?([^"\n]+)/);
          if (nameMatch) templateName = nameMatch[1].trim();
          var descMatch = hubYaml.content.match(/description:\s*"?([^"\n]+)/);
          if (descMatch) description = descMatch[1].trim();
          var tagMatch = hubYaml.content.match(/tags:\s*\[([^\]]*)\]/);
          if (tagMatch) tags = tagMatch[1].split(',').map(function(t) { return t.trim().replace(/"/g, ''); }).filter(Boolean);
        }

        // List skills
        var skillFiles = files.filter(function(f) { return f.path.startsWith('skills/') && f.path.endsWith('.md'); });
        var skills = skillFiles.map(function(f) { return f.path.replace('skills/', '').replace('.md', ''); });

        return json(res, {
          ok: true,
          manifest: {
            files: files,
            metadata: {
              template: templateName, description: description,
              tags: tags, skills: skills,
              exportedAt: Date.now(),
              fileCount: files.length,
              totalSize: files.reduce(function(sum, f) { return sum + f.size; }, 0),
            },
          },
        });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    })();
    return;
  }

  // ── Template Config ──
  if (pathname === '/template-config' && req.method === 'GET') {
    return json(res, getTemplateConfig());
  }

  // ── Agent Self-Awareness ──
  if (pathname === '/self' && req.method === 'GET') {
    return json(res, getSelf());
  }

  // ── Template View Customization (agent-driven) ──
  if (pathname === '/template-view' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        var payload = JSON.parse(body);
        var existing = getTemplateViewOverride() || {};
        var allowed = ['agentName', 'monogram', 'accent', 'accentDim', 'name', 'nav', 'navAppend'];
        for (var key of allowed) {
          if (payload[key] !== undefined) existing[key] = payload[key];
        }
        saveTemplateViewOverride(existing);
        // Broadcast SSE so dashboard auto-refreshes
        sseEmit('template-updated', { updatedFields: Object.keys(payload), timestamp: new Date().toISOString() });
        return json(res, { ok: true, view: getTemplateConfig().view });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ── Template View (GET — read current override) ──
  if (pathname === '/template-view' && req.method === 'GET') {
    return json(res, { override: getTemplateViewOverride(), merged: getTemplateConfig().view });
  }

  // ── Switch Template ──
  if (pathname === '/switch-template' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        var payload = JSON.parse(body);
        if (!payload.template || !TEMPLATE_VIEWS[payload.template]) {
          return json(res, { ok: false, error: 'unknown template' }, 400);
        }
        var hubPath = path.join(DATA, 'HUB.yaml');
        var content = safeRead(hubPath) || '';
        if (/template:\s*"[^"]*"/.test(content)) {
          content = content.replace(/template:\s*"[^"]*"/, 'template: "' + payload.template + '"');
        } else {
          content = 'template: "' + payload.template + '"\n' + content;
        }
        fs.writeFileSync(hubPath, content);
        return json(res, { ok: true, template: payload.template, view: TEMPLATE_VIEWS[payload.template] });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ── Dashboard v2: Context ──
  if (pathname === '/context' && req.method === 'GET') {
    return json(res, getContext());
  }

  // ── Dashboard v2: Onboarding status ──
  if (pathname === '/onboarding-status' && req.method === 'GET') {
    return json(res, getOnboardingStatus());
  }

  // ── Dashboard v2: Agent activity ──
  if (pathname === '/agent-activity' && req.method === 'GET') {
    return json(res, getAgentActivity());
  }

  // ── Heartbeat state ──
  if (pathname === '/heartbeat-state' && req.method === 'GET') {
    return json(res, getHeartbeatState());
  }

  // ── Cron log ──
  if (pathname === '/cron-log' && req.method === 'GET') {
    return json(res, getCronLog());
  }

  // ── Budget / usage ──
  if (pathname === '/budget' && req.method === 'GET') {
    return json(res, getBudget());
  }

  // ── SSE events stream ──
  if (pathname === '/events' && req.method === 'GET') {
    cors(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering for SSE
    });
    // Send initial heartbeat
    res.write('event: connected\ndata: {"status":"ok"}\n\n');
    sseClients.push(res);
    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
      try { res.write(':ping\n\n'); } catch { clearInterval(keepAlive); }
    }, 30000);
    req.on('close', () => {
      clearInterval(keepAlive);
      const idx = sseClients.indexOf(res);
      if (idx > -1) sseClients.splice(idx, 1);
    });
    return;
  }

  // ── Memory append ──
  if (pathname === '/memory/append' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { note } = JSON.parse(body);
        if (!note || typeof note !== 'string') return json(res, { ok: false, error: 'missing note' }, 400);
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5);
        const memDir = path.join(DATA, 'memory');
        fs.mkdirSync(memDir, { recursive: true });
        const memFile = path.join(memDir, `${dateStr}.md`);
        const entry = `\n### ${timeStr} — Quick Note\n${note}\n`;
        fs.appendFileSync(memFile, entry, 'utf8');
        return json(res, { ok: true, file: `memory/${dateStr}.md` });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ── Tasks add (legacy — now writes to .tasks.json) ──
  if (pathname === '/tasks/add' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { project, status, next_action } = JSON.parse(body);
        if (!project) return json(res, { ok: false, error: 'missing project name' }, 400);
        var data = readTasks();
        var now = new Date().toISOString();
        var mappedStatus = 'todo';
        if (/active|in.?progress/i.test(status || '')) mappedStatus = 'in_progress';
        else if (/done|complete/i.test(status || '')) mappedStatus = 'done';
        var task = {
          id: generateTaskId(),
          title: project,
          description: next_action || '',
          status: mappedStatus,
          priority: 'medium',
          assignee: 'human',
          project: '',
          dueDate: '',
          labels: [],
          createdAt: now,
          updatedAt: now,
          completedAt: mappedStatus === 'done' ? now : null,
          parentId: null,
          blockedBy: [],
          notes: ''
        };
        data.tasks.push(task);
        writeTasks(data);
        sseEmit('task-change', { action: 'created', task: task });
        return json(res, { ok: true, task: task });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 11: Task Management CRUD endpoints
  // ══════════════════════════════════════════════════════════════════════

  // GET /tasks — list tasks with filters
  if (pathname === '/tasks' && req.method === 'GET') {
    var data = readTasks();
    var tasks = data.tasks || [];
    // Apply filters
    var fStatus = url.searchParams.get('status');
    var fAssignee = url.searchParams.get('assignee');
    var fProject = url.searchParams.get('project');
    var fPriority = url.searchParams.get('priority');
    var fLabel = url.searchParams.get('label');
    var fUnassigned = url.searchParams.get('unassigned');
    if (fStatus) tasks = tasks.filter(function(t) { return t.status === fStatus; });
    if (fAssignee) tasks = tasks.filter(function(t) { return t.assignee === fAssignee; });
    if (fProject) tasks = tasks.filter(function(t) { return t.project === fProject; });
    if (fPriority) tasks = tasks.filter(function(t) { return t.priority === fPriority; });
    if (fLabel) tasks = tasks.filter(function(t) { return t.labels && t.labels.indexOf(fLabel) > -1; });
    if (fUnassigned === 'true') tasks = tasks.filter(function(t) { return !t.assignee || t.assignee === ''; });
    // Sort
    var sortBy = url.searchParams.get('sort') || 'updatedAt';
    var prioOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (sortBy === 'priority') {
      tasks.sort(function(a, b) { return (prioOrder[a.priority] || 2) - (prioOrder[b.priority] || 2); });
    } else if (sortBy === 'dueDate') {
      tasks.sort(function(a, b) { return (a.dueDate || 'z').localeCompare(b.dueDate || 'z'); });
    } else {
      tasks.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
    }
    // Limit
    var limit = parseInt(url.searchParams.get('limit')) || 200;
    tasks = tasks.slice(0, limit);
    // Status counts
    var all = data.tasks || [];
    var counts = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0 };
    all.forEach(function(t) { if (counts[t.status] !== undefined) counts[t.status]++; });
    return json(res, { tasks: tasks, projects: data.projects || [], labels: data.labels || [], counts: counts });
  }

  // POST /tasks — create task
  if (pathname === '/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        var payload = JSON.parse(body);
        if (!payload.title) return json(res, { error: 'missing title' }, 400);
        var data = readTasks();
        var now = new Date().toISOString();
        var task = {
          id: generateTaskId(),
          title: payload.title,
          description: payload.description || '',
          status: payload.status || 'todo',
          priority: payload.priority || 'medium',
          assignee: payload.assignee || 'human',
          project: payload.project || '',
          dueDate: payload.dueDate || '',
          labels: payload.labels || [],
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          parentId: payload.parentId || null,
          blockedBy: payload.blockedBy || [],
          notes: payload.notes || ''
        };
        data.tasks.push(task);
        writeTasks(data);
        sseEmit('task-change', { action: 'created', task: task });
        return json(res, { ok: true, task: task });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    });
    return;
  }

  // PATCH /tasks/bulk — bulk update tasks
  if (pathname === '/tasks/bulk' && req.method === 'PATCH') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        var payload = JSON.parse(body);
        var ids = payload.ids;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return json(res, { error: 'missing ids array' }, 400);
        var data = readTasks();
        var now = new Date().toISOString();
        var updated = 0;
        data.tasks.forEach(function(t) {
          if (ids.indexOf(t.id) > -1) {
            if (payload.status) {
              t.status = payload.status;
              if (payload.status === 'done' && !t.completedAt) t.completedAt = now;
            }
            if (payload.assignee !== undefined) t.assignee = payload.assignee;
            if (payload.priority) t.priority = payload.priority;
            if (payload.project !== undefined) t.project = payload.project;
            t.updatedAt = now;
            updated++;
          }
        });
        writeTasks(data);
        sseEmit('task-change', { action: 'bulk-updated', ids: ids, updated: updated });
        return json(res, { ok: true, updated: updated });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    });
    return;
  }

  // PATCH /tasks/:id — update single task
  if (req.method === 'PATCH') {
    var taskMatch = pathname.match(/^\/tasks\/(tsk_[a-f0-9]+)$/);
    if (taskMatch) {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          var payload = JSON.parse(body);
          var data = readTasks();
          var task = null;
          for (var i = 0; i < data.tasks.length; i++) {
            if (data.tasks[i].id === taskMatch[1]) { task = data.tasks[i]; break; }
          }
          if (!task) return json(res, { error: 'task not found' }, 404);
          var now = new Date().toISOString();
          if (payload.title !== undefined) task.title = payload.title;
          if (payload.description !== undefined) task.description = payload.description;
          if (payload.status !== undefined) {
            task.status = payload.status;
            if (payload.status === 'done' && !task.completedAt) task.completedAt = now;
            if (payload.status !== 'done') task.completedAt = null;
          }
          if (payload.priority !== undefined) task.priority = payload.priority;
          if (payload.assignee !== undefined) task.assignee = payload.assignee;
          if (payload.project !== undefined) task.project = payload.project;
          if (payload.dueDate !== undefined) task.dueDate = payload.dueDate;
          if (payload.labels !== undefined) task.labels = payload.labels;
          if (payload.parentId !== undefined) task.parentId = payload.parentId;
          if (payload.blockedBy !== undefined) task.blockedBy = payload.blockedBy;
          if (payload.notes !== undefined) task.notes = payload.notes;
          if (payload.subtasks !== undefined) task.subtasks = payload.subtasks;
          task.updatedAt = now;
          writeTasks(data);
          sseEmit('task-change', { action: 'updated', task: task });
          return json(res, { ok: true, task: task });
        } catch (e) {
          return json(res, { error: e.message }, 500);
        }
      });
      return;
    }
  }

  // DELETE /tasks/:id — delete task
  if (req.method === 'DELETE') {
    var delMatch = pathname.match(/^\/tasks\/(tsk_[a-f0-9]+)$/);
    if (delMatch) {
      var data = readTasks();
      var found = false;
      data.tasks = data.tasks.filter(function(t) {
        if (t.id === delMatch[1]) { found = true; return false; }
        return true;
      });
      if (!found) return json(res, { error: 'task not found' }, 404);
      writeTasks(data);
      sseEmit('task-change', { action: 'deleted', taskId: delMatch[1] });
      return json(res, { ok: true });
    }
  }

  // GET /projects — list projects
  if (pathname === '/projects' && req.method === 'GET') {
    var data = readTasks();
    return json(res, { projects: data.projects || [] });
  }

  // POST /projects — create project
  if (pathname === '/projects' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        var payload = JSON.parse(body);
        if (!payload.name) return json(res, { error: 'missing name' }, 400);
        var data = readTasks();
        var project = {
          id: generateProjectId(),
          name: payload.name,
          color: payload.color || '#D4A574',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        if (!data.projects) data.projects = [];
        data.projects.push(project);
        writeTasks(data);
        sseEmit('task-change', { action: 'project-created', project: project });
        return json(res, { ok: true, project: project });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 10: Notification Center endpoints
  // ══════════════════════════════════════════════════════════════════════

  // GET /notifications — read notifications (optional ?unread=true)
  if (pathname === '/notifications' && req.method === 'GET') {
    const data = readNotifications();
    const unreadOnly = url.searchParams.get('unread') === 'true';
    let notifs = data.notifications.filter(n => !n.dismissed);
    if (unreadOnly) notifs = notifs.filter(n => !n.read);
    const unreadCount = data.notifications.filter(n => !n.read && !n.dismissed).length;
    return json(res, { notifications: notifs, unreadCount, preferences: data.preferences });
  }

  // POST /notifications/read — mark as read ({ ids: [...] } or { all: true })
  if (pathname === '/notifications/read' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { ids, all } = JSON.parse(body);
        const data = readNotifications();
        if (all) {
          data.notifications.forEach(n => { n.read = true; });
        } else if (ids && Array.isArray(ids)) {
          data.notifications.forEach(n => { if (ids.includes(n.id)) n.read = true; });
        }
        writeNotifications(data);
        const unreadCount = data.notifications.filter(n => !n.read && !n.dismissed).length;
        sseEmit('notification-read', { unreadCount });
        return json(res, { ok: true, unreadCount });
      } catch { return json(res, { error: 'invalid body' }, 400); }
    });
    return;
  }

  // POST /notifications/dismiss — dismiss ({ id: "ntf_..." })
  if (pathname === '/notifications/dismiss' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        const data = readNotifications();
        data.notifications.forEach(n => { if (n.id === id) { n.dismissed = true; n.read = true; } });
        writeNotifications(data);
        return json(res, { ok: true });
      } catch { return json(res, { error: 'invalid body' }, 400); }
    });
    return;
  }

  // POST /notifications/preferences — update prefs ({ heartbeat: true, ... })
  if (pathname === '/notifications/preferences' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const prefs = JSON.parse(body);
        const data = readNotifications();
        data.preferences = { ...data.preferences, ...prefs };
        writeNotifications(data);
        return json(res, { ok: true, preferences: data.preferences });
      } catch { return json(res, { error: 'invalid body' }, 400); }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 10: Skill Execution Tracking endpoints
  // ══════════════════════════════════════════════════════════════════════

  // GET /skill-executions — read execution log (optional ?limit=50&skill=name)
  if (pathname === '/skill-executions' && req.method === 'GET') {
    const data = readExecLog();
    let execs = data.executions || [];
    const skillFilter = url.searchParams.get('skill');
    if (skillFilter) execs = execs.filter(e => e.skill === skillFilter);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    return json(res, { executions: execs.slice(0, limit), stats: data.stats || {} });
  }

  // GET /skill-executions/:id — single execution detail
  if (req.method === 'GET' && pathname.startsWith('/skill-executions/') && pathname !== '/skill-executions/log') {
    const execId = pathname.split('/').pop();
    const data = readExecLog();
    const exec = (data.executions || []).find(e => e.id === execId);
    if (exec) return json(res, { execution: exec });
    return json(res, { error: 'not found' }, 404);
  }

  // POST /skill-executions/log — log an execution ({ skill, status, duration_ms, summary, trigger })
  if (pathname === '/skill-executions/log' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { skill, status, duration_ms, summary, trigger } = JSON.parse(body);
        if (!skill) return json(res, { error: 'missing skill name' }, 400);
        const exec = logSkillExecution(skill, status || 'success', duration_ms || 0, trigger || 'user', summary || '');
        return json(res, { ok: true, execution: exec });
      } catch { return json(res, { error: 'invalid body' }, 400); }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 10: Memory Viewer endpoints
  // ══════════════════════════════════════════════════════════════════════

  // GET /memory/timeline — timeline of memory entries (optional ?q=search)
  if (pathname === '/memory/timeline' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    return json(res, getMemoryTimeline(q));
  }

  // GET /memory/search — full-text search across memory
  if (pathname === '/memory/search' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    return json(res, searchMemory(q));
  }

  // POST /memory/teach — add structured fact to MEMORY.md
  if (pathname === '/memory/teach' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { category, fact } = JSON.parse(body);
        if (!category || !fact) return json(res, { error: 'missing category or fact' }, 400);
        const result = teachMemory(category, fact);
        return json(res, result);
      } catch { return json(res, { error: 'invalid body' }, 400); }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 10b: File Delete & Rename
  // ══════════════════════════════════════════════════════════════════════

  // POST /files/delete — delete a file by path
  if (pathname === '/files/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { path: filePath } = JSON.parse(body);
        if (!filePath) return json(res, { ok: false, error: 'missing path' }, 400);
        const target = path.resolve(path.join(DATA, filePath));
        const allowed = path.resolve(DATA);
        if (!target.startsWith(allowed + '/')) return json(res, { ok: false, error: 'forbidden: path traversal' }, 403);
        const filename = path.basename(target);
        if (isBlocked(filename)) return json(res, { ok: false, error: 'forbidden: sensitive file' }, 403);
        try {
          const st = fs.statSync(target);
          if (!st.isFile()) return json(res, { ok: false, error: 'not a file' }, 400);
        } catch { return json(res, { ok: false, error: 'file not found' }, 404); }
        fs.unlinkSync(target);
        return json(res, { ok: true });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // POST /files/rename — rename a file ({ path, newName })
  if (pathname === '/files/rename' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { path: filePath, newName } = JSON.parse(body);
        if (!filePath || !newName) return json(res, { ok: false, error: 'missing path or newName' }, 400);
        const target = path.resolve(path.join(DATA, filePath));
        const allowed = path.resolve(DATA);
        if (!target.startsWith(allowed + '/')) return json(res, { ok: false, error: 'forbidden: path traversal' }, 403);
        if (isBlocked(path.basename(target))) return json(res, { ok: false, error: 'forbidden: sensitive file' }, 403);
        if (isBlocked(newName)) return json(res, { ok: false, error: 'forbidden: sensitive target name' }, 403);
        if (newName.includes('/') || newName.includes('..')) return json(res, { ok: false, error: 'invalid new name' }, 400);
        const dir = path.dirname(target);
        const dest = path.resolve(path.join(dir, newName));
        if (!dest.startsWith(allowed + '/')) return json(res, { ok: false, error: 'forbidden: path traversal' }, 403);
        try { fs.statSync(target); } catch { return json(res, { ok: false, error: 'file not found' }, 404); }
        fs.renameSync(target, dest);
        const relPath = path.relative(DATA, dest);
        return json(res, { ok: true, newPath: relPath });
      } catch (e) {
        return json(res, { ok: false, error: e.message }, 500);
      }
    });
    return;
  }

  // ── Health check (public) ──
  if (pathname === '/health' && req.method === 'GET') {
    cors(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 13: Restart agent & clear cache endpoints
  // ══════════════════════════════════════════════════════════════════════

  if (pathname === '/restart-agent' && req.method === 'POST') {
    cors(res);
    exec('supervisorctl restart openclaw 2>/dev/null || pkill -f openclaw || true', (err, stdout) => {
      return json(res, { ok: true, output: stdout || 'restart signal sent' });
    });
    return;
  }

  if (pathname === '/clear-cache' && req.method === 'POST') {
    cors(res);
    // Clear ephemeral data — temp files, old logs
    const cleared = [];
    try {
      const tmpDir = path.join(DATA, '.tmp');
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        cleared.push('.tmp');
      }
    } catch {}
    try {
      const cacheDir = path.join(DATA, '.cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        cleared.push('.cache');
      }
    } catch {}
    // Clear health cache
    healthCache = { data: null, ts: 0 };
    return json(res, { ok: true, cleared: cleared });
  }

  // ── EXPORT DATA ──
  if (pathname === '/export' && req.method === 'GET') {
    cors(res);
    const tar = require('child_process');
    const exportName = 'hubify-export-' + new Date().toISOString().slice(0, 10) + '.tar.gz';
    const exportPath = path.join('/tmp', exportName);
    try {
      tar.execSync(`tar czf ${exportPath} --exclude='.openclaw' --exclude='node_modules' --exclude='.tmp' --exclude='.cache' -C ${DATA} .`, { timeout: 30000 });
      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="' + exportName + '"'
      });
      const stream = fs.createReadStream(exportPath);
      stream.pipe(res);
      stream.on('end', () => { try { fs.unlinkSync(exportPath); } catch {} });
    } catch (e) {
      return json(res, { error: 'Export failed: ' + e.message }, 500);
    }
    return;
  }

  // ── DASHBOARD BLOCKS (Phase 14C) ──

  // GET /dashboard-blocks — read block config
  if (pathname === '/dashboard-blocks' && req.method === 'GET') {
    var blocksFile = path.join(DATA, '.dashboard-blocks.json');
    var blocksData = safeRead(blocksFile);
    if (blocksData) {
      try { return json(res, JSON.parse(blocksData)); } catch(e) {}
    }
    // Return default blocks
    return json(res, {
      version: 1,
      blocks: [
        { id: 'blk_1', type: 'greeting', order: 0 },
        { id: 'blk_2', type: 'tasks', order: 1, config: { limit: 5 } },
        { id: 'blk_3', type: 'activity', order: 2, config: { limit: 5 } },
        { id: 'blk_4', type: 'stats', order: 3, config: { show: ['budget', 'health'] } },
        { id: 'blk_5', type: 'memory', order: 4, config: { limit: 3 } }
      ]
    });
  }

  // POST /dashboard-blocks — write block config
  if (pathname === '/dashboard-blocks' && req.method === 'POST') {
    return readBody(req, function(body) {
      try {
        var data = JSON.parse(body);
        if (!data || !data.blocks) return json(res, { error: 'blocks required' }, 400);
        var blocksFile = path.join(DATA, '.dashboard-blocks.json');
        fs.writeFileSync(blocksFile, JSON.stringify(data, null, 2));
        return json(res, { ok: true });
      } catch(e) {
        return json(res, { error: e.message }, 400);
      }
    });
  }

  // PATCH /dashboard-blocks/:id — update single block
  if (pathname.match(/^\/dashboard-blocks\//) && req.method === 'PATCH') {
    var blockId = pathname.split('/').pop();
    return readBody(req, function(body) {
      try {
        var update = JSON.parse(body);
        var blocksFile = path.join(DATA, '.dashboard-blocks.json');
        var existing = safeRead(blocksFile);
        var data = existing ? JSON.parse(existing) : { version: 1, blocks: [] };
        var found = false;
        data.blocks = data.blocks.map(function(b) {
          if (b.id === blockId) { found = true; return Object.assign(b, update); }
          return b;
        });
        if (!found) return json(res, { error: 'block not found' }, 404);
        fs.writeFileSync(blocksFile, JSON.stringify(data, null, 2));
        return json(res, { ok: true, block: data.blocks.find(function(b) { return b.id === blockId; }) });
      } catch(e) {
        return json(res, { error: e.message }, 400);
      }
    });
  }

  // DELETE /dashboard-blocks/:id — remove block
  if (pathname.match(/^\/dashboard-blocks\//) && req.method === 'DELETE') {
    var delBlockId = pathname.split('/').pop();
    var blocksFile = path.join(DATA, '.dashboard-blocks.json');
    var existing = safeRead(blocksFile);
    var data = existing ? JSON.parse(existing) : { version: 1, blocks: [] };
    var origLen = data.blocks.length;
    data.blocks = data.blocks.filter(function(b) { return b.id !== delBlockId; });
    if (data.blocks.length === origLen) return json(res, { error: 'block not found' }, 404);
    fs.writeFileSync(blocksFile, JSON.stringify(data, null, 2));
    return json(res, { ok: true });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Template Update & Mode Switching endpoints
  // ══════════════════════════════════════════════════════════════════════

  if (pathname === '/api/update-status' && req.method === 'GET') {
    cors(res);
    const updateFile = path.join(DATA, 'update-available.json');
    const raw = safeRead(updateFile);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        data.hasUpdate = true;
        return json(res, data);
      } catch {}
    }
    return json(res, { hasUpdate: false });
  }

  if (pathname === '/api/switch-mode' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      cors(res);
      try {
        const { mode } = JSON.parse(body);
        if (!mode) return json(res, { error: 'mode is required' }, 400);
        if (!AGENT_MODES[mode]) return json(res, { error: 'Unknown mode: ' + mode + '. Available: ' + Object.keys(AGENT_MODES).join(', ') }, 400);

        const modeDef = AGENT_MODES[mode];
        const templateSlug = smartsyncGetTemplateSlug();

        // Determine SOUL.md content for this mode
        let soulContent = '';
        if (mode === 'personal') {
          // Personal mode uses the default template SOUL.md
          const defaultSoul = safeRead(path.join('/opt/templates', templateSlug, 'SOUL.md'));
          soulContent = defaultSoul || safeRead(path.join(DATA, 'SOUL.md')) || '';
        } else {
          // Check for mode-specific SOUL file in template modes dir
          const modeSoulPath = path.join('/opt/templates', templateSlug, 'modes', modeDef.soul_file);
          soulContent = safeRead(modeSoulPath);
          if (!soulContent) {
            // Generate a basic SOUL from the mode description
            const username = process.env.HUBIFY_USERNAME || 'user';
            const subdomain = username + '.hubify.com';
            soulContent = '# SOUL.md — ' + modeDef.label + ' Mode\n\n';
            soulContent += '*' + modeDef.description + '*\n\n';
            soulContent += '## Who You Are\n\n';
            soulContent += 'You are ' + username + "'s AI assistant, running 24/7 at `" + subdomain + '`.\n\n';
            soulContent += 'In ' + modeDef.label + ' Mode, you focus on: ' + modeDef.description + '.\n\n';
            soulContent += '---\n\n*This file is managed by Hubify mode switching.*\n';
          }
        }

        // Substitute template variables
        const username = process.env.HUBIFY_USERNAME || 'user';
        const hubId = process.env.HUB_ID || 'unknown';
        soulContent = soulContent
          .replace(/\{\{USERNAME\}\}/g, username)
          .replace(/\{\{HUB_ID\}\}/g, hubId)
          .replace(/\{\{SUBDOMAIN\}\}/g, username + '.hubify.com');

        // Write the new SOUL.md
        fs.writeFileSync(path.join(DATA, 'SOUL.md'), soulContent);

        // Update HUB.yaml with active_mode
        const hubYaml = safeRead(path.join(DATA, 'HUB.yaml')) || '';
        let updatedYaml;
        if (hubYaml.match(/active_mode:/)) {
          updatedYaml = hubYaml.replace(/active_mode:\s*"[^"]*"/, 'active_mode: "' + mode + '"');
        } else {
          // Add active_mode after template line or at the end
          const templateLine = hubYaml.match(/^(template:\s*"[^"]*")/m);
          if (templateLine) {
            updatedYaml = hubYaml.replace(templateLine[0], templateLine[0] + '\nactive_mode: "' + mode + '"');
          } else {
            updatedYaml = hubYaml + '\nactive_mode: "' + mode + '"\n';
          }
        }
        fs.writeFileSync(path.join(DATA, 'HUB.yaml'), updatedYaml);

        // Write mode-switch message for agent discovery on next heartbeat
        const switchMsg = 'MODE_SWITCH: You are now in ' + modeDef.label + ' Mode. ' +
          'Re-read /data/SOUL.md for your updated persona and focus areas. ' +
          'Acknowledge the switch briefly to the user.';
        fs.writeFileSync(path.join(DATA, '.mode-switch-message'), switchMsg);

        return json(res, {
          ok: true,
          mode: mode,
          label: modeDef.label,
          description: modeDef.description,
          message: 'Switched to ' + modeDef.label + ' mode. SOUL.md updated.'
        });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    });
    return;
  }

  if (pathname === '/api/apply-update' && req.method === 'POST') {
    cors(res);
    const updateFile = path.join(DATA, 'update-available.json');
    const raw = safeRead(updateFile);
    if (!raw) {
      return json(res, { error: 'No update available' }, 404);
    }

    let updateInfo;
    try { updateInfo = JSON.parse(raw); } catch { return json(res, { error: 'Corrupt update file' }, 500); }

    // Protected files — never overwritten by updates (user customizations)
    const PROTECTED_FILES = new Set([
      'SOUL.md', 'USER.md', 'MEMORY.md', 'AGENTS.md', 'HUB.yaml',
      'memory/', '.env', '.env.local'
    ]);

    function isProtected(filePath) {
      if (PROTECTED_FILES.has(filePath)) return true;
      // Protect anything in memory/ or learnings/ dirs
      if (filePath.startsWith('memory/') || filePath.startsWith('learnings/')) return true;
      return false;
    }

    // Step 1: Create a git rollback point
    exec('cd /data && git init --quiet 2>/dev/null; git add -A && git commit -m "Pre-update snapshot (rollback point)" --allow-empty', { timeout: 15000 }, (gitErr) => {
      const rollbackCreated = !gitErr;

      // Step 2: Read the template source files from /opt/templates/<slug>/
      const templateSlug = updateInfo.template || 'myos';
      const sourceDir = path.join('/opt/templates', templateSlug);

      if (!fs.existsSync(sourceDir)) {
        return json(res, { error: `Template source not found: ${sourceDir}`, rollback: rollbackCreated });
      }

      // Step 3: Apply updates — copy new/changed files, skip protected ones
      const updated = [];
      const skipped = [];
      const conflicts = [];

      function walkAndApply(srcDir, destDir, relBase) {
        if (!fs.existsSync(srcDir)) return;
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry.name);
          const destPath = path.join(destDir, entry.name);
          const relPath = relBase ? relBase + '/' + entry.name : entry.name;

          if (entry.isDirectory()) {
            // Skip modes/ dir (those are mode presets, not direct workspace files)
            if (entry.name === 'modes') continue;
            if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
            walkAndApply(srcPath, destPath, relPath);
          } else {
            // Check if file is protected
            if (isProtected(relPath)) {
              // Compare to SmartSync original — if user hasn't changed it, safe to update
              const origPath = path.join(DATA, '.smartsync/originals', relPath);
              const origContent = safeRead(origPath);
              const currentContent = safeRead(destPath);
              const newContent = fs.readFileSync(srcPath, 'utf8');

              if (currentContent === null) {
                // File doesn't exist yet — safe to create
                fs.writeFileSync(destPath, newContent);
                updated.push(relPath);
              } else if (origContent !== null && currentContent === origContent) {
                // User hasn't modified — safe to update
                fs.writeFileSync(destPath, newContent);
                // Update SmartSync original
                fs.writeFileSync(origPath, newContent);
                updated.push(relPath);
              } else {
                // User has customized — skip, note conflict
                skipped.push(relPath);
                conflicts.push({
                  file: relPath,
                  reason: 'User has customizations — preserved. New version saved as ' + relPath + '.update'
                });
                // Save the new version alongside for manual review
                fs.writeFileSync(destPath + '.update', newContent);
              }
            } else {
              // Non-protected file — always update
              const dirName = path.dirname(destPath);
              if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });
              fs.writeFileSync(destPath, fs.readFileSync(srcPath));
              updated.push(relPath);
            }
          }
        }
      }

      try {
        walkAndApply(sourceDir, DATA, '');
      } catch (e) {
        return json(res, {
          status: 'error',
          error: e.message,
          rollback: rollbackCreated,
          rollback_command: rollbackCreated ? 'cd /data && git reset --hard HEAD~1' : null
        }, 500);
      }

      // Step 4: Update version in HUB.yaml
      const hubYaml = path.join(DATA, 'HUB.yaml');
      const hubContent = safeRead(hubYaml);
      if (hubContent && updateInfo.available_version) {
        const updatedHub = hubContent.replace(
          /template_version:\s*.*/,
          'template_version: "' + updateInfo.available_version + '"'
        );
        fs.writeFileSync(hubYaml, updatedHub);
      }

      // Step 5: Remove the update-available flag
      try { fs.unlinkSync(updateFile); } catch {}

      // Step 6: Commit the applied update (shell-escape version to prevent injection)
      const safeVersion = String(updateInfo.available_version || 'latest').replace(/[^a-zA-Z0-9._-]/g, '');
      exec('cd /data && git add -A && git commit -m "Applied template update to v' + safeVersion + '"', { timeout: 15000 }, () => {
        return json(res, {
          status: 'applied',
          version: updateInfo.available_version || 'unknown',
          files_updated: updated.length,
          files_skipped: skipped.length,
          updated,
          skipped,
          conflicts,
          rollback: rollbackCreated,
          rollback_command: rollbackCreated ? 'cd /data && git reset --hard HEAD~2' : null
        });
      });
    });
    return;
  }

  // ── File upload endpoint ──
  if (pathname === '/api/upload' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const MAX_UPLOAD = 10 * 1024 * 1024; // 10MB

    if (contentLength > MAX_UPLOAD) {
      cors(res); res.writeHead(413); res.end(JSON.stringify({ error: 'File too large (max 10MB)' })); return;
    }

    if (!contentType.startsWith('multipart/form-data')) {
      cors(res); res.writeHead(400); res.end(JSON.stringify({ error: 'Expected multipart/form-data' })); return;
    }

    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      cors(res); res.writeHead(400); res.end(JSON.stringify({ error: 'No boundary in content-type' })); return;
    }
    const boundary = boundaryMatch[1].replace(/^["']|["']$/g, '');

    const chunks = [];
    let totalSize = 0;
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_UPLOAD) { req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (totalSize > MAX_UPLOAD) {
        cors(res); res.writeHead(413); res.end(JSON.stringify({ error: 'File too large (max 10MB)' })); return;
      }
      const buf = Buffer.concat(chunks);
      const sep = Buffer.from('--' + boundary);

      // Find first part after the boundary
      let start = buf.indexOf(sep);
      if (start === -1) { cors(res); res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid multipart data' })); return; }
      start += sep.length;

      // Skip CRLF after boundary
      if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;

      // Find header/body separator (double CRLF)
      const headerEnd = buf.indexOf('\r\n\r\n', start);
      if (headerEnd === -1) { cors(res); res.writeHead(400); res.end(JSON.stringify({ error: 'Malformed part headers' })); return; }

      const headerStr = buf.slice(start, headerEnd).toString('utf8');
      const bodyStart = headerEnd + 4;

      // Find closing boundary
      const closeSep = Buffer.from('\r\n--' + boundary);
      let bodyEnd = buf.indexOf(closeSep, bodyStart);
      if (bodyEnd === -1) bodyEnd = buf.length;

      const fileData = buf.slice(bodyStart, bodyEnd);

      // Extract filename from Content-Disposition
      let filename = 'upload-' + Date.now();
      const fnMatch = headerStr.match(/filename="([^"]+)"/);
      if (fnMatch) {
        // Sanitize filename
        filename = path.basename(fnMatch[1]).replace(/[^a-zA-Z0-9._-]/g, '_');
      }

      // Add timestamp prefix to avoid collisions
      const safeName = Date.now() + '-' + filename;
      const uploadsDir = path.join(DATA, 'uploads');

      try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

      const filePath = path.join(uploadsDir, safeName);
      try {
        fs.writeFileSync(filePath, fileData);
        cors(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, filename: safeName, url: '/data/uploads/' + safeName, size: fileData.length }));
      } catch (err) {
        cors(res); res.writeHead(500); res.end(JSON.stringify({ error: 'Failed to save file: ' + err.message }));
      }
    });
    return;
  }

  // ── Serve uploaded files ──
  if (pathname.startsWith('/data/uploads/') && req.method === 'GET') {
    const fileName = path.basename(pathname);
    const filePath = path.join(DATA, 'uploads', fileName);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(path.join(DATA, 'uploads')))) {
      cors(res); res.writeHead(403); res.end('forbidden'); return;
    }
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };
      const mime = mimeMap[ext] || 'application/octet-stream';
      cors(res);
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      cors(res); res.writeHead(404); res.end('not found');
    }
    return;
  }

  cors(res);
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stats-server] listening on ${PORT}`);
});
