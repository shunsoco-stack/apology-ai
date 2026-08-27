# セキュリティとプライバシー

謝罪AIは、**生成AI APIを使用しないAI風のジョークアプリ**です。実際のトラブル、法的問題、重大な謝罪に使用しないでください。個人情報や機密情報を入力しないでください。

公開先：[apology-ai-iota.vercel.app](https://apology-ai-iota.vercel.app) ／ [GitHub](https://github.com/shunsoco-stack/apology-ai)

## 入力と処理

- 入力した相談内容は画面のメモリ内だけで扱います。謝罪の生成関数は相談内容を引数に取りません。
- サーバー、生成AI API、Analytics、ブラウザストレージへ相談内容を送りません。入力文をURLやアプリのログに含めません。
- 出力はモード別の固定謝罪テンプレートです。相手や深刻度から、個人情報を含む文章を組み立てません。
- Next.jsの静的エクスポートで配信します。アプリ用のデータベース、認証、サーバー処理、APIキーは不要です。
- 画面の表示に使うHTML・JavaScript等の取得と、利用可能な場合のVercel Analyticsには通信が発生します。「入力を送信しない」は「一切通信しない」という意味ではありません。

## 端末に保存するデータ

| 保存場所 | 内容 | 削除方法 |
| --- | --- | --- |
| localStorage: `apology-ai:history:v1` | 固定謝罪文、モード、相手の分類、深刻度、生成日時、ID、累計回数、本日の回数 | 「履歴を削除」で履歴と回数をまとめてリセット |
| localStorage: `apology-ai:theme` | ライト／ダーク表示の選択 | ブラウザのサイトデータ削除 |
| Cache Storage | 公開HTMLと許可した静的アセット | ブラウザのサイトデータ削除／Service Worker更新 |

履歴は最大50件です。累計と本日の回数は50件の上限とは別に管理します。本日は端末のローカル日付を基準にし、日付変更、画面復帰、別タブの更新で再確認します。

保存値はスキーマを検証し、不正な型、未知のモード、固定文と異なる文章、未来の日時、重複ID等を除外します。未知のフィールドは引き継ぎません。localStorageが拒否された場合はメモリ内で継続し、保存できないことを画面へ通知します。保存済みデータの削除もブラウザに拒否された場合は、ブラウザの設定からサイトデータを削除してください。

同一オリジンのスクリプトや端末の利用者は、ブラウザ内の保存データへアクセスできる場合があります。履歴は暗号化保管庫ではありません。共有端末で利用後は履歴を削除してください。複数タブの更新は書き込み直前に再読込しますが、完全に同時の書き込みには排他制御を行わず、最終書き込みが優先されます。

Service Workerは公開ページと許可した同一オリジンの静的アセットだけをキャッシュします。相談内容、API、Analytics、外部オリジン、GET以外のリクエストはキャッシュしません。

## 読み上げ・コピー・共有

- SpeechSynthesisで、ブラウザが `localService === true` と報告する端末内音声だけを選択します。利用可能な音声がなければ案内を表示し、外部音声サービスへ自動で切り替えません。
- 読み上げ対象は固定謝罪文です。音声や速度の設定は画面のメモリ内で管理します。端末・ブラウザによって利用可能な音声は異なります。
- コピーは固定謝罪文をクリップボードへ書き込みます。共有はユーザーが明示的に操作したときだけ実行し、固定謝罪文とアプリのURLを渡します。相談内容は含めません。
- 共有先アプリやクリップボードの取り扱いは、このアプリの管理範囲外です。

## Vercel Analytics

アプリ独自の計測は、次の操作名と許可したモード `normal / polite / super` だけです。相談内容、相手、深刻度、履歴、音声名はカスタムイベントへ含めません。

| 操作 | イベント |
| --- | --- |
| 生成 | `apology_generate` |
| コピー | `apology_copy` |
| 読み上げ | `apology_speak` |
| 共有 | `apology_share` |

Vercel Web Analyticsのページビュー等も対象になります。同サービスは匿名化した集計データを扱い、Cookieを使用しない方式です。[公式説明](https://vercel.com/docs/analytics)

アプリの計測は本番ビルドだけで有効です。Global Privacy ControlまたはDo Not Trackを検出した場合は送信を止めます。`beforeSend`で計測URLのクエリとハッシュを除きます。計測がブロックされても謝罪機能は継続します。

**4種類のカスタムイベントをVercelの画面で集計するには、Web Analyticsの有効化とPro／Enterpriseプランが必要です。Hobbyでカスタムイベント集計は利用できません。** APIキーなしで動作するアプリ本体とは別のサービス制約です。このリポジトリから有料プランへの変更や課金契約は行いません。[カスタムイベント](https://vercel.com/docs/analytics/custom-events)・[プランと使用量](https://vercel.com/docs/analytics/limits-and-pricing)

2026-08-27時点で、公開プロジェクトの無料Web Analyticsが有効であることをVercel公式APIの `features.webAnalytics: true` で確認しました。有料プランへは変更していません。4操作の送信処理は実装・テスト済みですが、Hobby上でのカスタムイベント集計完了を意味するものではありません。

## 配信時の保護

`vercel.json`で次のレスポンスヘッダーを設定します。公開先での適用確認は、下の検査記録に残します。

- CSP: 基本は同一オリジンとし、スクリプト・接続先に必要なVercel計測用オリジンを許可。
- `object-src 'none'`、`frame-ancestors 'none'`、`form-action 'none'`。
- `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、Referrer-Policy。
- Permissions-Policyでカメラ、マイク、位置情報を無効化。

静的HTMLのNext.js起動コードとテーマ初期化のため、現状のCSPはスクリプトとスタイルに `'unsafe-inline'` を許可します。nonceやハッシュだけに限定した厳格なCSPではありません。相談内容をHTMLやスクリプトとして挿入せず、Reactの通常のテキスト表示を使います。

## Secret Scan

`npm run secret-scan`は、Node.jsだけで動く補助スキャナーです。スクリプトの位置からこのリポジトリを検査対象に固定し、ソース、ドキュメント、設定等のテキストを走査します。

- `node_modules`、`.git`、`.next`、`out`、`.vercel`、`.local`、個人用ツール設定、キャッシュ、テスト生成物等を除外します。
- シンボリックリンクを追跡せず、対象パスがリポジトリ内であることを確認します。ユーザーのホーム、SSH設定、ブラウザプロファイル等を探索しません。
- 実際の `.env*`、秘密鍵・キーストア候補のファイルは、内容を読まずに存在を指摘します。`.env.example`等のサンプルはテキストとして検査します。
- 秘密鍵ヘッダー、主要APIトークン、認証値、認証情報の代入、パスワード付き接続URL等の既知パターンを検査します。
- 検出内容は**相対パス・行番号・ルール名だけ**を出力し、値や該当行は出力しません。行番号0はファイル全体・読込・対象範囲の問題を表します。
- テキストが2 MiBを超える場合や読み取れない場合は、未検査として失敗させます。`--self-test`はメモリ内の合成データで検出と非検出、Windowsを含むパス境界を確認します。

パターン検査には見落とし・誤検知があります。画像、エンコードした値、独自形式、除外したファイル、Git履歴全体をこのスキャナーだけで保証しません。**検査成功は「秘密情報が絶対に存在しない」という証明ではありません。**

GitHub Actionsは、この検査に加えて公式Gitleaks Action v3とGitleaks 8.30.0でGitの対象範囲を検査します。ActionはコミットSHA固定、出力はGitleaksのredact機能を使用し、PRコメント・検査成果物のアップロード・サマリーを無効化しています。個人所有リポジトリではGitleaks Actionのライセンスキーは不要です。組織へ移管する場合は、公式のライセンス条件を再確認してください。[公式Action](https://github.com/gitleaks/gitleaks-action)

CIはNode.js 24で、Secret Scan、`npm audit --audit-level=high`、lint、typecheck、テスト、buildを実行します。GitHubトークンは読み取り権限に限定し、PRコメント・リポジトリ更新・デプロイの権限は与えません。公開前には別途、Gitleaksのディレクトリ検査とGit履歴検査を実行します。

公開リポジトリでは、GitHubのSecret scanningとPush protectionを有効化済みです。これらも、すべての種類の秘密情報を検出できる保証ではありません。

もし本物の秘密情報を検出した場合は、まず該当するキーを失効・再発行してください。ファイルや履歴から消すだけでは、既に露出したキーを安全には戻せません。値をIssue、PR、検査記録へ貼り付けないでください。

## 公開時の実検査記録

検証日：2026-08-27（JST）。初期公開コミットは [`a4f1a9a`](https://github.com/shunsoco-stack/apology-ai/commit/a4f1a9a) です。下表は初期公開と最終公開前の作業ツリーで実行済みの結果です。最終コミットのCI・再デプロイ後の確認とは分けています。

| 検査 | 対象 | 実確認の結果 |
| --- | --- | --- |
| 補助Secret Scan / self-test | 公開対象ソース・設定・ドキュメント | 49テキストファイル検査・18項目除外、検出0件。検出15・安全7ケース、パス境界の自己テスト成功 |
| Gitleaks 8.30.0: directory | `.gitleaks.toml`の除外設定を適用した公開対象 | 検出0件。[レポート](gitleaks-worktree.json) |
| Gitleaks 8.30.0: Git history | 初期公開リポジトリの履歴 | 検出0件。[レポート](gitleaks-history.json) |
| npm audit | `sharp@0.35.4`、Node 24.x／lock同期後の依存関係 | 最終公開前の再実行でも既知の脆弱性0件 |
| lint / typecheck / test / build | 実URLメタデータ・Node 24.x反映後の作業ツリー | 再実行ですべて成功。4ファイル・90テスト成功 |
| 公開先HTTP・セキュリティヘッダー | [公開アプリ](https://apology-ai-iota.vercel.app) | HTTP 200、CSP、`X-Frame-Options: DENY`を確認。`/sw.js`のCache-Controlに`no-store`を確認 |
| 入力内容の非送信・非保存 | 生成・履歴・Analyticsの実装とテスト | 相談内容は生成関数／保存スキーマ／計測プロパティへ渡さない。計測は操作名と許可したモードのみ |
| GitHub Secret scanning / Push protection | 公開リポジトリの設定 | 両方enabled |
| GitHub Actions | [初期CI #33074637572](https://github.com/shunsoco-stack/apology-ai/actions/runs/33074637572) / `a4f1a9a` | 全ジョブ成功。lint/types/tests/build/auditとGitleaks historyを含む。完了22:01:30 JST |
| 公開版GitHub Actions | [CI #33075477190](https://github.com/shunsoco-stack/apology-ai/actions/runs/33075477190) / `93cfbfd` | 公開画像・実URLメタデータを含む版も全ジョブ成功 |

最初の無除外のディレクトリ検査では、`.next/`の生成物に含まれるプレビュー用・暗号用の一時的な鍵が検出されました。これらはGit管理・公開するソースの対象外です。上表の「0件」は、依存・ビルド・ローカル連携情報を除外した公開対象とGit履歴の結果です。

最終コミット、再デプロイ、公開スクリーンショット、最終CIの結果は、[検証記録の最終更新欄](verification.md#最終更新の追記)にまとめます。検査成功は、未確認のOS操作や有料プランの計測集計まで完了したことを示しません。
