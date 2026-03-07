/**
 * TUI screen renderer.
 * Manages the alternate screen buffer, raw mode, and frame rendering.
 */

import {
  moveTo, clearScreen, clearLine, hideCursor, showCursor,
  enterAltScreen, leaveAltScreen,
  style, truncate, pad, stripAnsi,
  RESET, BOLD, DIM, INVERSE,
  FG_CYAN, FG_GREEN, FG_YELLOW, FG_RED, FG_GRAY, FG_WHITE, FG_MAGENTA,
  BG_BLACK, BG_CYAN, BG_GRAY,
} from "./ansi.mjs";

let _rows = process.stdout.rows || 24;
let _cols = process.stdout.columns || 80;

export function rows() { return _rows; }
export function cols() { return _cols; }

export function initScreen() {
  process.stdout.write(enterAltScreen() + hideCursor() + clearScreen());
  _rows = process.stdout.rows || 24;
  _cols = process.stdout.columns || 80;

  process.stdout.on("resize", () => {
    _rows = process.stdout.rows || 24;
    _cols = process.stdout.columns || 80;
  });
}

export function destroyScreen() {
  process.stdout.write(showCursor() + leaveAltScreen());
}

// ─── Buffered writes ──────────────────────────────────────────

let _buf = "";

export function w(str) { _buf += str; }
export function flush() {
  process.stdout.write(_buf);
  _buf = "";
}

export function writeAt(row, col, text) {
  w(moveTo(row, col) + text);
}

export function writeLine(row, text) {
  w(moveTo(row, 1) + clearLine() + text);
}

// ─── Box drawing ──────────────────────────────────────────────

const BOX = {
  tl: "┌", tr: "┐", bl: "└", br: "┘",
  h: "─", v: "│",
  t: "┬", b: "┴", l: "├", r: "┤", x: "┼",
};

export function drawBox(r, c, width, height, title, focused) {
  const borderStyle = focused ? FG_CYAN : FG_GRAY + DIM;
  const innerW = width - 2;

  // Top border with optional title
  let topLine;
  if (title) {
    const label = focused
      ? style(` ${title} `, BOLD, FG_CYAN)
      : style(` ${title} `, DIM);
    const labelLen = title.length + 2;
    const rightFill = Math.max(0, innerW - labelLen - 1);
    topLine = style(BOX.tl + BOX.h, borderStyle) + label + style(BOX.h.repeat(rightFill) + BOX.tr, borderStyle);
  } else {
    topLine = style(BOX.tl + BOX.h.repeat(innerW) + BOX.tr, borderStyle);
  }
  writeAt(r, c, topLine);

  // Side borders
  for (let i = 1; i < height - 1; i++) {
    writeAt(r + i, c, style(BOX.v, borderStyle));
    writeAt(r + i, c + width - 1, style(BOX.v, borderStyle));
  }

  // Bottom border
  writeAt(r + height - 1, c, style(BOX.bl + BOX.h.repeat(innerW) + BOX.br, borderStyle));
}

export function fillArea(r, c, width, height) {
  for (let i = 0; i < height; i++) {
    writeAt(r + i, c, " ".repeat(width));
  }
}

// ─── Shared primitives ───────────────────────────────────────

export function renderStatusBar(row, text) {
  const padded = pad(` ${text}`, _cols);
  writeLine(row, style(padded, INVERSE, FG_WHITE));
}

export function renderHeaderBar(text) {
  const padded = pad(` ${text}`, _cols);
  writeLine(1, style(padded, BOLD, FG_CYAN, BG_BLACK));
}

export { BOX, style, truncate, pad, stripAnsi };
export { RESET, BOLD, DIM, INVERSE };
export { FG_CYAN, FG_GREEN, FG_YELLOW, FG_RED, FG_GRAY, FG_WHITE, FG_MAGENTA };
export { BG_BLACK, BG_CYAN, BG_GRAY };
