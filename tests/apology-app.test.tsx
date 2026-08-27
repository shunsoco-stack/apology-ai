import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApologyApp from "@/components/apology-app";
import { trackApology } from "@/lib/analytics";
import { HISTORY_STORAGE_KEY, type HistoryState } from "@/lib/history";

vi.mock("@/lib/analytics", () => ({ trackApology: vi.fn() }));

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
const consultation = "焼きプリンの最後の一口を食べた（画面テスト用の相談文）";
const normalApology = "すみませんでした";
let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
let share: ReturnType<typeof vi.fn<(data: ShareData) => Promise<void>>>;

function savedHistory(): HistoryState | null {
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as HistoryState);
}

function expectCounts(total: number, today = total) {
  expect(screen.getByText("これまでの謝罪").parentElement).toHaveTextContent(
    `これまでの謝罪${total}回`,
  );
  expect(screen.getByText("本日の謝罪").parentElement).toHaveTextContent(
    `本日の謝罪${today}回`,
  );
}

function startGeneration(text = consultation) {
  fireEvent.change(
    screen.getByRole("textbox", { name: "何をしてしまいましたか？" }),
    { target: { value: text } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "AIに謝罪を考えてもらう" }),
  );
}

function finishGeneration() {
  act(() => vi.advanceTimersByTime(4350));
  return screen.getByTestId("apology-output");
}

function expectProcessingStep(label: string, progress: number) {
  const processing = screen.getByRole("region", {
    name: "誠意を、計算しています。",
  });
  const active = within(processing)
    .getAllByRole("listitem")
    .filter((item) => item.getAttribute("aria-current") === "step");
  expect(active).toHaveLength(1);
  expect(active[0]).toHaveTextContent(label);
  expect(within(processing).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    String(progress),
  );
}

