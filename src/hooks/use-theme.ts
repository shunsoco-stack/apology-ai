"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "apology-ai:theme";
const CHANGE_EVENT = "apology-ai:theme-change";

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function getSnapshot(): Theme {
  const current = document.documentElement.dataset.theme;
  return current === "dark" || current === "light"
    ? current
    : (savedTheme() ?? systemTheme());
}

function subscribe(notify: () => void) {
  let preference = savedTheme();
  applyTheme(getSnapshot());
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  const onChange = () => {
    // Keep the user's choice in this session even if storage is blocked.
    preference = getSnapshot();
    notify();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = savedTheme();
    applyTheme(preference ?? systemTheme());
    notify();
  };
  const onSystemChange = () => {
    if (preference !== null) return;
    applyTheme(systemTheme());
    notify();
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media?.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media?.removeEventListener("change", onSystemChange);
  };
}

function toggleTheme() {
  const next = getSnapshot() === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The current page still works when private browsing blocks persistence.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "light" as const,
  );
  return { theme, toggleTheme };
}
