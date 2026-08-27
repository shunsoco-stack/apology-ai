# 検証記録

検証日：2026-08-27（Asia/Tokyo）

## 公開先

| 項目 | URL・対象 |
| --- | --- |
| 公開アプリ | [apology-ai-iota.vercel.app](https://apology-ai-iota.vercel.app) |
| 公開リポジトリ | [shunsoco-stack/apology-ai](https://github.com/shunsoco-stack/apology-ai) |
| 初期公開コミット | [`a4f1a9a`](https://github.com/shunsoco-stack/apology-ai/commit/a4f1a9a) |
| 初期CI | [run #33074637572](https://github.com/shunsoco-stack/apology-ai/actions/runs/33074637572) — 全ジョブ成功、22:01:30 JST完了 |

以下は初期公開時と、その後の作業ツリーで実行済みの確認です。公開スクリーンショットやメタデータ等の最終差分は、末尾の追記欄で対象と再検証結果を分けて記録します。

初期公開後のアプリ本体の差分は、`metadataBase`を実際の公開URLへ合わせる訂正のみです。画面と操作の実装はスクリーンショット撮影時と同じです。Node.jsのengineを`24.x`へ合わせ、lockファイルも同期しています。

## ローカルの自動検証

| コマンド | 結果 |
| --- | --- |
| `npm run lint` | 成功、警告0 |
| `npm run typecheck` | 成功 |
| `npm test` | 4ファイル・90テスト成功 |
| `npm run build` | 成功、Next.js 16.3.3で静的エクスポート |
| `npm run secret-scan` | ソース検査成功 |
| `npm run secret-scan -- --self-test` | 検出15ケース・安全7ケース・パス境界検査成功 |
| `npm audit` | 依存の脆弱性0件（sharpを0.35.4へ更新後） |
| Gitleaks 8.30.0 / directory | 公開対象ソースの検出0件。[レポート](gitleaks-worktree.json) |
| Gitleaks 8.30.0 / Git history | 履歴の検出0件。[レポート](gitleaks-history.json) |

Gitleaksのディレクトリ検査は `.gitleaks.toml` で依存・ビルド・ローカル連携情報を除外。最初の無除外検査でNext.jsの `.next/` に自動生成されるプレビュー／暗号鍵6件を検出しましたが、Git管理・公開対象ではありません。公開するソース・設定・ドキュメントに検出はありません。

## テスト範囲

- 固定テンプレート3種、未知モードへの安全な対応、入力を受け取らない生成関数
- 履歴上限50件と累計の分離、日付変更、不正な保存データ、保存拒否、削除、別タブ更新の再読込
- ローカル音声の選択・切替・速度・停止・エラー・非対応環境
- テーマのOS連携・保存拒否、Analyticsのデータ制限・DNT・GPC
- 実際のUIで4段階の生成、中止・二重送信防止、コピー、共有・キャンセル・フォールバック
- 履歴の閲覧で回数が増えないこと、削除確認とキャンセル
- 深刻度の矢印／PageUp・Down／Home・End、0〜100の境界、結果と保存値への反映

## 実ブラウザ

- デスクトップ1280px／モバイル390pxのビューポートで、横方向のはみ出しがないことを確認。
- 入力検証、通常・超高性能の生成、リロード後の履歴保持を確認。
- 実クリップボードの内容が固定謝罪文と一致することを確認。
- Windowsの端末内日本語音声 `Haruka`を選択し、速度`0.75`で読み上げの開始と終了を確認。`localService`の音声を使用。
- ネイティブのスライダーをマウス・キーボードで操作し、深刻度が変わることを確認。

### オフライン試験

本番相当の静的配信を一度読み込み、Service Workerがページとアセットをキャッシュした状態で確認しました。

1. 静的配信サーバーを停止。
2. HTTPリクエストが接続失敗になることを確認。
3. 実ブラウザでページを再読み込み。
4. キャッシュ済み画面の表示、入力、謝罪生成、履歴の利用を確認。

これは、キャッシュ後に配信元へ接続できなくなった場合の試験です。初回アクセスからネットワークが使えない場合や、OSへのPWAインストール操作までを確認したものではありません。

## 公開確認

| 項目 | 実確認の結果 |
| --- | --- |
| 公開URL | HTTP 200 |
| セキュリティヘッダー | CSP、`X-Frame-Options: DENY`を確認 |
| Service Worker配信 | `/sw.js`のCache-Controlに`no-store`を確認 |
| GitHubの保護 | Secret scanning、Push protectionともenabled |
| 初期GitHub Actions | lint/types/tests/build/audit、Gitleaks historyを含む全ジョブsuccess |
| 無料Web Analytics | Vercel公式APIで`features.webAnalytics: true`を確認 |

公開URLでも、丁寧モードが「大変申し訳ございませんでした」と出力されること、深刻度のEndで100・Homeで0になること、コピー成功の表示、3件の履歴と回数表示を確認しました。

生成・コピー・読み上げ・共有のカスタムイベントには、操作名と許可したモードだけを渡します。相談内容・相手・深刻度・履歴は送りません。

**Hobbyでは4操作のカスタムイベント集計は利用できません。** Pro／Enterpriseが必要であり、有料プランへの変更は行っていません。無料Web Analyticsの有効化と、カスタムイベントの実装・テストを、ダッシュボード上の集計完了として扱いません。[Vercel公式の対応プラン](https://vercel.com/docs/analytics/custom-events)

### 公開アプリからのスクリーンショット

5枚すべて公開URLをブラウザで操作して撮影し、`public/screenshots/`へ保存しました。READMEにも同じ5ファイルを埋め込んでいます。

| 画面 | 撮影内容 | 保存ファイル |
| --- | --- | --- |
| 入力 | ライトモード | [01-input.jpg](../public/screenshots/01-input.jpg) |
| AI処理風画面 | 実際の処理中・「責任の所在を確認中」 | [02-processing.jpg](../public/screenshots/02-processing.jpg) |
| 通常謝罪結果 | ライトモード・固定謝罪文 | [03-normal-result.jpg](../public/screenshots/03-normal-result.jpg) |
| 超高性能モード | ダークモード・相手は上司・深刻度100% | [04-super-mode.jpg](../public/screenshots/04-super-mode.jpg) |
| 謝罪履歴 | ライトモード・通常／超高性能／丁寧の3件 | [05-history.jpg](../public/screenshots/05-history.jpg) |

## 未実施・確認範囲外

- OSの共有先アプリへの実送信・投稿。Web Share APIの成功・失敗・キャンセル・フォールバックは統合テストで確認済み。
- OSのインストールUIを使ったPWAインストール。キャッシュ後のオフライン動作は上記の実ブラウザ試験で確認済み。
- すべてのOS・ブラウザ・音声エンジンの組合せ。利用可能な端末内音声は環境によって異なる。
- Hobbyで非対応のカスタムイベント集計。有料プランへのアップグレードは未実施。

## 最終更新の追記

最終差分の公開後、実際に確認した結果だけを追記します。初期CIの成功を最終CIの成功として扱いません。

| 項目 | 最終結果 |
| --- | --- |
| 最終コミット／GitHub Actions | 最終差分の反映後に、コミットとCI実行URL・結果を追記 |
| 再デプロイ／メタデータ | 最終デプロイと公開先での再確認後に追記 |
| 公開アプリのスクリーンショット5枚 | 完了。上記5ファイルを保存、READMEへ埋め込み済み |
| 最終ローカル検証 | lint・typecheck・90テスト・buildの再実行成功。npm auditは脆弱性0件。補助Secret Scanは49ファイル検査／18項目除外・検出0件。自己テスト15検出・7安全ケース・パス境界も成功 |
