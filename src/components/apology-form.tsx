"use client";

import {
  ArrowRight,
  Briefcase,
  Check,
  Heart,
  LockKeyhole,
  MessageCircle,
  Sparkles,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import type { CSSProperties, FormEvent, RefObject } from "react";
import {
  MODES,
  RECIPIENTS,
  type ApologyMode,
  type Recipient,
} from "@/lib/apology";

const recipientIcons = {
  friend: MessageCircle,
  partner: Heart,
  boss: Briefcase,
  family: Users,
  stranger: UserRound,
};
const examples = ["待ち合わせに遅刻した", "プリンを食べた", "何もしていない"];

type Props = {
  input: string;
  setInput: (value: string) => void;
  recipient: Recipient;
  setRecipient: (value: Recipient) => void;
  severity: number;
  setSeverity: (value: number) => void;
  mode: ApologyMode;
  setMode: (value: ApologyMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function severityLabel(value: number) {
  if (value < 25) return "ちょっと気まずい";
  if (value < 50) return "そろそろ謝りたい";
  if (value < 75) return "けっこう気まずい";
  return "とにかく謝りたい";
}

export default function ApologyForm(props: Props) {
  const {
    input,
    setInput,
    recipient,
    setRecipient,
    severity,
    setSeverity,
    mode,
    setMode,
    onSubmit,
    error,
    inputRef,
  } = props;

  function setSeverityAt(clientX: number, element: HTMLInputElement) {
    const bounds = element.getBoundingClientRect();
    const progress =
      (clientX - bounds.left - 8) / Math.max(1, bounds.width - 16);
    setSeverity(Math.round(Math.max(0, Math.min(1, progress)) * 100));
  }

  return (
    <form onSubmit={onSubmit} className="apology-form stage-enter" noValidate>
      <div className="section-intro">
        <h2>まずは、事情を聞かせてください。</h2>
        <p>どんな内容でも、真摯に受け止めるふりをします。</p>
      </div>

      <div className="field-block">
        <div className="field-label-row">
          <label htmlFor="situation">何をしてしまいましたか？</label>
          <span className="field-optional">必須</span>
        </div>
        <div className={`textarea-wrap ${error ? "field-invalid" : ""}`}>
          <textarea
            id="situation"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="例：冷蔵庫にあったプリンを、勝手に食べました。"
            maxLength={500}
            rows={3}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? "situation-error situation-safety input-privacy"
                : "situation-safety input-privacy"
            }
          />
          <span
            className="character-count"
            aria-label={`${input.length}文字、最大500文字`}
          >
            {input.length}
            <span> / 500</span>
          </span>
        </div>
        {error && (
          <p id="situation-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        <p className="field-help" id="situation-safety">
          個人情報や機密情報は入力しないでください。
        </p>
        <div className="examples" aria-label="入力例">
          <span>たとえば</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setInput(example);
                inputRef.current?.focus();
              }}
            >
              {example}
              <ArrowRight size={11} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <fieldset className="field-block recipient-field">
        <legend>誰に謝りますか？</legend>
        <div className="recipient-options">
          {RECIPIENTS.map((item) => {
            const Icon = recipientIcons[item.id];
            return (
              <label
                key={item.id}
                className={`recipient-option ${recipient === item.id ? "selected" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="recipient"
                  value={item.id}
                  checked={recipient === item.id}
                  onChange={() => setRecipient(item.id)}
                />
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="field-block severity-field">
        <div className="field-label-row">
          <label htmlFor="severity">どのくらい深刻ですか？</label>
          <output htmlFor="severity" className="severity-output">
            {severityLabel(severity)}
          </output>
        </div>
        <input
          type="range"
          id="severity"
          min="0"
          max="100"
          value={severity}
          onChange={(event) => setSeverity(Number(event.target.value))}
          onKeyDown={(event) => {
            const changes: Record<string, number> = {
              ArrowLeft: -1,
              ArrowDown: -1,
              ArrowRight: 1,
              ArrowUp: 1,
              PageDown: -10,
              PageUp: 10,
            };
            if (
              event.key === "Home" ||
              event.key === "End" ||
              Object.hasOwn(changes, event.key)
            ) {
              event.preventDefault();
              setSeverity(
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? 100
                    : Math.max(0, Math.min(100, severity + changes[event.key])),
              );
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            setSeverityAt(event.clientX, event.currentTarget);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              setSeverityAt(event.clientX, event.currentTarget);
          }}
          aria-valuetext={`${severity}パーセント、${severityLabel(severity)}`}
          style={{ "--range-value": `${severity}%` } as CSSProperties}
        />
        <div className="range-labels" aria-hidden="true">
          <span>うっかり</span>
          <span>土下座レベル</span>
        </div>
      </div>

      <fieldset className="field-block mode-field">
        <legend>謝罪のクオリティ</legend>
        <div className="mode-options">
          {MODES.map((item) => (
            <label
              className={`mode-option ${mode === item.id ? "selected" : ""}`}
              key={item.id}
            >
              <input
                className="sr-only"
                type="radio"
                name="mode"
                value={item.id}
                checked={mode === item.id}
                onChange={() => setMode(item.id)}
              />
              <span className="mode-label">
                {item.id === "super" && <Zap size={13} aria-hidden="true" />}
                {item.label}
                {mode === item.id && (
                  <Check className="mode-check" size={13} aria-hidden="true" />
                )}
              </span>
              <span className="mode-description">
                {item.id === "normal"
                  ? "いつもの誠意"
                  : item.id === "polite"
                    ? "ワンランク上の誠意"
                    : "語彙が少し増えます"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button className="primary-button generate-button" type="submit">
        <Sparkles size={17} aria-hidden="true" />
        <span>AIに謝罪を考えてもらう</span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="input-privacy" id="input-privacy">
        <LockKeyhole size={12} aria-hidden="true" />
        入力内容は送信・保存せず、端末内だけで処理します。
      </p>
    </form>
  );
}
