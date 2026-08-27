import {
  generateApology,
  isApologyMode,
  isRecipient,
  type ApologyMode,
  type Recipient,
} from "./apology";

export const HISTORY_STORAGE_KEY = "apology-ai:history:v1";
export const MAX_HISTORY_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  mode: ApologyMode;
  recipient: Recipient;
  severity: number;
  text: string;
  createdAt: string;
}

export interface HistoryState {
  version: 1;
  totalCount: number;
  todayCount: number;
  todayKey: string;
  history: HistoryEntry[];
}

export type NewApology = Pick<HistoryEntry, "mode" | "recipient" | "severity">;

export interface ApologyStoreSnapshot {
  history: HistoryEntry[];
  totalCount: number;
  todayCount: number;
  ready: boolean;
  storageAvailable: boolean;
}

export type HistoryStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function getLocalDateKey(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyHistory(now = new Date()): HistoryState {
  return {
    version: 1,
    totalCount: 0,
    todayCount: 0,
    todayKey: getLocalDateKey(now),
    history: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function readEntry(value: unknown, now: Date): HistoryEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,96}$/.test(value.id) ||
    !isApologyMode(value.mode) ||
    !isRecipient(value.recipient) ||
    typeof value.severity !== "number" ||
    !Number.isFinite(value.severity) ||
    value.severity < 0 ||
    value.severity > 100 ||
    value.text !== generateApology(value.mode) ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  const createdAt = new Date(value.createdAt);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    createdAt.getTime() > now.getTime() ||
    createdAt.toISOString() !== value.createdAt
  ) {
    return null;
  }

  // Whitelist fields: unknown fields (including a past or injected prompt) never survive.
  return {
    id: value.id,
    mode: value.mode,
    recipient: value.recipient,
    severity: value.severity,
    text: generateApology(value.mode),
    createdAt: value.createdAt,
  };
}

export function normalizeHistory(
  value: unknown,
  now = new Date(),
): HistoryState {
  const empty = createEmptyHistory(now);
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isCount(value.totalCount) ||
    !isCount(value.todayCount) ||
    value.todayCount > value.totalCount ||
    !isDateKey(value.todayKey) ||
    !Array.isArray(value.history)
  ) {
    return empty;
  }

  const seen = new Set<string>();
  const entries = value.history
    .map((entry) => readEntry(entry, now))
    .filter((entry): entry is HistoryEntry => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  const totalCount = Math.max(value.totalCount, entries.length);
  const retainedTodayCount = entries.filter(
    (entry) => getLocalDateKey(new Date(entry.createdAt)) === empty.todayKey,
  ).length;
  const todayCount = Math.max(
    value.todayKey === empty.todayKey ? value.todayCount : 0,
    retainedTodayCount,
  );

  return {
    version: 1,
    totalCount,
    todayCount: Math.min(todayCount, totalCount),
    todayKey: empty.todayKey,
    history: entries.slice(0, MAX_HISTORY_ENTRIES),
  };
}

export function parseHistory(
  raw: string | null,
  now = new Date(),
): HistoryState {
  // A normal 50-entry history is small. Ignore unexpectedly oversized or damaged data.
  if (!raw || raw.length > 128_000) return createEmptyHistory(now);
  try {
    return normalizeHistory(JSON.parse(raw), now);
  } catch {
    return createEmptyHistory(now);
  }
}

export function serializeHistory(
  state: HistoryState,
  now = new Date(),
): string {
  return JSON.stringify(normalizeHistory(state, now));
}

function createEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function addHistoryEntry(
  state: HistoryState,
  input: NewApology,
  now = new Date(),
  id = createEntryId(),
): { state: HistoryState; entry: HistoryEntry } {
  const current = normalizeHistory(state, now);
  const mode = isApologyMode(input.mode) ? input.mode : "normal";
  const recipient = isRecipient(input.recipient) ? input.recipient : "friend";
  const severity = Number.isFinite(input.severity)
    ? Math.min(100, Math.max(0, Math.round(input.severity)))
    : 50;
  const entry: HistoryEntry = {
    id,
    mode,
    recipient,
    severity,
    text: generateApology(mode),
    createdAt: now.toISOString(),
  };

  return {
    state: {
      version: 1,
      totalCount: Math.min(Number.MAX_SAFE_INTEGER, current.totalCount + 1),
      todayCount: Math.min(Number.MAX_SAFE_INTEGER, current.todayCount + 1),
      todayKey: getLocalDateKey(now),
      history: [entry, ...current.history].slice(0, MAX_HISTORY_ENTRIES),
    },
    entry,
  };
}

interface HistoryStoreOptions {
  getStorage: () => HistoryStorage | null;
  now?: () => Date;
  createId?: () => string;
}

/** Browser access is lazy, so constructing the store is safe during server rendering. */
export function createHistoryStore(options: HistoryStoreOptions) {
  const now = options.now ?? (() => new Date());
  const listeners = new Set<() => void>();
  const serverSnapshot: ApologyStoreSnapshot = {
    history: [],
    totalCount: 0,
    todayCount: 0,
    ready: false,
    storageAvailable: true,
  };
  let snapshot = serverSnapshot;
  let state = createEmptyHistory(new Date(0));
  let storageAvailable = true;
  let initialized = false;

  function publish(next: HistoryState) {
    const changed =
      !snapshot.ready ||
      snapshot.storageAvailable !== storageAvailable ||
      JSON.stringify(state) !== JSON.stringify(next);
    state = next;
    initialized = true;
    if (!changed) return;
    snapshot = {
      history: state.history,
      totalCount: state.totalCount,
      todayCount: state.todayCount,
      ready: true,
      storageAvailable,
    };
    listeners.forEach((listener) => listener());
  }

  function refresh() {
    const date = now();
    let next = normalizeHistory(state, date);
    if (storageAvailable) {
      try {
        const storage = options.getStorage();
        if (!storage) throw new Error("Local storage unavailable");
        next = parseHistory(storage.getItem(HISTORY_STORAGE_KEY), date);
      } catch {
        // Keep using memory for this session; a stale saved value must not erase new work.
        storageAvailable = false;
      }
    }
    publish(next);
  }

  function addApology(input: NewApology): HistoryEntry {
    // Read the latest saved value immediately before writing, including other tabs' changes.
    refresh();
    const date = now();
    const result = addHistoryEntry(state, input, date, options.createId?.());
    if (storageAvailable) {
      try {
        const storage = options.getStorage();
        if (!storage) throw new Error("Local storage unavailable");
        storage.setItem(
          HISTORY_STORAGE_KEY,
          serializeHistory(result.state, date),
        );
      } catch {
        storageAvailable = false;
      }
    }
    publish(result.state);
    return result.entry;
  }

  function clearHistory() {
    const next = createEmptyHistory(now());
    try {
      // Even after a quota error, try to remove previously saved history on explicit deletion.
      const storage = options.getStorage();
      if (!storage) throw new Error("Local storage unavailable");
      storage.removeItem(HISTORY_STORAGE_KEY);
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    publish(next);
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!initialized) refresh();
      return () => listeners.delete(listener);
    },
    refresh,
    addApology,
    clearHistory,
  };
}
