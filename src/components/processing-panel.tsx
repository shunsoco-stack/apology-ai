import { Check, Cpu, LoaderCircle, X } from "lucide-react";
import { PROCESSING_STEPS } from "@/lib/apology";
import { ApologyMark } from "./apology-mark";

const stepNotes = [
  "あらゆる可能性を検討しています",
  "念のため、こちらにあると仮定します",
  "「でも」と「だって」を取り除いています",
  "誠意を、できる限り短くまとめています",
];

export default function ProcessingPanel({
  step,
  onCancel,
}: {
  step: number;
  onCancel: () => void;
}) {
  return (
    <section
      className="processing-panel stage-enter"
      aria-labelledby="processing-title"
    >
      <div className="processing-orbit" aria-hidden="true">
        <span className="orbit-ring ring-one" />
        <span className="orbit-ring ring-two" />
        <div className="processing-core">
          <ApologyMark animated />
        </div>
        <span className="orbit-particle" />
      </div>
      <span className="eyebrow">
        <Cpu size={13} aria-hidden="true" /> APOLOGY ENGINE 1.0
      </span>
      <h2 id="processing-title" tabIndex={-1}>
        誠意を、計算しています。
      </h2>
      <p className="processing-lead">膨大な反省の末に、最適なひと言を。</p>
      <ol className="processing-steps">
        {PROCESSING_STEPS.map((label, index) => (
          <li
            key={label}
            className={
              index < step ? "done" : index === step ? "active" : "pending"
            }
            aria-current={index === step ? "step" : undefined}
          >
            <span className="processing-step-icon">
              {index < step ? (
                <Check size={15} />
              ) : index === step ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <span className="tiny-dot" />
              )}
            </span>
            <span>{label}</span>
            <span className="processing-step-status">
              {index < step ? "完了" : index === step ? "処理中" : "待機"}
            </span>
          </li>
        ))}
      </ol>
      <p className="processing-live" role="status" aria-live="polite">
        {stepNotes[step]}
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="謝罪の生成状況"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${(step + 1) * 25}%` }} />
      </div>
      <div className="processing-bottom">
        <span>※ AI処理に見える演出です</span>
        <button className="text-button" onClick={onCancel}>
          <X size={13} aria-hidden="true" />
          中止する
        </button>
      </div>
    </section>
  );
}
