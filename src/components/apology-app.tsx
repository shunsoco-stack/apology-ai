"use client";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  Download,
  Heart,
  History,
  Info,
  Leaf,
  LockKeyhole,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useApologyStore } from "@/hooks/use-apology-store";
import { useSpeech } from "@/hooks/use-speech";
import { useTheme } from "@/hooks/use-theme";
import { trackApology } from "@/lib/analytics";
import type { ApologyMode, Recipient } from "@/lib/apology";
import type { HistoryEntry } from "@/lib/history";
import { ApologyMark } from "./apology-mark";
import ApologyForm from "./apology-form";
import ProcessingPanel from "./processing-panel";
import ResultPanel from "./result-panel";
import HistoryPanel from "./history-panel";

type Stage = "input" | "processing" | "result";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const noSubscription = () => () => {};
const onlineSubscription = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

export default function ApologyApp() {
  const store = useApologyStore();
  const speech = useSpeech();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<"compose" | "history">("compose");
  const [stage, setStage] = useState<Stage>("input");
  const [input, setInput] = useState("");
  const [recipient, setRecipient] = useState<Recipient>("friend");
  const [severity, setSeverity] = useState(50);
  const [mode, setMode] = useState<ApologyMode>("normal");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const installDialog = useRef<HTMLDialogElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generation = useRef(0);
  const shareSupported = useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === "function",
    () => false,
  );
  const online = useSyncExternalStore(
    onlineSubscription,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    const receiveInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const installed = () => {
      setInstallEvent(null);
      setToast("ホーム画面に追加されました。");
    };
    window.addEventListener("beforeinstallprompt", receiveInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", receiveInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4800);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 2500);
    return () => clearTimeout(timer);
  }, [copiedId]);
  useEffect(() => {
    const heading =
      view === "history"
        ? "history-title"
        : stage === "processing"
          ? "processing-title"
          : stage === "result"
            ? "result-title"
            : null;
    if (heading)
      document.getElementById(heading)?.focus({ preventScroll: true });
  }, [view, stage]);

  function cancelProcessing() {
    generation.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function resetComposer() {
    cancelProcessing();
    speech.stop();
    setView("compose");
    setStage("input");
    setResult(null);
    setError("");
    setCopiedId(null);
  }

  function openHistory() {
    cancelProcessing();
    speech.stop();
    if (stage === "processing") setStage("input");
    setView("history");
  }

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage === "processing") return;
    if (!input.trim()) {
      setError("ひと言だけでも、事情を教えてください。");
      inputRef.current?.focus();
      return;
    }
    cancelProcessing();
    speech.stop();
    setError("");
    setInput(""); // The consultation is intentionally neither persisted nor sent anywhere.
    setStage("processing");
    setStep(0);
    const requestId = generation.current;
    [1000, 2050, 3100].forEach((delay, index) =>
      timers.current.push(
        setTimeout(() => {
          if (requestId === generation.current) setStep(index + 1);
        }, delay),
      ),
    );
    timers.current.push(
      setTimeout(() => {
        if (requestId !== generation.current) return;
        const entry = store.addApology({ mode, recipient, severity });
        setResult(entry);
        setCopiedId(null);
        setStage("result");
        trackApology("generate", mode);
      }, 4350),
    );
  }

  async function copyEntry(entry: HistoryEntry, withUrl = false) {
    const text = withUrl
      ? `${entry.text}\n\n謝罪AI — AI風のジョークアプリ\n${window.location.origin}/`
      : entry.text;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      trackApology("copy", entry.mode);
      setCopiedId(entry.id);
      setToast(
        withUrl
          ? "謝罪文とアプリのリンクをコピーしました。"
          : "謝罪文をコピーしました。誠意も添えてどうぞ。",
      );
    } catch {
      setToast(
        "コピーできませんでした。謝罪文を長押し、またはドラッグで選択してコピーしてください。",
      );
    }
  }

  async function share() {
    if (!result) return;
    if (!shareSupported) {
      await copyEntry(result, true);
      return;
    }
    try {
      await navigator.share({
        title: "謝罪AI",
        text: `${result.text}\n— 考え抜いた結果、すみません。AI風のジョークアプリです。`,
        url: `${window.location.origin}/`,
      });
      trackApology("share", result.mode);
      setToast("共有しました。謝罪の輪が広がりました。");
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      )
        return;
      setToast("共有できませんでした。「謝罪文をコピー」をお試しください。");
    }
  }

  async function install() {
    if (!installEvent) {
      installDialog.current?.showModal();
      return;
    }
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch {
      setInstallEvent(null);
      installDialog.current?.showModal();
    }
  }

  function openEntry(entry: HistoryEntry) {
    speech.stop();
    setResult(entry);
    setCopiedId(null);
    setStage("result");
    setView("compose");
  }

  const stepNumber = stage === "input" ? 0 : stage === "processing" ? 1 : 2;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        メインコンテンツへ移動
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={resetComposer}
            aria-label="謝罪AI ホーム"
          >
            <span className="brand-mark">
              <ApologyMark />
            </span>
            <span>
              謝罪<span className="brand-ai">AI</span>
              <small>BETA</small>
            </span>
          </button>
          <nav aria-label="メインナビゲーション" className="main-nav">
            <button
              onClick={resetComposer}
              className={view === "compose" ? "active" : ""}
              aria-current={view === "compose" ? "page" : undefined}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>謝罪をつくる</span>
            </button>
            <button
              onClick={openHistory}
              className={view === "history" ? "active" : ""}
              aria-current={view === "history" ? "page" : undefined}
            >
              <History size={15} aria-hidden="true" />
              <span>謝罪の履歴</span>
              {store.history.length > 0 && (
                <span className="nav-count">{store.history.length}</span>
              )}
            </button>
          </nav>
          <div className="header-actions">
            <span className="local-label">
              <span />
              LOCAL ONLY
            </span>
            <button
              className="icon-button theme-button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "ライトモードに切り替える"
                  : "ダークモードに切り替える"
              }
              title={theme === "dark" ? "ライトモード" : "ダークモード"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a
              className="icon-button github-link"
              href="https://github.com/shunsoco-stack/apology-ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHubでソースコードを開く（新しいタブ）"
            >
              <Code2 size={18} />
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-badge">
              <Sparkles size={12} aria-hidden="true" />
              <span>誠意だけは、最先端。</span>
              <span className="badge-line" />
              <span>AI風のジョークアプリ</span>
            </div>
            <h1 id="hero-title">
              考え抜いた結果、
              <br />
              <span>すみません。</span>
              <span className="hero-period" aria-hidden="true">
                *
              </span>
            </h1>
            <p>
              どんな悩みにも、たったひとつの答えを。
              <br className="mobile-break" />
              謝ることしかできない、まったく新しいAI体験。
            </p>
          </div>
          <div className="hero-note">
            <span className="hero-note-icon">
              <Heart size={15} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p>
              問題は、解決しません。
              <br />
              でも、ちゃんと謝ります。
            </p>
            <span className="note-line" />
            <span>THOUGHTFULLY USELESS.</span>
          </div>
        </section>

        {!online && (
          <p className="notice offline-notice" role="status">
            <WifiOff size={16} aria-hidden="true" />
            オフラインです。謝罪の生成と保存は、そのまま使えます。
          </p>
        )}
        {store.ready && !store.storageAvailable && (
          <p className="notice storage-notice" role="status">
            <Info size={16} aria-hidden="true" />
            このブラウザでは履歴を保存できません。今の画面では使えますが、閉じると履歴と回数は消えます。
          </p>
        )}

        {view === "history" ? (
          <HistoryPanel
            history={store.history}
            totalCount={store.totalCount}
            todayCount={store.todayCount}
            onBack={resetComposer}
            onDelete={() => deleteDialog.current?.showModal()}
            onCopy={(entry) => {
              void copyEntry(entry);
            }}
            onOpen={openEntry}
          />
        ) : (
          <div className="workspace-grid">
            <div className="workspace-card">
              <ol className="stepper" aria-label="謝罪生成のステップ">
                {["相談する", "考える", "謝る"].map((label, index) => (
                  <li
                    key={label}
                    className={
                      index === stepNumber
                        ? "current"
                        : index < stepNumber
                          ? "complete"
                          : ""
                    }
                    aria-current={index === stepNumber ? "step" : undefined}
                  >
                    <span className="step-number">
                      {index < stepNumber ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        `0${index + 1}`
                      )}
                    </span>
                    <span>{label}</span>
                    {index < 2 && (
                      <ChevronRight
                        size={12}
                        className="step-chevron"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ))}
              </ol>
              {stage === "input" && (
                <ApologyForm
                  input={input}
                  setInput={(value) => {
                    setInput(value);
                    if (error) setError("");
                  }}
                  recipient={recipient}
                  setRecipient={setRecipient}
                  severity={severity}
                  setSeverity={setSeverity}
                  mode={mode}
                  setMode={setMode}
                  onSubmit={generate}
                  error={error}
                  inputRef={inputRef}
                />
              )}
              {stage === "processing" && (
                <ProcessingPanel
                  step={step}
                  onCancel={() => {
                    resetComposer();
                    setToast("生成を中止しました。謝罪回数には含まれません。");
                  }}
                />
              )}
              {stage === "result" && result && (
                <ResultPanel
                  result={result}
                  speech={speech}
                  shareSupported={shareSupported}
                  copied={copiedId === result.id}
                  onCopy={() => {
                    void copyEntry(result);
                  }}
                  onShare={() => {
                    void share();
                  }}
                  onSpeak={() =>
                    speech.speak(result.text, () =>
                      trackApology("speak", result.mode),
                    )
                  }
                  onAgain={resetComposer}
                  onHistory={openHistory}
                />
              )}
            </div>

            <aside className="side-panel" aria-label="謝罪AIについて">
              <div className="intelligence-card">
                <div className="intelligence-top">
                  <span>APOLOGY INTELLIGENCE</span>
                  <span className="engine-status">
                    <span />
                    稼働中
                  </span>
                </div>
                <div
                  className={`mascot-scene ${stage === "processing" ? "is-thinking" : ""}`}
                  aria-hidden="true"
                >
                  <span className="mascot-orbit orbit-a" />
                  <span className="mascot-orbit orbit-b" />
                  <span className="mascot-spark spark-a">+</span>
                  <span className="mascot-spark spark-b">+</span>
                  <span className="mascot-dot" />
                  <div className="mascot-body">
                    <ApologyMark animated={stage === "processing"} />
                  </div>
                  <span className="mascot-shadow" />
                </div>
                <div className="intelligence-copy">
                  <span className="mini-label">DESIGNED TO SAY SORRY.</span>
                  <h2>
                    どんな相談も。
                    <br />
                    ひとつの答え。
                  </h2>
                  <p>
                    複雑な事情も、言いづらいことも。
                    <br />
                    すべてを「すみません」に変える技術。
                  </p>
                </div>
                <div className="intelligence-footer">
                  <Cpu size={14} aria-hidden="true" />
                  <span>生成AI API不使用</span>
                  <span className="footer-dot">·</span>
                  <span>利用料 ¥0</span>
                </div>
              </div>
              <div className="count-card">
                <div className="count-card-heading">
                  <History size={15} aria-hidden="true" />
                  <span>あなたの誠意の積み重ね</span>
                </div>
                <div className="count-grid">
                  <div>
                    <span>これまでの謝罪</span>
                    <strong>
                      {store.ready
                        ? store.totalCount.toLocaleString("ja-JP")
                        : "–"}
                      <small>回</small>
                    </strong>
                  </div>
                  <div>
                    <span>本日の謝罪</span>
                    <strong>
                      {store.ready
                        ? store.todayCount.toLocaleString("ja-JP")
                        : "–"}
                      <small>回</small>
                    </strong>
                  </div>
                </div>
                <button className="count-history-link" onClick={openHistory}>
                  謝罪の履歴を見る
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="privacy-aside">
                <ShieldCheck size={18} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <h3>あなたの秘密は、あなたの端末に。</h3>
                  <p>
                    入力内容をサーバーに送ることはありません。個人情報や機密情報は入力しないでください。
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}

        <div className="promise-strip" aria-label="アプリの特徴">
          <span>
            <LockKeyhole size={14} aria-hidden="true" />
            アカウント不要
          </span>
          <span>
            <Leaf size={14} aria-hidden="true" />
            AIの利用料金ゼロ
          </span>
          <span>
            <ShieldCheck size={14} aria-hidden="true" />
            相談文の送信なし
          </span>
        </div>
        <section className="safety-note" aria-label="ご利用にあたって">
          <Info size={15} aria-hidden="true" />
          <p>
            <strong>AI風のジョークアプリです。</strong>
            実際のトラブル、法的問題、重大な謝罪には使用しないでください。
            <br />
            表示される分析・性能・数値はすべて演出です。入力内容は謝罪文に反映されません。
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <span className="footer-brand">謝罪AI</span>
          <span>Made with sincerity. And nothing else.</span>
        </div>
        <div>
          <button
            className="text-button"
            onClick={() => infoDialog.current?.showModal()}
          >
            このアプリについて
          </button>
          <button
            className="text-button install-button"
            onClick={() => {
              void install();
            }}
          >
            <Download size={13} aria-hidden="true" />
            ホーム画面に追加
          </button>
          <span className="version">v1.0</span>
        </div>
      </footer>

      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <>
            <span className="toast-icon">
              <Info size={16} aria-hidden="true" />
            </span>
            <span>{toast}</span>
            <button
              className="icon-button"
              aria-label="通知を閉じる"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>

      <dialog
        ref={deleteDialog}
        className="modal"
        aria-labelledby="delete-title"
      >
        <div className="modal-icon danger">
          <History size={23} aria-hidden="true" />
        </div>
        <h2 id="delete-title">謝罪の履歴を削除しますか？</h2>
        <p>
          このブラウザのすべての履歴を削除し、
          <strong>累計・本日の謝罪回数も0回に戻します。</strong>
          <br />
          この操作は取り消せません。
        </p>
        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={() => deleteDialog.current?.close()}
          >
            キャンセル
          </button>
          <button
            className="danger-button"
            onClick={() => {
              store.clearHistory();
              setResult(null);
              setStage("input");
              setCopiedId(null);
              deleteDialog.current?.close();
              setToast("履歴を削除し、謝罪回数をリセットしました。");
            }}
          >
            削除してリセット
          </button>
        </div>
      </dialog>

      <dialog
        ref={infoDialog}
        className="modal about-modal"
        aria-labelledby="about-title"
      >
        <button
          className="icon-button modal-close"
          aria-label="説明を閉じる"
          onClick={() => infoDialog.current?.close()}
        >
          <X size={19} />
        </button>
        <span className="modal-brand-mark">
          <ApologyMark />
        </span>
        <span className="eyebrow">THOUGHTFULLY USELESS.</span>
        <h2 id="about-title">できることは、謝ること。</h2>
        <p>
          謝罪AIは、いかにも賢そうに考えた末に、ひと言だけ謝る
          <strong>AI風のジョークアプリです。</strong>
          表示される処理は約4秒の演出で、生成AI APIは使用していません。
        </p>
        <h3>入力内容とプライバシー</h3>
        <p>
          相談文は端末のメモリ内だけで扱い、生成開始時に消去します。サーバーへの送信も、localStorageへの保存も行いません。個人情報や機密情報は入力しないでください。
        </p>
        <h3>履歴と音声</h3>
        <p>
          謝罪文・選択条件・日時・回数だけをこのブラウザに保存します。最大50件。削除すると回数もリセットされます。読み上げは端末内の音声に限り、音声がない環境では利用できません。
        </p>
        <h3>アクセス計測について</h3>
        <p>
          Vercel
          Analyticsでページ閲覧と「生成・コピー・読み上げ・共有」の操作を計測する実装です。相談文・相手・深刻度は送信しません。操作イベントの集計はVercelのプランによって制限されます。Do
          Not Track / Global Privacy Controlが有効な場合は計測しません。
        </p>
        <p className="about-warning">
          実際のトラブル、法的問題、重大な謝罪のためのアドバイスは提供しません。大切な謝罪には、ご自身の言葉を。
        </p>
        <button
          className="primary-button"
          onClick={() => infoDialog.current?.close()}
        >
          わかりました
        </button>
      </dialog>

      <dialog
        ref={installDialog}
        className="modal"
        aria-labelledby="install-title"
      >
        <button
          className="icon-button modal-close"
          aria-label="追加方法を閉じる"
          onClick={() => installDialog.current?.close()}
        >
          <X size={19} />
        </button>
        <div className="modal-icon">
          <Download size={24} aria-hidden="true" />
        </div>
        <h2 id="install-title">いつでも、すぐに謝れます。</h2>
        <p>
          ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。
        </p>
        <p>
          Safariでは共有メニューから「ホーム画面に追加」を選べます。追加機能の有無はブラウザによって異なります。
        </p>
        <p className="install-caption">
          対応ブラウザでは、一度読み込むとオフラインでも利用できます。初回アクセスには通信が必要です。
        </p>
        <button
          className="primary-button"
          onClick={() => installDialog.current?.close()}
        >
          <Plus size={15} aria-hidden="true" />
          わかりました
        </button>
      </dialog>
    </div>
  );
}
