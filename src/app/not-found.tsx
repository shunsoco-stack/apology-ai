import Link from "next/link";
import { ApologyMark } from "@/components/apology-mark";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <span className="brand-mark">
        <ApologyMark />
      </span>
      <span className="eyebrow">404 · SORRY, AGAIN.</span>
      <h1>
        ページがありません。
        <br />
        すみませんでした。
      </h1>
      <p>謝罪は、トップページで受け付けています。</p>
      <Link className="primary-button" href="/">
        謝罪AIに戻る
      </Link>
    </main>
  );
}