async function clickAsync(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 27, 12));
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  share = vi
    .fn<(data: ShareData) => Promise<void>>()
    .mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText }, share, onLine: true });
  vi.stubGlobal("speechSynthesis", undefined);
  // jsdom has dialog elements but does not implement their native open/close methods.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  for (const [name, descriptor] of [
    ["showModal", originalShowModal],
    ["close", originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe("apology generation flow", () => {
  it("rejects whitespace, focuses the input, and clears validation when corrected", () => {
    render(<ApologyApp />);
    const input = screen.getByRole("textbox", {
      name: "何をしてしまいましたか？",
    });
    fireEvent.change(input, { target: { value: "  \n　 " } });
    fireEvent.click(
      screen.getByRole("button", { name: "AIに謝罪を考えてもらう" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ひと言だけでも、事情を教えてください。",
    );
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    act(() => vi.advanceTimersByTime(5000));
    expectCounts(0);
    expect(savedHistory()).toBeNull();
    expect(trackApology).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: consultation } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("passes through all four steps, then saves one template without the consultation", () => {
    render(<ApologyApp />);
    fireEvent.click(screen.getByRole("radio", { name: "上司" }));
    fireEvent.change(
      screen.getByRole("slider", { name: "どのくらい深刻ですか？" }),
      { target: { value: "82" } },
    );
    startGeneration();

    expectProcessingStep("状況を分析中", 1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "誠意を、計算しています。" }),
    ).toHaveFocus();
    expectCounts(0);
    act(() => vi.advanceTimersByTime(1000));
    expectProcessingStep("責任の所在を確認中", 2);
    act(() => vi.advanceTimersByTime(1050));
    expectProcessingStep("言い訳を削除中", 3);
    act(() => vi.advanceTimersByTime(1050));
    expectProcessingStep("謝罪を生成中", 4);
    act(() => vi.advanceTimersByTime(1249));
    expect(savedHistory()).toBeNull();
    expect(screen.queryByTestId("apology-output")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("apology-output").textContent).toBe(
      normalApology,
    );
    expect(
      screen.getByRole("heading", { name: "AIが導き出した答え" }),
    ).toHaveFocus();
    expectCounts(1);
    expect(savedHistory()?.history).toHaveLength(1);
    expect(savedHistory()?.history[0]).toMatchObject({
      mode: "normal",
      recipient: "boss",
      severity: 82,
      text: normalApology,
    });
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).not.toContain(
      consultation,
    );
    expect(trackApology).toHaveBeenCalledExactlyOnceWith("generate", "normal");
  });

  it("supports severity keys, clamps both boundaries, and keeps the chosen value in the result", () => {
    render(<ApologyApp />);
    const slider = screen.getByRole("slider", {
      name: "どのくらい深刻ですか？",
    });
    const keys: [string, number][] = [
      ["Home", 0],
      ["ArrowLeft", 0],
      ["ArrowDown", 0],
      ["PageDown", 0],
      ["ArrowRight", 1],
      ["ArrowUp", 2],
      ["PageUp", 12],
      ["PageDown", 2],
      ["End", 100],
      ["ArrowRight", 100],
      ["ArrowUp", 100],
      ["PageUp", 100],
      ["ArrowLeft", 99],
      ["ArrowDown", 98],
      ["PageDown", 88],
    ];
    for (const [key, expected] of keys) {
      // A handled key must prevent the browser from applying a second increment.
      expect(fireEvent.keyDown(slider, { key })).toBe(false);
      expect(slider).toHaveValue(String(expected));
      expect(slider.getAttribute("aria-valuetext")).toMatch(
        new RegExp(`^${expected}パーセント、`),
      );
    }
    expect(fireEvent.keyDown(slider, { key: "Tab" })).toBe(true);

    startGeneration();
    finishGeneration();
    expect(screen.getByText("深刻度 88%")).toBeInTheDocument();
    expect(savedHistory()?.history[0].severity).toBe(88);
  });

  it("counts only once when two submissions arrive before the processing render", () => {
    render(<ApologyApp />);
    const input = screen.getByRole("textbox", {
      name: "何をしてしまいましたか？",
    });
    fireEvent.change(input, { target: { value: consultation } });
    const form = input.closest("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    finishGeneration();
    act(() => vi.advanceTimersByTime(5000));

    expectCounts(1);
    expect(savedHistory()?.history).toHaveLength(1);
    expect(trackApology).toHaveBeenCalledExactlyOnceWith("generate", "normal");
  });

  it("cancels a pending generation without counting it and permits a fresh request", () => {
    render(<ApologyApp />);
    startGeneration();
    act(() => vi.advanceTimersByTime(4200));
    fireEvent.click(screen.getByRole("button", { name: "中止する" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(
      screen.getByText("生成を中止しました。謝罪回数には含まれません。"),
    ).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expectCounts(0);
    expect(savedHistory()).toBeNull();
    expect(trackApology).not.toHaveBeenCalled();

    startGeneration("何もしていない");
    expect(finishGeneration().textContent).toBe(normalApology);
    expectCounts(1);
    expect(trackApology).toHaveBeenCalledExactlyOnceWith("generate", "normal");
  });

  it("does not finish or increment after navigating to history during processing", () => {
    render(<ApologyApp />);
    startGeneration();
    act(() => vi.advanceTimersByTime(2050));
    fireEvent.click(screen.getByRole("button", { name: "謝罪の履歴" }));
    act(() => vi.advanceTimersByTime(5000));

    expect(
      screen.getByRole("heading", { name: "まだ、謝っていません。" }),
    ).toBeInTheDocument();
    expectCounts(0);
    expect(savedHistory()).toBeNull();
    expect(trackApology).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "新しく謝る" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("cleans up generation timers when the application unmounts", () => {
    const { unmount } = render(<ApologyApp />);
    startGeneration();
    act(() => vi.advanceTimersByTime(3100));
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(savedHistory()).toBeNull();
    expect(trackApology).not.toHaveBeenCalled();
  });

  it.each([
    { label: /^丁寧/, mode: "polite", text: "大変申し訳ございませんでした" },
    {
      label: /^超高性能/,
      mode: "super",
      text: "このたびは誠に申し訳ございませんでした",
    },
  ])(
    "uses the selected $mode mode in the result, history, and event",
    ({ label, mode, text }) => {
      render(<ApologyApp />);
      fireEvent.click(screen.getByRole("radio", { name: label }));
      startGeneration("むしろ褒めてもらいたいです");
      expect(finishGeneration().textContent).toBe(text);
      expect(savedHistory()?.history[0]).toMatchObject({ mode, text });
      expect(trackApology).toHaveBeenCalledExactlyOnceWith("generate", mode);
      expectCounts(1);
    },
  );
});

describe("result actions", () => {
  it("copies only the apology, records success, and gives a useful failure message", async () => {
    render(<ApologyApp />);
    startGeneration();
    finishGeneration();

    await clickAsync("謝罪文をコピー");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(normalApology);
    expect(trackApology).toHaveBeenLastCalledWith("copy", "normal");
    expect(
      screen.getByRole("button", { name: "コピーしました" }),
    ).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2500));
    writeText.mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError"),
    );
    await clickAsync("謝罪文をコピー");

    expect(
      screen.getByText(
        "コピーできませんでした。謝罪文を長押し、またはドラッグで選択してコピーしてください。",
      ),
    ).toBeInTheDocument();
    expect(
      vi.mocked(trackApology).mock.calls.filter(([event]) => event === "copy"),
    ).toHaveLength(1);
    expect(screen.getByTestId("apology-output").textContent).toBe(
      normalApology,
    );
    expectCounts(1);
  });

  it("shares the fixed apology and a clean URL, counting only successful shares", async () => {
    window.history.replaceState(
      null,
      "",
      "/?consultation=must-stay-local#private-fragment",
    );
    render(<ApologyApp />);
    startGeneration();
    finishGeneration();
    await clickAsync("共有");

    expect(share).toHaveBeenCalledExactlyOnceWith({
      title: "謝罪AI",
      text: `${normalApology}\n— 考え抜いた結果、すみません。AI風のジョークアプリです。`,
      url: `${window.location.origin}/`,
    });
    expect(trackApology).toHaveBeenLastCalledWith("share", "normal");
    expect(
      screen.getByText("共有しました。謝罪の輪が広がりました。"),
    ).toBeInTheDocument();
    expectCounts(1);
  });

  it("treats a cancelled share silently and explains other sharing failures", async () => {
    share.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    render(<ApologyApp />);
    startGeneration();
    finishGeneration();
    await clickAsync("共有");
    expect(
      screen.queryByText("共有しました。謝罪の輪が広がりました。"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "共有できませんでした。「謝罪文をコピー」をお試しください。",
      ),
    ).not.toBeInTheDocument();

    share.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await clickAsync("共有");
    expect(
      screen.getByText(
        "共有できませんでした。「謝罪文をコピー」をお試しください。",
      ),
    ).toBeInTheDocument();
    expect(vi.mocked(trackApology).mock.calls).toEqual([
      ["generate", "normal"],
    ]);
    expectCounts(1);
  });

  it("copies a clean share link when the Web Share API is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText }, onLine: true });
    window.history.replaceState(
      null,
      "",
      "/?consultation=must-stay-local#private-fragment",
    );
    render(<ApologyApp />);
    startGeneration();
    finishGeneration();
    expect(
      screen.queryByRole("button", { name: "共有" }),
    ).not.toBeInTheDocument();
    await clickAsync("リンクをコピー");

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      `${normalApology}\n\n謝罪AI — AI風のジョークアプリ\n${window.location.origin}/`,
    );
    expect(vi.mocked(trackApology).mock.calls).toEqual([
      ["generate", "normal"],
      ["copy", "normal"],
    ]);
    expectCounts(1);
  });
});

describe("history interactions", () => {
  it("opens and copies a saved result using its original mode without generating again", async () => {
    render(<ApologyApp />);
    fireEvent.click(screen.getByRole("radio", { name: /^超高性能/ }));
    startGeneration();
    finishGeneration();
    const previousHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    fireEvent.click(
      screen.getByRole("button", { name: "もう一度、考えてもらう" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /^通常/ }));
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "メインナビゲーション" }),
      ).getByRole("button", { name: /謝罪の履歴/ }),
    );
    await clickAsync("超高性能の謝罪文をコピー");

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      "このたびは誠に申し訳ございませんでした",
    );
    expect(trackApology).toHaveBeenLastCalledWith("copy", "super");
    fireEvent.click(
      screen.getByRole("button", { name: "超高性能の謝罪結果を開く" }),
    );
    expect(screen.getByTestId("apology-output").textContent).toBe(
      "このたびは誠に申し訳ございませんでした",
    );
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe(
      previousHistory,
    );
    expectCounts(1);
    expect(
      vi
        .mocked(trackApology)
        .mock.calls.filter(([event]) => event === "generate"),
    ).toEqual([["generate", "super"]]);
  });

  it("keeps history on cancel and resets history and counters only after confirmation", () => {
    render(<ApologyApp />);
    startGeneration();
    finishGeneration();
    fireEvent.click(screen.getByRole("button", { name: "履歴を見る" }));
    const previousHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "履歴を削除" }));
    const confirmation = screen.getByRole("dialog", {
      name: "謝罪の履歴を削除しますか？",
    });
    expect(confirmation).toBeVisible();
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe(
      previousHistory,
    );
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "キャンセル" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "謝罪の履歴を削除しますか？" }),
    ).not.toBeInTheDocument();
    expectCounts(1);
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe(
      previousHistory,
    );

    fireEvent.click(screen.getByRole("button", { name: "履歴を削除" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "謝罪の履歴を削除しますか？" }),
      ).getByRole("button", { name: "削除してリセット" }),
    );
    expect(
      screen.getByRole("heading", { name: "まだ、謝っていません。" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "履歴を削除" })).toBeDisabled();
    expectCounts(0);
    expect(savedHistory()).toBeNull();
    expect(
      screen.getByText("履歴を削除し、謝罪回数をリセットしました。"),
    ).toBeInTheDocument();
    expect(trackApology).toHaveBeenCalledExactlyOnceWith("generate", "normal");
  });
});
