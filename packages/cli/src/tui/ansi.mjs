/**
 * Low-level ANSI escape helpers for the TUI renderer.
 * Zero dependencies. Direct stdout writes only.
 */

const ESC = "\x1b";
export const CSI = `${ESC}[`;

export const RESET = `${CSI}0m`;
export const BOLD = `${CSI}1m`;
export const DIM = `${CSI}2m`;
export const ITALIC = `${CSI}3m`;
export const UNDERLINE = `${CSI}4m`;
export const INVERSE = `${CSI}7m`;

export const FG_BLACK = `${CSI}30m`;
export const FG_RED = `${CSI}31m`;
export const FG_GREEN = `${CSI}32m`;
export const FG_YELLOW = `${CSI}33m`;
export const FG_BLUE = `${CSI}34m`;
export const FG_MAGENTA = `${CSI}35m`;
export const FG_CYAN = `${CSI}36m`;
export const FG_WHITE = `${CSI}37m`;
export const FG_GRAY = `${CSI}90m`;

export const BG_BLACK = `${CSI}40m`;
export const BG_RED = `${CSI}41m`;
export const BG_GREEN = `${CSI}42m`;
export const BG_YELLOW = `${CSI}43m`;
export const BG_BLUE = `${CSI}44m`;
export const BG_MAGENTA = `${CSI}45m`;
export const BG_CYAN = `${CSI}46m`;
export const BG_WHITE = `${CSI}47m`;
export const BG_GRAY = `${CSI}100m`;

export function moveTo(row, col) { return `${CSI}${row};${col}H`; }
export function clearScreen() { return `${CSI}2J${CSI}H`; }
export function clearLine() { return `${CSI}2K`; }
export function hideCursor() { return `${CSI}?25l`; }
export function showCursor() { return `${CSI}?25h`; }
export function enterAltScreen() { return `${CSI}?1049h`; }
export function leaveAltScreen() { return `${CSI}?1049l`; }
export function enableMouse() { return `${CSI}?1000h${CSI}?1006h`; }
export function disableMouse() { return `${CSI}?1000l${CSI}?1006l`; }

export function style(text, ...codes) {
  if (codes.length === 0) return text;
  return codes.join("") + text + RESET;
}

export function truncate(str, maxLen) {
  if (!str) return "";
  const stripped = stripAnsi(str);
  if (stripped.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

export function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

export function pad(str, len, char = " ") {
  const stripped = stripAnsi(str);
  if (stripped.length >= len) return str;
  return str + char.repeat(len - stripped.length);
}

export function padCenter(str, len, char = " ") {
  const stripped = stripAnsi(str);
  if (stripped.length >= len) return str;
  const left = Math.floor((len - stripped.length) / 2);
  const right = len - stripped.length - left;
  return char.repeat(left) + str + char.repeat(right);
}
