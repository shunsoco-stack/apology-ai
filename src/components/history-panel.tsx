"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  History,
  LockKeyhole,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { MODES, RECIPIENTS } from "@/lib/apology";
import type { HistoryEntry } from "@/lib/history";

type Props = {
  history: HistoryEntry[];
  totalCount: number;
  todayCount: number;
  onBack: () => void;
  onDelete: () => void;
  onCopy: (entry: HistoryEntry) => void;
  onOpen: (entry: HistoryEntry) => void;
};
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function HistoryPanel({
  history,
  totalCount,
  todayCount,
  onBack,
  onDelete,
  onCopy,
  onOpen,
}: Props) {
  return (
    <section
      className="history-panel stage-enter"
      aria-labelledby="history-title"
    >
      <div className="history-heading">
        <div>
          <span className="eyebrow">YOUR APOLOGY ARCHIVE</span>
          <h2 id="history-title" tabIndex={-1}>
            積み重ねた、すみません。
          </h2>
          <p>言葉は似ていても、ひとつひとつの反省です。</p>
        </div>
        <button className="secondary-button back-button" onClick={onBack}>
          <Plus size={16} aria-hidden="true" />
          新しく謝る
        </button>
      </div>
      <div className="history-stats">
        <div>
          <span>これまでの謝罪</span>
          <strong>
            {totalCount.toLocaleString("ja-JP")}
            <small>回</small>
          </strong>
        </div>
        <div>
          <span>本日の謝罪</span>
          <strong>
            {todayCount.toLocaleString("ja-JP")}
            <small>回</small>
          </strong>
        </div>
        <div className="history-local">
          <LockKeyhole size={18} aria-hidden="true" />
          <span>
            このブラウザだけに保存
            <br />
            <small>相談文は記録していません</small>
          </span>
        </div>
      </div>
      <div className="history-toolbar">
        <span>
          最近の謝罪 <b>{history.length}</b>
          <small>最新50件まで</small>
        </span>
        <button
          className="text-button danger-text"
          onClick={onDelete}
          disabled={!history.length && totalCount === 0}
        >
          <Trash2 size={14} aria-hidden="true" />
          履歴を削除
        </button>
      </div>
      {history.length ? (
        <ol className="history-list">
          {history.map((entry) => {
            const mode = MODES.find((item) => item.id === entry.mode)!;
            return (
              <li key={entry.id}>
                <div
                  className={`history-entry-icon ${entry.mode === "super" ? "super-icon" : ""}`}
                >
                  {entry.mode === "super" ? (
                    <Zap size={19} aria-hidden="true" />
                  ) : (
                    <History size={19} aria-hidden="true" />
                  )}
                </div>
                <div className="history-entry-content">
                  <div className="history-entry-meta">
                    <span>{mode.label}</span>
                    <span>
                      {
                        RECIPIENTS.find((item) => item.id === entry.recipient)
                          ?.label
                      }
                      へ
                    </span>
                    <time dateTime={entry.createdAt}>
                      {dateFormatter.format(new Date(entry.createdAt))}
                    </time>
                  </div>
                  <p>{entry.text}</p>
                </div>
                <div className="history-entry-actions">
                  <button
                    className="icon-button"
                    aria-label={`${mode.label}の謝罪文をコピー`}
                    title="コピー"
                    onClick={() => onCopy(entry)}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`${mode.label}の謝罪結果を開く`}
                    title="結果を開く"
                    onClick={() => onOpen(entry)}
                  >
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="history-empty">
          <span>
            <History size={29} strokeWidth={1.4} aria-hidden="true" />
          </span>
          <h3>まだ、謝っていません。</h3>
          <p>まっさらな気持ちで、最初の「すみません」を。</p>
          <button className="primary-button" onClick={onBack}>
            <Plus size={16} aria-hidden="true" />
            最初の謝罪をつくる
          </button>
        </div>
      )}
      <p className="history-footnote">
        履歴と回数は端末・ブラウザごとに異なります。履歴を削除すると、累計・本日の回数もリセットされます。
      </p>
      <button className="text-button history-return" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" />
        謝罪をつくるに戻る
      </button>
    </section>
  );
}
