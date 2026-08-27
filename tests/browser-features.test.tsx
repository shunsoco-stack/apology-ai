import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsProps } from "@vercel/analytics";
import { track } from "@vercel/analytics";
import { useSpeech } from "@/hooks/use-speech";
import { useTheme } from "@/hooks/use-theme";
import {
  canTrackAnalytics,
  sanitizeAnalyticsEvent,
  trackApology,
} from "@/lib/analytics";
import AnalyticsProvider from "@/components/analytics-provider";

const { analyticsComponent } = vi.hoisted(() => ({
  analyticsComponent: vi.fn<(_props: AnalyticsProps) => null>(() => null),
}));

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("@vercel/analytics/react", () => ({ Analytics: analyticsComponent }));

class FakeUtterance {
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  rate = 1;
  onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(public text: string) {}
}

function voice(
  name: string,
  lang: string,
  localService = true,
): SpeechSynthesisVoice {
  return { name, voiceURI: name, lang, localService, default: false };
}

function mockSpeech(initial: SpeechSynthesisVoice[]) {
  let voices = initial;
  const queued: FakeUtterance[] = [];
  const synthesis = Object.assign(new EventTarget(), {
    getVoices: vi.fn(() => voices),
    speak: vi.fn((utterance: FakeUtterance) => queued.push(utterance)),
    cancel: vi.fn(),
  });
  vi.stubGlobal("speechSynthesis", synthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return {
    synthesis,
    queued,
    updateVoices(next: SpeechSynthesisVoice[]) {
      voices = next;
      synthesis.dispatchEvent(new Event("voiceschanged"));
    },
  };
}

function mockColorScheme(dark: boolean) {
  const media = Object.assign(new EventTarget(), {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  return media;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("useSpeech", () => {
  it("uses a local Japanese voice and counts only a real playback start", () => {
    const remote = voice("Remote Japanese", "ja-JP", false);
    const japanese = voice("Local Japanese", "ja-JP");
    const { queued } = mockSpeech([
      voice("Local English", "en-US"),
      remote,
      japanese,
    ]);
    const { result } = renderHook(useSpeech);
    const started = vi.fn();

    expect(result.current.voices).toEqual([
      voice("Local English", "en-US"),
      japanese,
    ]);
    expect(result.current.voiceURI).toBe(japanese.voiceURI);
    act(() => result.current.speak("すみませんでした", started));
    expect(queued[0].voice).toBe(japanese);
    expect(queued[0].lang).toBe("ja-JP");
    expect(queued[0].text).toBe("すみませんでした");
    expect(started).not.toHaveBeenCalled();

    act(() => {
      queued[0].onstart?.({} as SpeechSynthesisEvent);
      queued[0].onstart?.({} as SpeechSynthesisEvent);
    });
    expect(started).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBe(true);
    act(() => queued[0].onend?.({} as SpeechSynthesisEvent));
    expect(result.current.speaking).toBe(false);
  });

  it("responds to voiceschanged and safely replaces a removed selected voice", () => {
    const japanese = voice("Japanese", "ja-JP");
    const english = voice("English", "en-US");
    const { updateVoices, queued } = mockSpeech([]);
    const { result } = renderHook(useSpeech);
    expect(result.current.supported).toBe(true);
    expect(result.current.voices).toEqual([]);
    expect(result.current.error).toBeNull();

    act(() => updateVoices([japanese, english]));
    act(() => result.current.setVoiceURI(english.voiceURI));
    expect(result.current.voiceURI).toBe(english.voiceURI);
    act(() => updateVoices([japanese, voice("Remote", "en-US", false)]));
    expect(result.current.voiceURI).toBe(japanese.voiceURI);
    act(() => result.current.speak("すみませんでした"));
    expect(queued[0].voice).toBe(japanese);
  });

  it("never speaks through a remote voice when no local voice exists", () => {
    const { synthesis } = mockSpeech([voice("Remote", "ja-JP", false)]);
    const { result } = renderHook(useSpeech);
    act(() => result.current.speak("すみませんでした"));
    expect(result.current.error).toContain("外部の音声サービスは使用しません");
    expect(result.current.voices).toEqual([]);
    expect(synthesis.speak).not.toHaveBeenCalled();
  });

  it("ends an empty loading state and recovers if a voice becomes available later", () => {
    vi.useFakeTimers();
    const { updateVoices } = mockSpeech([]);
    const { result } = renderHook(useSpeech);
    expect(result.current.error).toBeNull();
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.error).toContain("端末内の音声を利用できません");
    act(() => updateVoices([voice("Japanese", "ja-JP")]));
    expect(result.current.error).toBeNull();
    expect(result.current.voices).toHaveLength(1);
  });

  it("cancels repeated requests, ignores obsolete callbacks, and stops on unmount", () => {
    const { synthesis, queued } = mockSpeech([voice("Japanese", "ja-JP")]);
    const { result, unmount } = renderHook(useSpeech);
    const firstStarted = vi.fn();
    act(() => result.current.speak("すみませんでした", firstStarted));
    const obsoleteStart = queued[0].onstart;
    act(() => result.current.speak("大変申し訳ございませんでした"));
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(queued[0].onstart).toBeNull();
    act(() => obsoleteStart?.({} as SpeechSynthesisEvent));
    expect(firstStarted).not.toHaveBeenCalled();
    expect(result.current.speaking).toBe(true);
    unmount();
    expect(synthesis.cancel).toHaveBeenCalledTimes(2);
    expect(queued[1].onerror).toBeNull();
  });

  it("reports native failures without recording playback and allows a later retry", () => {
    const { queued } = mockSpeech([voice("Japanese", "ja-JP")]);
    const { result } = renderHook(useSpeech);
    const started = vi.fn();
    act(() => result.current.speak("すみませんでした", started));
    act(() =>
      queued[0].onerror?.({
        error: "not-allowed",
      } as SpeechSynthesisErrorEvent),
    );
    expect(started).not.toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
    expect(result.current.error).toContain("もう一度ボタンを押してください");
    act(() => result.current.speak("すみませんでした", started));
    expect(result.current.error).toBeNull();
    act(() => result.current.stop());
    expect(result.current.speaking).toBe(false);
  });

  it("clamps voice speed and handles unsupported browsers", () => {
    const { queued } = mockSpeech([voice("Japanese", "ja-JP")]);
    const { result, unmount } = renderHook(useSpeech);
    act(() => result.current.setRate(7));
    act(() => result.current.speak("すみませんでした"));
    expect(queued[0].rate).toBe(1.5);
    act(() => result.current.setRate(-1));
    expect(result.current.rate).toBe(0.5);
    act(() => result.current.setRate(Number.NaN));
    expect(result.current.rate).toBe(1);
    unmount();

    vi.stubGlobal("speechSynthesis", undefined);
    const unsupported = renderHook(useSpeech);
    expect(unsupported.result.current.supported).toBe(false);
    expect(unsupported.result.current.error).toContain("対応していません");
    act(() => unsupported.result.current.speak("すみませんでした"));
    expect(unsupported.result.current.speaking).toBe(false);
  });
});

describe("useTheme", () => {
  it("starts with the OS preference, tracks changes, and persists a manual choice", () => {
    const media = mockColorScheme(true);
    const { result } = renderHook(useTheme);
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    act(() => {
      media.matches = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(result.current.theme).toBe("light");
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    expect(window.localStorage.getItem("apology-ai:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("uses the pre-hydration theme and synchronizes a choice from another tab", () => {
    mockColorScheme(false);
    document.documentElement.dataset.theme = "dark";
    window.localStorage.setItem("apology-ai:theme", "dark");
    const { result } = renderHook(useTheme);
    expect(result.current.theme).toBe("dark");
    act(() => {
      window.localStorage.setItem("apology-ai:theme", "light");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "apology-ai:theme",
          newValue: "light",
        }),
      );
    });
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("can toggle when localStorage is blocked and retains the choice for this session", () => {
    const media = mockColorScheme(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(useTheme);
    act(() => result.current.toggleTheme());
    act(() => media.dispatchEvent(new Event("change")));
    expect(result.current.theme).toBe("dark");
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
  });
});

describe("private analytics", () => {
  it("sends only allowlisted action names and a validated mode", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const event of ["generate", "copy", "speak", "share"] as const) {
      trackApology(event, "super");
    }
    expect(vi.mocked(track).mock.calls).toEqual([
      ["apology_generate", { mode: "super" }],
      ["apology_copy", { mode: "super" }],
      ["apology_speak", { mode: "super" }],
      ["apology_share", { mode: "super" }],
    ]);
    trackApology("toString" as "copy", "normal");
    trackApology("copy", "personal input" as "normal");
    expect(track).toHaveBeenCalledTimes(4);
  });

  it("does not send events in development or when DNT/GPC is enabled", () => {
    trackApology("generate", "normal");
    expect(track).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("navigator", { doNotTrack: "1" });
    trackApology("generate", "normal");
    expect(canTrackAnalytics()).toBe(false);
    expect(track).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { doNotTrack: "0", globalPrivacyControl: true });
    trackApology("copy", "normal");
    expect(track).not.toHaveBeenCalled();
  });

  it("removes query strings and fragments for both event types", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const type of ["pageview", "event"] as const) {
      expect(
        sanitizeAnalyticsEvent({
          type,
          url: "https://apology.example/?input=private#secret",
        }),
      ).toEqual({ type, url: "https://apology.example/" });
    }
    expect(
      sanitizeAnalyticsEvent({ type: "pageview", url: "javascript:alert(1)" }),
    ).toBeNull();
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    expect(
      sanitizeAnalyticsEvent({
        type: "event",
        url: "https://apology.example/",
      }),
    ).toBeNull();
  });

  it("does not let analytics failures escape into the application", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(track).mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    expect(() => trackApology("copy", "polite")).not.toThrow();
  });

  it("only mounts the analytics client when allowed and attaches URL sanitization", () => {
    const { rerender } = render(<AnalyticsProvider />);
    expect(analyticsComponent).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    rerender(<AnalyticsProvider />);
    expect(analyticsComponent).toHaveBeenCalled();
    const props = analyticsComponent.mock.calls.at(-1)?.[0];
    expect(
      props?.beforeSend?.({
        type: "event",
        url: "https://apology.example/?private=yes#input",
      }),
    ).toEqual({ type: "event", url: "https://apology.example/" });
    analyticsComponent.mockClear();
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    act(() => window.dispatchEvent(new Event("focus")));
    expect(analyticsComponent).not.toHaveBeenCalled();
  });
});
