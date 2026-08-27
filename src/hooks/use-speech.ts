"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type VoiceSnapshot = {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  error: string | null;
};

const SERVER_SNAPSHOT: VoiceSnapshot = {
  supported: false,
  voices: [],
  error: null,
};
const NO_LOCAL_VOICES =
  "端末内の音声を利用できません。端末の音声設定をご確認ください。外部の音声サービスは使用しません。";
const UNSUPPORTED =
  "このブラウザは音声読み上げに対応していません。文章のコピーをご利用ください。";

function getSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  try {
    return typeof window.SpeechSynthesisUtterance === "function" &&
      window.speechSynthesis
      ? window.speechSynthesis
      : null;
  } catch {
    return null;
  }
}

function localVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  // Never fall back to a remote/default service: it may require a network request.
  return voices.filter((voice) => voice.localService === true);
}

function preferredVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => /^ja[-_]jp$/i.test(voice.lang)) ??
    voices.find((voice) => /^ja(?:[-_]|$)/i.test(voice.lang)) ??
    voices.find((voice) => voice.default) ??
    voices[0]
  );
}

function createVoiceStore() {
  let snapshot = SERVER_SNAPSHOT;
  return {
    getSnapshot: () => snapshot,
    subscribe(notify: () => void) {
      const synthesis = getSynthesis();
      if (!synthesis) {
        snapshot = { supported: false, voices: [], error: UNSUPPORTED };
        notify();
        return () => {};
      }

      const refresh = (finishedLoading = false) => {
        try {
          const allVoices = synthesis.getVoices();
          const voices = localVoices(allVoices);
          snapshot = {
            supported: true,
            voices,
            error:
              voices.length === 0 && (allVoices.length > 0 || finishedLoading)
                ? NO_LOCAL_VOICES
                : null,
          };
        } catch {
          snapshot = { supported: true, voices: [], error: NO_LOCAL_VOICES };
        }
        notify();
      };

      const onVoicesChanged = () => refresh(true);
      synthesis.addEventListener("voiceschanged", onVoicesChanged);
      refresh();
      // Some browsers never fire voiceschanged when no voice is installed.
      // Stop showing an indefinite loading state; a later event still recovers.
      const loadCheck = window.setTimeout(() => refresh(true), 3000);
      return () => {
        synthesis.removeEventListener("voiceschanged", onVoicesChanged);
        window.clearTimeout(loadCheck);
      };
    },
  };
}

function speechError(code: string): string | null {
  if (code === "canceled" || code === "interrupted") return null;
  if (code === "not-allowed") {
    return "読み上げを開始できませんでした。もう一度ボタンを押してください。";
  }
  if (code === "voice-unavailable" || code === "language-unavailable") {
    return "選択した端末内音声を利用できません。別の音声をお選びください。";
  }
  return "音声を再生できませんでした。端末の音声設定を確認するか、別の音声をお試しください。";
}

export function useSpeech() {
  const [voiceStore] = useState(createVoiceStore);
  const snapshot = useSyncExternalStore(
    voiceStore.subscribe,
    voiceStore.getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [requestedVoiceURI, setRequestedVoiceURI] = useState("");
  const [rate, setRateState] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const selectedVoice =
    snapshot.voices.find((voice) => voice.voiceURI === requestedVoiceURI) ??
    preferredVoice(snapshot.voices);
  const voiceURI = selectedVoice?.voiceURI ?? "";

  const cancelCurrent = useCallback(() => {
    const utterance = utteranceRef.current;
    if (!utterance) return;
    utterance.onstart = null;
    utterance.onend = null;
    utterance.onerror = null;
    utteranceRef.current = null;
    try {
      getSynthesis()?.cancel();
    } catch {
      // A browser closing its speech service must not break the rest of the UI.
    }
  }, []);

  useEffect(() => cancelCurrent, [cancelCurrent]);

  const stop = useCallback(() => {
    cancelCurrent();
    setSpeaking(false);
  }, [cancelCurrent]);

  const setVoiceURI = useCallback((next: string) => {
    setRequestedVoiceURI(next);
    setPlaybackError(null);
  }, []);

  const setRate = useCallback((next: number) => {
    setRateState(
      Number.isFinite(next) ? Math.min(1.5, Math.max(0.5, next)) : 1,
    );
  }, []);

  const speak = useCallback(
    (text: string, onStart?: () => void) => {
      stop();
      setPlaybackError(null);
      const synthesis = getSynthesis();
      if (!synthesis) {
        setPlaybackError(UNSUPPORTED);
        return;
      }

      try {
        // Recheck at click time in case a selected voice was removed after render.
        const available = localVoices(synthesis.getVoices());
        const voice =
          available.find((candidate) => candidate.voiceURI === voiceURI) ??
          preferredVoice(available);
        if (!voice) {
          setPlaybackError(NO_LOCAL_VOICES);
          return;
        }
        if (!text.trim()) return;

        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        let started = false;
        utterance.onstart = () => {
          if (utteranceRef.current !== utterance || started) return;
          started = true;
          setSpeaking(true);
          onStart?.();
        };
        utterance.onend = () => {
          if (utteranceRef.current !== utterance) return;
          utteranceRef.current = null;
          setSpeaking(false);
        };
        utterance.onerror = (event) => {
          if (utteranceRef.current !== utterance) return;
          utteranceRef.current = null;
          setSpeaking(false);
          setPlaybackError(speechError(event.error));
        };
        // Keep a reference while queued and expose stop before onstart arrives.
        utteranceRef.current = utterance;
        setSpeaking(true);
        synthesis.speak(utterance);
      } catch {
        cancelCurrent();
        setSpeaking(false);
        setPlaybackError(speechError("synthesis-failed"));
      }
    },
    [cancelCurrent, rate, stop, voiceURI],
  );

  return {
    supported: snapshot.supported,
    voices: snapshot.voices,
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    speaking,
    speak,
    stop,
    error: playbackError ?? snapshot.error,
  };
}
