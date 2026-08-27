"use client";

import {
  Check,
  Copy,
  History,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Square,
  Volume2,
  Zap,
} from "lucide-react";
import { MODES, RECIPIENTS } from "@/lib/apology";
import type { HistoryEntry } from "@/lib/history";
import type { useSpeech } from "@/hooks/use-speech";

type Speech = ReturnType<typeof useSpeech>;
type Props = {
  result: HistoryEntry;
  speech: Speech;
  shareSupported: boolean;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
  onSpeak: () => void;
  onAgain: () => void;
  onHistory: () => void;
};

export default function ResultPanel({
  result,
  speech,
  shareSupported,
  copied,
  onCopy,
  onShare,
  onSpeak,
  onAgain,
  onHistory,
}: Props) {
  const mode = MODES.find((item) => item.id === result.mode)!;
  const recipient = RECIPIENTS.find((item) => item.id === result.recipient)!;
  const canSpeak = speech.supported && speech.voices.length > 0;

  return (
    <section
      className={`result-panel stage-enter ${result.mode === "super" ? "super-result" : ""}`}
      aria-labelledby="result-title"
    >
      <div className="result-status">
        <span className="success-label">
          <span>
            <Check size={12} aria-hidden="true" />
          </span>
          謝罪の準備が整いました
        </span>
        <span
          className={`result-mode ${result.mode === "super" ? "pro-badge" : ""}`}
        >
          {result.mode === "super" && <Zap size={11} aria-hidden="true" />}
          {result.mode === "super" ? "APOLOGY PRO MAX" : `${mode.label}モード`}
        </span>
      </div>
      <div className="apology-answer">
        <span className="quote-decoration" aria-hidden="true">
          “
        </span>
        <h2 id="result-title" tabIndex={-1}>
          AIが導き出した答え
        </h2>
        <p
          id="apology-output"
          className="apology-text"
          data-testid="apology-output"
        >
          {result.text}
        </p>
        <p className="result-punchline">
          {result.mode === "super"
            ? "圧倒的な処理能力で、少しだけ長くなりました。"
            : result.mode === "polite"
              ? "言葉づかいに、全リソースを注ぎました。"
              : "熟考しました。以上です。"}
        </p>
      </div>

      <div className="result-metrics" aria-label="ジョークとしての分析結果">
        <div>
          <span>誠意</span>
          <strong>
            100<span>%</span>
          </strong>
        </div>
        <div>
          <span>言い訳</span>
          <strong>
            0<span>件</span>
          </strong>
        </div>
        <div>
          <span>問題の解決</span>
          <strong>未対応</strong>
        </div>
      </div>
      <p className="metrics-caption">
        ※ 数値は演出です。実際の評価ではありません。
      </p>

      <div className="result-actions">
        <button className="primary-button" onClick={onCopy}>
          {copied ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Copy size={17} aria-hidden="true" />
          )}
          {copied ? "コピーしました" : "謝罪文をコピー"}
        </button>
        <button className="secondary-button" onClick={onShare}>
          <Share2 size={17} aria-hidden="true" />
          {shareSupported ? "共有" : "リンクをコピー"}
        </button>
      </div>

      <div className="speech-panel">
        <div className="speech-topline">
          <div>
            <Volume2 size={16} aria-hidden="true" />
            <span>声にも、誠意を。</span>
          </div>
          <button
            className={`speech-button ${speech.speaking ? "is-speaking" : ""}`}
            disabled={!canSpeak}
            onClick={speech.speaking ? speech.stop : onSpeak}
          >
            {speech.speaking ? (
              <Square size={12} aria-hidden="true" />
            ) : (
              <Volume2 size={14} aria-hidden="true" />
            )}
            {speech.speaking ? "停止する" : "読み上げる"}
          </button>
        </div>
        <details className="voice-settings">
          <summary>
            <SlidersHorizontal size={13} aria-hidden="true" />
            音声と速度を調整<span>端末内の音声のみ</span>
          </summary>
          <div className="voice-controls">
            <label>
              声
              <select
                value={speech.voiceURI}
                onChange={(event) => speech.setVoiceURI(event.target.value)}
                disabled={!canSpeak}
              >
                {!speech.voices.length && (
                  <option value="">利用できる音声がありません</option>
                )}
                {speech.voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </label>
            <label>
              速さ
              <select
                value={speech.rate}
                onChange={(event) => speech.setRate(Number(event.target.value))}
              >
                <option value={0.5}>0.5× とてもゆっくり</option>
                <option value={0.75}>0.75× ゆっくり</option>
                <option value={1}>1.0× ふつう</option>
                <option value={1.25}>1.25× 少し早口</option>
                <option value={1.5}>1.5× 早口</option>
              </select>
            </label>
          </div>
        </details>
        {(!speech.supported || speech.error) && (
          <p className="speech-note" role="status">
            {!speech.supported
              ? "このブラウザは読み上げに対応していません。コピーしてお楽しみください。"
              : speech.error}
          </p>
        )}
        {speech.supported && !speech.voices.length && !speech.error && (
          <p className="speech-note" role="status">
            端末の音声を確認しています。音声がない場合はOSの音声設定をご確認ください。
          </p>
        )}
      </div>

      <div className="result-context">
        <span>{recipient.label}へ</span>
        <span>深刻度 {result.severity}%</span>
        <span>相談文は保存していません</span>
      </div>
      <div className="result-bottom">
        <button className="text-button" onClick={onAgain}>
          <RotateCcw size={14} aria-hidden="true" />
          もう一度、考えてもらう
        </button>
        <button className="text-button" onClick={onHistory}>
          <History size={14} aria-hidden="true" />
          履歴を見る
        </button>
      </div>
    </section>
  );
}
