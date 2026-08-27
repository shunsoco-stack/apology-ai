import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApologyStore } from "../src/hooks/use-apology-store";
import {
  addHistoryEntry,
  createEmptyHistory,
  createHistoryStore,
  getLocalDateKey,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ENTRIES,
  normalizeHistory,
  parseHistory,
  serializeHistory,
  type HistoryState,
  type HistoryStorage,
  type NewApology,
} from "../src/lib/history";

const now = new Date(2026, 7, 27, 12, 0, 0);
const input: NewApology = { mode: "normal", recipient: "friend", severity: 50 };

function savedState(): HistoryState {
  return addHistoryEntry(createEmptyHistory(now), input, now, "entry-1").state;
}

function memoryStorage(initial?: HistoryState) {
  const values = new Map<string, string>();
  if (initial) values.set(HISTORY_STORAGE_KEY, JSON.stringify(initial));
  const storage: HistoryStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
  return { storage, values };
}

describe("local history", () => {
  it("uses the device's local calendar day", () => {
    expect(getLocalDateKey(new Date(2026, 7, 27, 0, 1))).toBe("2026-08-27");
    expect(getLocalDateKey(new Date(2026, 7, 27, 23, 59))).toBe("2026-08-27");
  });

  it("retains the newest 50 entries without capping either counter", () => {
    let state = createEmptyHistory(now);
    for (let index = 0; index < 65; index += 1) {
      state = addHistoryEntry(
        state,
        input,
        new Date(now.getTime() + index * 1000),
        `entry-${index}`,
      ).state;
    }

    expect(state.history).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(state.totalCount).toBe(65);
    expect(state.todayCount).toBe(65);
    expect(state.history[0].id).toBe("entry-64");
    expect(state.history.at(-1)?.id).toBe("entry-15");

    const restored = parseHistory(
      serializeHistory(state, new Date(now.getTime() + 65_000)),
      new Date(now.getTime() + 65_000),
    );
    expect(restored).toEqual(state);
  });

  it("rolls the daily counter at midnight and preserves lifetime history", () => {
    const beforeMidnight = new Date(2026, 7, 27, 23, 59, 59);
    const afterMidnight = new Date(2026, 7, 28, 0, 0, 1);
    const previous = addHistoryEntry(
      createEmptyHistory(beforeMidnight),
      input,
      beforeMidnight,
      "before-midnight",
    ).state;
    const rolled = normalizeHistory(previous, afterMidnight);

    expect(rolled.totalCount).toBe(1);
    expect(rolled.todayCount).toBe(0);
    expect(rolled.todayKey).toBe("2026-08-28");
    expect(rolled.history).toHaveLength(1);

    const next = addHistoryEntry(
      rolled,
      input,
      afterMidnight,
      "after-midnight",
    ).state;
    expect(next.totalCount).toBe(2);
    expect(next.todayCount).toBe(1);
    expect(next.history).toHaveLength(2);
  });

  it.each([
    null,
    "",
    "{broken",
    "null",
    "[]",
    '"history"',
    JSON.stringify({ version: 2 }),
    JSON.stringify({ ...savedState(), history: {} }),
    JSON.stringify({ ...savedState(), todayKey: "2026-02-30" }),
    JSON.stringify({ ...savedState(), todayKey: 20260827 }),
    JSON.stringify({ ...savedState(), totalCount: "1" }),
    JSON.stringify({ ...savedState(), totalCount: -1 }),
    JSON.stringify({ ...savedState(), totalCount: 1.5 }),
    JSON.stringify({
      ...savedState(),
      totalCount: Number.MAX_SAFE_INTEGER + 1,
    }),
    JSON.stringify({ ...savedState(), todayCount: -1 }),
    JSON.stringify({ ...savedState(), todayCount: 2 }),
    "x".repeat(128_001),
  ])("safely resets damaged or invalid stored schema (case %#)", (raw) => {
    expect(parseHistory(raw, now)).toEqual(createEmptyHistory(now));
  });

  it.each<Record<string, unknown>>([
    { mode: "unknown" },
    { recipient: "everyone" },
    { severity: -1 },
    { severity: 101 },
    { severity: "50" },
    { severity: Number.NaN },
    { severity: Number.POSITIVE_INFINITY },
    { text: "private@example.invalid" },
    { createdAt: "not-a-date" },
    { createdAt: "2026-02-30T00:00:00.000Z" },
    { createdAt: new Date(now.getTime() + 60_000).toISOString() },
    { id: "" },
    { id: "<script>private</script>" },
  ])(
    "drops invalid or future records without displaying their text (case %#)",
    (patch) => {
      const state = savedState();
      const raw = { ...state, history: [{ ...state.history[0], ...patch }] };
      const restored = normalizeHistory(raw, now);

      expect(restored.history).toEqual([]);
      expect(restored.totalCount).toBe(1);
    },
  );

  it("sorts records and removes duplicate identifiers before applying the limit", () => {
    const state = savedState();
    const older = {
      ...state.history[0],
      createdAt: new Date(now.getTime() - 1000).toISOString(),
    };
    const another = { ...older, id: "another-entry" };
    const restored = normalizeHistory(
      { ...state, totalCount: 3, history: [older, another, state.history[0]] },
      now,
    );

    expect(restored.history.map((entry) => entry.id)).toEqual([
      "entry-1",
      "another-entry",
    ]);
    expect(restored.history[0].createdAt).toBe(now.toISOString());
  });

  it("never persists the user's situation or unrecognized fields", () => {
    const privateInput = {
      ...input,
      situation: "private@example.invalid",
      prompt: "secret-123",
    };
    const result = addHistoryEntry(
      createEmptyHistory(now),
      privateInput,
      now,
      "entry-1",
    );
    const contaminated = {
      ...result.state,
      prompt: "secret-123",
      history: [{ ...result.entry, situation: "private@example.invalid" }],
    };
    const serialized = serializeHistory(contaminated, now);

    expect(serialized).not.toContain("private@example.invalid");
    expect(serialized).not.toContain("secret-123");
    expect(serialized).not.toContain("situation");
    expect(serialized).not.toContain("prompt");
    expect(Object.keys(JSON.parse(serialized).history[0]).sort()).toEqual(
      ["id", "mode", "recipient", "severity", "text", "createdAt"].sort(),
    );
  });

  it("clamps runtime severity while still producing an original template", () => {
    const result = addHistoryEntry(
      createEmptyHistory(now),
      { ...input, severity: 300 },
      now,
      "entry-1",
    );
    expect(result.entry.severity).toBe(100);
    expect(result.entry.text).toBe("すみませんでした");
    expect(
      addHistoryEntry(
        result.state,
        { ...input, severity: Number.NaN },
        now,
        "entry-2",
      ).entry.severity,
    ).toBe(50);
  });

  it("does not keep a future daily counter after the device date changes", () => {
    const state = {
      ...savedState(),
      todayKey: "2026-08-28",
      todayCount: 20,
      totalCount: 20,
      history: [],
    };
    expect(normalizeHistory(state, now).todayCount).toBe(0);
    expect(normalizeHistory(state, now).totalCount).toBe(20);
  });
});

