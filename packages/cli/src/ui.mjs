/**
 * CLI output formatting and interaction utilities.
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const GRAY = "\x1b[90m";
const WHITE = "\x1b[37m";
const BG_CYAN = "\x1b[46m";
const BG_BLACK = "\x1b[40m";

const isTTY = process.stdout.isTTY !== false;
const isColorEnabled =
  process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== "0" &&
  isTTY;

function c(code, text) {
  return isColorEnabled ? `${code}${text}${RESET}` : text;
}

export const fmt = {
  bold: (t) => c(BOLD, t),
  dim: (t) => c(DIM, t),
  italic: (t) => c(ITALIC, t),
  green: (t) => c(GREEN, t),
  red: (t) => c(RED, t),
  yellow: (t) => c(YELLOW, t),
  cyan: (t) => c(CYAN, t),
  magenta: (t) => c(MAGENTA, t),
  gray: (t) => c(GRAY, t),
  white: (t) => c(WHITE, t),
  ok: (t) => c(GREEN, `  ✓ ${t}`),
  fail: (t) => c(RED, `  ✗ ${t}`),
  warn: (t) => c(YELLOW, `  ⚠ ${t}`),
  info: (t) => c(CYAN, `  → ${t}`),
  dot: (t) => c(GRAY, `  · ${t}`),
};

// ─── Logo ────────────────────────────────────────────────────────
const LOGO = `
    ${c(CYAN, "   ╱╲")}
    ${c(CYAN, "  ╱  ╲")}  ${c(BOLD, "Claws")}
    ${c(CYAN, " ╱ ᐳᐸ ╲")} ${c(DIM, "AI OS")}
    ${c(CYAN, "╱──────╲")}
`;

const LOGO_SMALL = `${c(CYAN, "ᐳᐸ")} ${c(BOLD, "Claws")}`;

export function logo() {
  console.log(LOGO);
}

export function banner(subtitle) {
  console.log();
  if (subtitle) {
    console.log(`  ${LOGO_SMALL} ${c(DIM, "—")} ${c(DIM, subtitle)}`);
  } else {
    console.log(`  ${LOGO_SMALL}`);
  }
  console.log();
}

export function bigBanner() {
  logo();
}

// ─── Layout ──────────────────────────────────────────────────────
export function section(title) {
  console.log(`  ${c(BOLD, title)}`);
}

export function step(msg) {
  console.log(fmt.info(msg));
}

export function success(msg) {
  console.log(fmt.ok(msg));
}

export function warn(msg) {
  console.log(fmt.warn(msg));
}

export function fail(msg) {
  console.log(fmt.fail(msg));
}

export function dot(msg) {
  console.log(fmt.dot(msg));
}

export function kv(key, value) {
  const paddedKey = (key + ":").padEnd(16);
  console.log(`    ${c(DIM, paddedKey)} ${value}`);
}

export function blank() {
  console.log();
}

export function hr() {
  console.log(c(DIM, "  " + "─".repeat(48)));
}

export function hint(msg) {
  console.log(`  ${c(GRAY, msg)}`);
}

export function cmd(command, description) {
  const padded = command.padEnd(22);
  console.log(`    ${c(CYAN, padded)} ${c(DIM, description)}`);
}

// ─── Spinner ─────────────────────────────────────────────────────
const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];

export function spinner(text) {
  if (!isTTY) {
    console.log(`  ${text}`);
    return { stop: (finalText) => finalText && console.log(`  ${finalText}`), update: () => {} };
  }

  let i = 0;
  const interval = setInterval(() => {
    const frame = SPINNER_FRAMES[i % SPINNER_FRAMES.length];
    process.stdout.write(`\r  ${c(CYAN, frame)} ${text}`);
    i++;
  }, 100);

  return {
    update(newText) {
      text = newText;
    },
    stop(finalText) {
      clearInterval(interval);
      process.stdout.write("\r" + " ".repeat(text.length + 10) + "\r");
      if (finalText) {
        console.log(finalText);
      }
    },
  };
}

/**
 * Run an async task with a spinner. Returns the task result.
 * If successMsg is provided, it's printed when the task completes.
 */
export async function withSpinner(text, task, successMsg) {
  const s = spinner(text);
  try {
    const result = await task();
    s.stop(successMsg || undefined);
    return result;
  } catch (err) {
    s.stop();
    throw err;
  }
}

// ─── Progress ────────────────────────────────────────────────────
export function stepProgress(current, total, msg) {
  const label = c(DIM, `[${current}/${total}]`);
  console.log(`  ${label} ${msg}`);
}
