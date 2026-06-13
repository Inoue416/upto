"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "upto-theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme ?? null;
    if (isTheme(currentTheme)) {
      setTheme(currentTheme);
    }
  }, []);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      return nextTheme;
    });
  }

  const nextThemeLabel = theme === "dark" ? "ライト" : "ダーク";

  return (
    <button
      aria-label={`${nextThemeLabel}モードに切り替える`}
      aria-pressed={theme === "dark"}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      data-testid="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      {nextThemeLabel}
    </button>
  );
}