describe("history store", () => {
  it("has a stable empty server snapshot and does not read browser APIs until subscribed", () => {
    const { storage } = memoryStorage(savedState());
    const getStorage = vi.fn(() => storage);
    const store = createHistoryStore({ getStorage, now: () => now });
    const serverSnapshot = store.getServerSnapshot();

    expect(getStorage).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(serverSnapshot);
    expect(serverSnapshot.ready).toBe(false);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(store.getSnapshot().ready).toBe(true);
    expect(store.getSnapshot().totalCount).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getServerSnapshot()).toBe(serverSnapshot);
    const clientSnapshot = store.getSnapshot();
    store.refresh();
    expect(store.getSnapshot()).toBe(clientSnapshot);
    unsubscribe();
  });

  it("persists only the fixed apology and selected settings", () => {
    const { storage, values } = memoryStorage();
    const store = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
      createId: () => "saved-entry",
    });
    const privateInput = { ...input, situation: "sensitive@example.invalid" };
    const entry = store.addApology(privateInput);
    const raw = values.get(HISTORY_STORAGE_KEY) ?? "";

    expect(entry.id).toBe("saved-entry");
    expect(raw).not.toContain("sensitive@example.invalid");
    expect(raw).not.toContain("situation");
    expect(parseHistory(raw, now).history).toEqual([entry]);
    expect(store.getSnapshot().todayCount).toBe(1);
  });

  it("keeps working in memory when localStorage access is denied", () => {
    const store = createHistoryStore({
      getStorage: () => {
        throw new DOMException("Denied", "SecurityError");
      },
      now: () => now,
    });
    store.addApology(input);
    store.addApology(input);

    expect(store.getSnapshot().totalCount).toBe(2);
    expect(store.getSnapshot().storageAvailable).toBe(false);
    store.refresh();
    expect(store.getSnapshot().history).toHaveLength(2);
    expect(() => store.clearHistory()).not.toThrow();
    expect(store.getSnapshot().totalCount).toBe(0);
  });

  it("does not reload stale history over memory after a write quota failure", () => {
    const { storage } = memoryStorage(savedState());
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    const store = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    store.addApology(input);
    store.refresh();
    store.addApology(input);

    expect(store.getSnapshot().totalCount).toBe(3);
    expect(store.getSnapshot().history).toHaveLength(3);
    expect(store.getSnapshot().storageAvailable).toBe(false);

    store.clearHistory();
    expect(storage.removeItem).toHaveBeenCalledWith(HISTORY_STORAGE_KEY);
    expect(store.getSnapshot().storageAvailable).toBe(true);
    expect(store.getSnapshot().totalCount).toBe(0);
  });

  it("preserves the current session when subsequent reads throw", () => {
    const { storage } = memoryStorage(savedState());
    const store = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    store.refresh();
    vi.mocked(storage.getItem).mockImplementation(() => {
      throw new Error("Blocked");
    });
    store.refresh();

    expect(store.getSnapshot().totalCount).toBe(1);
    expect(store.getSnapshot().history).toHaveLength(1);
    expect(store.getSnapshot().storageAvailable).toBe(false);
  });

  it("reads the latest saved changes before adding from another tab", () => {
    const { storage } = memoryStorage();
    const first = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    const second = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    first.refresh();
    second.refresh();
    first.addApology(input);
    second.addApology({ ...input, mode: "polite" });
    first.addApology({ ...input, mode: "super" });
    second.refresh();

    expect(first.getSnapshot().totalCount).toBe(3);
    expect(second.getSnapshot().totalCount).toBe(3);
    expect(second.getSnapshot().history).toHaveLength(3);
  });

  it("clears all stored records and both counters, including on the next load", () => {
    const { storage, values } = memoryStorage(savedState());
    const store = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    store.refresh();
    store.clearHistory();

    expect(values.has(HISTORY_STORAGE_KEY)).toBe(false);
    expect(store.getSnapshot()).toMatchObject({
      history: [],
      totalCount: 0,
      todayCount: 0,
      ready: true,
    });

    const reloaded = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    reloaded.refresh();
    expect(reloaded.getSnapshot().history).toEqual([]);
    expect(reloaded.getSnapshot().totalCount).toBe(0);
  });

  it("refreshes a removal performed in another tab", () => {
    const { storage } = memoryStorage(savedState());
    const store = createHistoryStore({
      getStorage: () => storage,
      now: () => now,
    });
    store.refresh();
    storage.removeItem(HISTORY_STORAGE_KEY);
    store.refresh();

    expect(store.getSnapshot().history).toEqual([]);
    expect(store.getSnapshot().todayCount).toBe(0);
  });

  it("updates the daily count on refresh without requiring another generation", () => {
    const { storage } = memoryStorage(savedState());
    let deviceTime = now;
    const store = createHistoryStore({
      getStorage: () => storage,
      now: () => deviceTime,
    });
    store.refresh();
    deviceTime = new Date(2026, 7, 28, 0, 0, 1);
    store.refresh();

    expect(store.getSnapshot().todayCount).toBe(0);
    expect(store.getSnapshot().totalCount).toBe(1);
    expect(store.getSnapshot().history).toHaveLength(1);
    store.addApology(input);
    expect(store.getSnapshot().todayCount).toBe(1);
    expect(store.getSnapshot().totalCount).toBe(2);
  });

  it("keeps counters within safe integer range", () => {
    const state: HistoryState = {
      ...savedState(),
      totalCount: Number.MAX_SAFE_INTEGER,
      todayCount: Number.MAX_SAFE_INTEGER,
    };
    const result = addHistoryEntry(state, input, now, "last-entry");
    expect(Number.isSafeInteger(result.state.totalCount)).toBe(true);
    expect(Number.isSafeInteger(result.state.todayCount)).toBe(true);
  });

  it("filters non-record history values without breaking valid records", () => {
    const state = savedState();
    const raw = {
      ...state,
      history: [null, false, [], 1, "entry", state.history[0]],
    };
    expect(normalizeHistory(raw, now).history).toEqual(state.history);
  });
});

describe("useApologyStore browser lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("resets today's count at local midnight without another user action", () => {
    vi.setSystemTime(new Date(2026, 7, 27, 23, 59, 59));
    const { result, unmount } = renderHook(() => useApologyStore());
    act(() => {
      result.current.addApology(input);
    });
    expect(result.current.todayCount).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(result.current.todayCount).toBe(0);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.history).toHaveLength(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes the daily count when returning focus after the device date changes", () => {
    const { result } = renderHook(() => useApologyStore());
    act(() => {
      result.current.addApology(input);
    });

    vi.setSystemTime(new Date(2026, 7, 28, 0, 0, 1));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(result.current.todayCount).toBe(0);
    expect(result.current.totalCount).toBe(1);
  });

  it("refreshes visible tabs and other-tab changes but ignores unrelated storage keys", () => {
    const { result } = renderHook(() => useApologyStore());
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(savedState()),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "another-app" }));
    });
    expect(result.current.totalCount).toBe(0);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.totalCount).toBe(1);

    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: HISTORY_STORAGE_KEY }),
      );
    });
    expect(result.current.totalCount).toBe(0);
    expect(result.current.history).toEqual([]);
  });
});
