import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | 謝罪AI",
  description: "広告配信（忍者AdMax）と、このアプリが保存するデータについて。",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", lineHeight: 1.9 }}>
      <p style={{ margin: "0 0 12px", fontSize: 12, letterSpacing: "0.12em" }}>PRIVACY</p>
      <h1 style={{ margin: "0 0 24px", fontSize: "clamp(28px, 5vw, 36px)", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.5 }}>
        プライバシーポリシー
      </h1>
      <section>
        <h2>広告配信（忍者AdMax）とオプトアウト</h2>
        <p>
          本番環境のトップページ末尾では、忍者ツールズ株式会社が提供する広告配信サービス「忍者AdMax」を利用しています。忍者AdMaxおよびその提携事業者は、広告の配信、効果測定、不正防止などのため、Cookie等の技術を利用して、アクセス日時、閲覧したページのURL、リファラー、IPアドレス、ブラウザ・端末に関する情報などを取得する場合があります。取得された情報は、各事業者のプライバシーポリシー等に従って取り扱われます。
        </p>
        <p>
          Cookie等による情報の取得を望まない場合は、ブラウザの設定でCookieを無効にする、または削除することで拒否（オプトアウト）できます。ただし、一部の機能が正常に利用できなくなる場合があります。オプトアウトの方法と提携事業者については、忍者ツールズの
          <a href="https://corp.ninja.co.jp/privacy/cookie/" target="_blank" rel="noopener noreferrer">
            「Cookie等の技術や広告用IDの利用について」
          </a>
          を、個人情報の取扱いについては
          <a href="https://corp.ninja.co.jp/privacy/" target="_blank" rel="noopener noreferrer">
            忍者ツールズのプライバシーポリシー
          </a>
          をご確認ください。
        </p>
        <h2>このアプリが保存するデータ</h2>
        <p>このアプリは生成AIのAPIを使いません。相談文は端末のメモリ内だけで扱い、生成開始時に消去します。サーバーへの送信も、localStorage への保存も行いません。謝罪文・選択条件・日時・回数だけをこのブラウザに保存します（最大50件）。広告のために入力内容や保存済みの記録を送信する処理はありません。個人情報や機密情報は入力しないでください。</p>
      </section>
      <p style={{ marginTop: 36 }}>
        <Link href="/">トップへ戻る</Link>
      </p>
    </main>
  );
}
