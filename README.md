# 謝罪AI

**考え抜いた結果、すみません。**

どんな相談にも、最後は謝ることしかできないAI風のジョークアプリです。本格的に見える分析演出と、あまりにも短い結論のギャップを楽しめます。

**生成AI API不使用。** 外部AI、APIキー、データベースは不要。オリジナルの固定テンプレートを端末内で選ぶため、AIの生成料金は発生しません。

- 公開アプリ：公開確認後に記載
- GitHub：https://github.com/shunsoco-stack/apology-ai
- 紹介文：[docs/publish-copy.md](docs/publish-copy.md)
- セキュリティ：[docs/security.md](docs/security.md)
- 検証記録：[docs/verification.md](docs/verification.md)

## 体験

「何をしてしまいましたか？」に入力し、相手・深刻度・モードを選択。「状況を分析中 → 責任の所在を確認中 → 言い訳を削除中 → 謝罪を生成中」と約4.35秒かけて考えるふりをします。

| モード | 導き出した答え |
| --- | --- |
| 通常 | すみませんでした |
| 丁寧 | 大変申し訳ございませんでした |
| 超高性能 | このたびは誠に申し訳ございませんでした |

相談の中身・相手・深刻度は、謝罪文に反映されません。超高性能でも少し長くなるだけ。性能・誠意の数値はすべて演出です。

## 機能

- 友人／恋人／上司／家族／知らない人、深刻度0〜100、3モード
- 中止できる4段階の分析演出、二重生成の防止
- 文章コピー、Web Share API、非対応環境では共有リンクのコピー
- SpeechSynthesisでの読み上げ、端末内の声と0.5〜1.5倍速の選択、停止
- 累計・本日の謝罪回数、最新50件の履歴、削除確認
- localStorageの検証、破損時の復旧、保存拒否時のメモリ内継続
- モバイル対応、OS設定を引き継ぐダークモード、キーボード操作、読み上げ用ラベル
- `prefers-reduced-motion` / コントラスト・透明度の設定への配慮
- ホーム画面への追加、Service Workerによるオフライン動作
- 独自SVGアイコン、favicon、PNGアイコン、OG画像、manifest
- Vercel Analyticsの4操作イベント、CI・Secret Scan

## プライバシー・注意事項

**AI風のジョークアプリです。実際のトラブル、法的問題、重大な謝罪には使用しないでください。個人情報や機密情報を入力しないでください。**

相談文は端末のメモリ内だけで扱い、生成開始時に消去します。サーバー・localStorage・Analyticsには送信／保存しません。保存するのは固定謝罪文・選択条件・日時・回数だけです。履歴を削除すると、累計・本日の回数も0に戻ります。

本日の基準は端末のローカル日付です。複数タブの完全同時更新は最終書き込みが優先されます。読み上げは `localService === true` の音声のみを利用し、ない場合は利用不可を表示します。コピー・共有先の取り扱いはOSや共有先アプリに依存します。

初回表示には通信が必要です。PWAは本番ビルド・HTTPS（ローカルはlocalhost）で有効になり、読み込み済みのアプリは対応ブラウザでオフラインでも動きます。ブラウザがサイトデータを削除すると履歴とオフラインキャッシュも消えます。

### Analyticsと無料プランの制限

`apology_generate` / `apology_copy` / `apology_speak` / `apology_share` を、完了・成功したタイミングだけで送る実装です。付加情報はモードだけ。相談文・相手・深刻度は含めず、計測URLのquery/hashも除きます。DNTまたはGPCが有効なら計測を止めます。

**Vercel Hobbyではカスタムイベントのダッシュボード集計は利用できません。4操作の集計にはPro／Enterpriseが必要です。** 課金を避けるため有料プランへの変更はしていません。無料のページビュー計測と、アプリ内の端末別謝罪カウントは別機能です。[Vercel公式の制限](https://vercel.com/docs/analytics/limits-and-pricing)・[カスタムイベント](https://vercel.com/docs/analytics/custom-events)

## 開発

Node.js 22以上（CIは24）とnpmを使用します。環境変数の設定は不要です。

```bash
npm ci
npm run dev
```

`http://localhost:3026` を開きます。

```bash
npm run lint
npm run typecheck
npm test
npm run secret-scan
npm run build
npm start
```

`npm start` は `out/` を `http://127.0.0.1:3026` で配信するローカル専用プレビューです。静的エクスポートのため `next start` は使いません。

### 技術構成

Next.js 16.3.3（安定版）/ App Router / React 19 / TypeScript / Tailwind CSS 4 / Vitest。`output: "export"` で静的配信し、Server ActionsやAIへのHTTP通信を持ちません。日本語はシステムフォントを使い、外部フォントを読み込みません。

```text
src/app/          ページ、レイアウト、テーマ、manifest
src/components/   入力 → 演出 → 結果、履歴、PWA・Analytics
src/lib/          固定テンプレート、検証付き履歴、計測
src/hooks/        保存・音声・テーマのブラウザ連携
public/           アイコン、OG、Service Worker、スクリーンショット
tests/            コア・保存・ブラウザ機能・UI統合テスト
scripts/          Secret Scan、アセット生成、ローカルプレビュー
docs/             紹介文・セキュリティ・検証記録
```

アセットは既に生成・同梱済み。再生成する場合は `npm run assets` を実行します。OGの日本語描画には日本語フォントのある環境を利用してください。

### 公開

VercelへこのリポジトリのルートをNext.jsとしてインポートできます。Build Commandは `npm run build`。有料サービスへの接続やAIのキーは不要です。URLを変更した場合は `src/app/layout.tsx` の `metadataBase` と紹介文も更新してください。

CIはlint、typecheck、テスト、静的ビルド、依存監査、補助Secret Scan、GitleaksによるGit履歴検査を実行します。

## スクリーンショット

公開アプリをブラウザ操作して撮影した5画面です。保存先：`public/screenshots/`。

### 1. 入力画面

![入力画面](public/screenshots/01-input.png)

### 2. AI処理風画面

![4段階の分析演出](public/screenshots/02-processing.png)

### 3. 通常謝罪結果

![通常モードの謝罪結果](public/screenshots/03-normal-result.png)

### 4. 超高性能モード

![超高性能モードの謝罪結果](public/screenshots/04-super-mode.png)

### 5. 謝罪履歴

![謝罪履歴](public/screenshots/05-history.png)

## 掲載状況

Tsukutta：**未掲載**。紹介文とYOUTRUST用の投稿文は `docs/publish-copy.md` に用意しています。投稿は自動では行っていません。
