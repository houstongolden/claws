// ── Theme system for Studio ──────────────────────────────────────────────────

export interface ThemeColors {
  bg: string;
  surface: string;
  sidebar: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  success: string;
  warning: string;
  error: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: "dark",
    name: "Dark",
    colors: {
      bg: "#0A0A0A",
      surface: "#111111",
      sidebar: "#0E0E0E",
      border: "#1A1A1A",
      text: "#E8E4DF",
      textSecondary: "#9A9590",
      textMuted: "#5C5856",
      accent: "#D4A574",
      accentMuted: "#9A7B58",
      success: "#6BAF7A",
      warning: "#D4A574",
      error: "#CC6B6B",
    },
  },
  {
    id: "light",
    name: "Light",
    colors: {
      bg: "#FAF8F5",
      surface: "#FFFFFF",
      sidebar: "#F3F0EC",
      border: "#E5E0DA",
      text: "#1A1815",
      textSecondary: "#6B6560",
      textMuted: "#A09A94",
      accent: "#9A7B58",
      accentMuted: "#C4A882",
      success: "#4A8C5C",
      warning: "#9A7B58",
      error: "#B85454",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      bg: "#0B1121",
      surface: "#111827",
      sidebar: "#0D1425",
      border: "#1E2A42",
      text: "#E2E8F0",
      textSecondary: "#8B9DBF",
      textMuted: "#4A5C7A",
      accent: "#67C8FF",
      accentMuted: "#3A7AAD",
      success: "#5ECC8E",
      warning: "#F0B060",
      error: "#E06060",
    },
  },
  {
    id: "synthwave",
    name: "Synthwave",
    colors: {
      bg: "#1A0A2E",
      surface: "#221340",
      sidebar: "#170830",
      border: "#3A1A60",
      text: "#F0E0FF",
      textSecondary: "#B090D0",
      textMuted: "#6A4A8A",
      accent: "#FF2E97",
      accentMuted: "#B31E6A",
      success: "#00F0A0",
      warning: "#FFD000",
      error: "#FF3E5E",
    },
  },
  {
    id: "solarized",
    name: "Solarized",
    colors: {
      bg: "#002B36",
      surface: "#073642",
      sidebar: "#002028",
      border: "#0A4A5A",
      text: "#FDF6E3",
      textSecondary: "#93A1A1",
      textMuted: "#586E75",
      accent: "#B58900",
      accentMuted: "#7D5F00",
      success: "#859900",
      warning: "#CB4B16",
      error: "#DC322F",
    },
  },
  {
    id: "nord",
    name: "Nord",
    colors: {
      bg: "#2E3440",
      surface: "#3B4252",
      sidebar: "#2B303B",
      border: "#434C5E",
      text: "#ECEFF4",
      textSecondary: "#D8DEE9",
      textMuted: "#7B88A1",
      accent: "#88C0D0",
      accentMuted: "#5E8A98",
      success: "#A3BE8C",
      warning: "#EBCB8B",
      error: "#BF616A",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    colors: {
      bg: "#282A36",
      surface: "#313545",
      sidebar: "#252732",
      border: "#44475A",
      text: "#F8F8F2",
      textSecondary: "#C0C0B8",
      textMuted: "#6272A4",
      accent: "#50FA7B",
      accentMuted: "#38B058",
      success: "#50FA7B",
      warning: "#F1FA8C",
      error: "#FF5555",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    colors: {
      bg: "#1E1E2E",
      surface: "#262637",
      sidebar: "#1A1A28",
      border: "#333350",
      text: "#CDD6F4",
      textSecondary: "#A6ADC8",
      textMuted: "#585B70",
      accent: "#CBA6F7",
      accentMuted: "#9370B8",
      success: "#A6E3A1",
      warning: "#F9E2AF",
      error: "#F38BA8",
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    colors: {
      bg: "#000000",
      surface: "#0A0A0A",
      sidebar: "#050505",
      border: "#1A1A1A",
      text: "#33FF33",
      textSecondary: "#22AA22",
      textMuted: "#116611",
      accent: "#33FF33",
      accentMuted: "#22AA22",
      success: "#33FF33",
      warning: "#FFFF33",
      error: "#FF3333",
    },
  },
  {
    id: "paper",
    name: "Paper",
    colors: {
      bg: "#F5F0E8",
      surface: "#FFFDF8",
      sidebar: "#EDE8E0",
      border: "#D8D0C4",
      text: "#2C2418",
      textSecondary: "#5C5040",
      textMuted: "#9A9080",
      accent: "#4A3828",
      accentMuted: "#7A6850",
      success: "#3A6B40",
      warning: "#8A6A30",
      error: "#8A3030",
    },
  },
];

export const DEFAULT_THEME_ID = "dark";

export function getThemeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
