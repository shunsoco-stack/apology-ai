"use client";

import { useSyncExternalStore } from "react";
import { createHistoryStore, HISTORY_STORAGE_KEY } from "../lib/history";

const store = createHistoryStore({
  getStorage: () =>
    typeof window === "undefined" ? null : window.localStorage,
});

let subscriberCount = 0;
let midnightTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleMidnightRefresh() {
  clearTimeout(midnightTimer);
  const now = new Date();
  const midnight = new Date(now);
  // Construct the next local midnight instead of assuming every day has 24 hours.
  midnight.setHours(24, 0, 0, 50);
  midnightTimer = setTimeout(
    refresh,
    Math.max(250, midnight.getTime() - now.getTime()),
  );
}

function refresh() {
  store.refresh();
  scheduleMidnightRefresh();
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") refresh();
}

function onStorage(event: StorageEvent) {
  if (event.key === HISTORY_STORAGE_KEY || event.key === null) refresh();
}

function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) {
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    refresh();
  }

  return () => {
    unsubscribe();
    subscriberCount -= 1;
    if (subscriberCount === 0) {
      clearTimeout(midnightTimer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

export function useApologyStore() {
  const snapshot = useSyncExternalStore(
    subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return {
    ...snapshot,
    addApology: store.addApology,
    clearHistory: store.clearHistory,
  };
}
