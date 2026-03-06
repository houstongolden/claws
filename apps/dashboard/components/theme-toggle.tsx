"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const STORAGE_KEY = "claws-theme";
type Theme = "light" | "dark" | "system";

function getEffectiveTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, theme]);

  const cycle = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, [theme]);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-8 w-8 p-0 text-sidebar-foreground", className)}
        aria-label="Theme"
      >
        <Monitor size={14} />
      </Button>
    );
  }

  const effective = getEffectiveTheme();
  const icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  const Icon = icon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={cycle}
      className={cn("h-8 w-8 p-0 text-sidebar-foreground hover:text-sidebar-active", className)}
      aria-label={`Theme: ${theme} (${effective})`}
      title={`Theme: ${theme} · Click for ${theme === "light" ? "dark" : theme === "dark" ? "system" : "light"}`}
    >
      <Icon size={14} strokeWidth={1.8} />
    </Button>
  );
}
