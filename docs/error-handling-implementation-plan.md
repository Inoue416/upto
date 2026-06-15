# エラーハンドリング拡充 実装計画

作成日: 2026-06-16

## 背景

現状の Web はフィード表示を中心に動作しており、追加読み込み失敗には再試行 UI がある。一方で、初期取得失敗時の `apps/web/src/app/error.tsx` は `error.message` を画面に表示しており、DB 接続文字列や内部例外の詳細をユーザーに見せる可能性がある。

また、`/api/articles` はエラー時に `{ error: string }` を返すが、validation error と内部エラーのレスポンス形式が十分に構造化されていない。Client Component 側も追加取得失敗を一律文言にしているため、今後 API エラー種別を増やす前に公開エラー契約を整理する必要がある。

この計画では、ユーザーアカウント機能は前提にしない。既読、保存、閲覧位置、テーマは引き続きブラウザローカルの IndexedDB / localStorage 状態として扱う。

## 目的

- ユーザーに内部エラー詳細を表示しない。
- 初期表示、追加取得、ローカル状態保存の失敗時に、フィード体験を壊さず復旧導線を出す。
- API の公開エラー形式を最小限構造化し、Client 側で安全に扱えるようにする。
- サーバー側には調査に必要な情報をログへ残し、画面には短い日本語コピーだけを出す。
- 既存の縦スワイプ、keyboard/wheel、終端表示、追加読み込み再試行、IndexedDB 状態の挙動を維持する。

## 非目標

- ユーザーアカウント、認証、ユーザー別エラー履歴は追加しない。
- Sentry など外部監視サービスの導入はこの計画の必須範囲にしない。
- DB 接続プール、migration rollback、Web Docker 化は別タスクとする。
- collector batch のリトライ設計や Gemini エラー分類の大幅変更は含めない。

## 現状の確認

### 初期表示

- `apps/web/src/app/page.tsx` は Server Component で `getArticlesPage({ limit: 10 })` を呼ぶ。
- DB 接続や記事取得で例外が出ると `apps/web/src/app/error.tsx` が表示される。
- 現在の `error.tsx` は `error.message` を表示するため、本番公開には強すぎる。

### 追加読み込み

- `apps/web/src/components/article-feed.tsx` は `/api/articles` 失敗時に `追加読み込みに失敗しました` と再試行ボタンを表示する。
- 既存 E2E は追加読み込み失敗と再試行を検証している。
- API レスポンスのエラー内容は UI に直接出していないため、この点は比較的安全。

### API

- `apps/web/src/app/api/articles/route.ts` は validation error を 400、cursor/snapshot error を 400、それ以外を 500 にする。
- 現在は `message` をそのまま `{ error: message }` に含めるため、内部エラーを API レスポンスへ出す可能性がある。

### ローカル状態

- `apps/web/src/lib/user-state-db.ts` は IndexedDB が無い環境では no-op になる。
- `useUserArticleState()` は liveQuery error 時に空状態へフォールバックする。
- `markArticleRead()`、`markArticleSaved()`、`saveReadingProgress()` の呼び出しは `void` で投げっぱなしの箇所があり、IndexedDB 書き込み失敗時に未処理 rejection になる余地がある。

## 実装方針

### 1. 公開エラー文言を固定する

ユーザーに見せる文言は短い日本語に固定する。

- 初期取得失敗: `記事を読み込めませんでした`
- 再試行説明: `時間をおいて再読み込みしてください。問題が続く場合は運用ログを確認してください。`
- 追加取得失敗: 既存の `追加読み込みに失敗しました` を維持
- ローカル状態失敗: 原則 UI を止めない。必要なら控えめな注記に留める

`error.message` は画面に表示しない。Next.js の `error.digest` は表示しないが、将来ログ連携する余地を残す。

### 2. エラー表示コンポーネントを共通化する

候補ファイル:

- `apps/web/src/components/error-state.tsx`

想定 props:

```ts
type ErrorStateProps = {
  action?: {
    label: string;
    onClick: () => void;
  };
  description: string;
  title: string;
};
```

用途:

- `apps/web/src/app/error.tsx`
- ArticleFeed の追加読み込み失敗カード
- 将来の not-found / global-error

ただし、抽象化は過剰にしない。初回実装で `error.tsx` と `LoadMoreStatusCard` の重複が小さければ、共通化は後回しにしてよい。

### 3. `error.tsx` を本番向けにする

対象:

- `apps/web/src/app/error.tsx`

変更方針:

- `error.message` の描画を削除する。
- `reset()` ボタンは維持する。
- `useEffect` で `console.error(error)` を呼び、サーバー/ブラウザのログに調査情報を残す。
- `max-w-3xl`、既存 CSS 変数、短い日本語コピーを使い、DESIGN.md に合わせる。

検証:

- Playwright で初期ページを API/DB 失敗相当にできるなら E2E を追加する。
- 難しい場合は Storybook または component-level の扱いを検討する。

### 4. API エラー形式を構造化する

対象:

- `apps/web/src/app/api/articles/route.ts`

公開レスポンス候補:

```ts
type ArticleApiErrorResponse = {
  error: {
    code: "invalid_request" | "invalid_cursor" | "invalid_snapshot" | "internal_error";
    message: string;
  };
};
```

方針:

- 400 系は安全な固定 message を返す。
- 500 は常に `internal_error` と固定 message を返す。
- 内部例外の詳細は `console.error()` に出す。
- 既存 Client は `response.ok` だけを見ているため、UI 互換性は維持しやすい。

テスト:

- `/api/articles` の Route Handler 単体テストを追加するか、`getArticlesPage()` の invalid cursor/snapshot テストを維持しつつ API レスポンスのテストを追加する。
- 少なくとも invalid query が 400 で固定コードを返すことを確認する。

### 5. 追加読み込み失敗 UI を微調整する

対象:

- `apps/web/src/components/article-feed.tsx`

方針:

- 既存の `feed-load-more`、再試行ボタン、`hasMore=false` の終端表示は維持する。
- `fetchArticlePage()` で JSON parse に失敗した場合も同じ追加読み込み失敗として扱う。
- 可能なら失敗理由を内部ログにだけ出す。
- 再試行中の disabled 表示は維持する。

検証:

- 既存の `shows load-more failure and retries additional article loading` を維持。
- 500 だけでなく invalid JSON / network abort も必要なら追加する。

### 6. IndexedDB 書き込み失敗を握りつぶさず安全に扱う

対象:

- `apps/web/src/components/article-feed.tsx`
- `apps/web/src/lib/user-state-db.ts`
- `apps/web/src/lib/use-user-article-state.ts`

方針:

- UI 操作を失敗させない。
- `markArticleRead()`、`markArticleSaved()`、`saveReadingProgress()` の呼び出しに `.catch()` を付け、未処理 rejection を避ける。
- ログは `console.warn()` 程度に留める。
- IndexedDB が使えない場合は現状どおり no-op。

ユーザー機能はないため、サーバーへ保存失敗を送らない。

テスト:

- `user-state-db.test.ts` で既存の保存/既読/進捗テストを維持。
- 必要なら、Dexie 操作が reject する fake db を渡して呼び出し側が落ちないことを狭く確認する。

### 7. 404 / global error の扱いを確認する

Next.js App Router では必要に応じて以下を追加できる。

- `apps/web/src/app/not-found.tsx`
- `apps/web/src/app/global-error.tsx`

ただし現状のアプリは feed 1画面中心であり、最初から追加必須ではない。`error.tsx` の内部詳細非表示と API エラー契約の整理を優先する。

## 実装ステップ

1. `error.tsx` から内部 message 表示を除去し、固定コピーと `console.error` に置き換える。
2. `/api/articles` のエラーレスポンスを `{ error: { code, message } }` に変更する。
3. `fetchArticlePage()` と追加読み込み UI が新旧レスポンスに依存しないことを確認する。
4. ArticleFeed 内の IndexedDB 書き込み呼び出しへ安全な `.catch()` を追加する。
5. 必要に応じて `ErrorState` コンポーネントを追加する。重複が少なければ見送る。
6. Vitest を追加/更新する。
7. Playwright で既存 feed E2E を通し、追加読み込み失敗/再試行、終端表示、IndexedDB 状態、keyboard/wheel を確認する。
8. runbook に本番エラー調査時の確認ポイントを追記する。

## 受け入れ条件

- 初期表示失敗時に `error.message`、DB URL、stack trace、Next.js digest を画面に出さない。
- `/api/articles` の 500 レスポンスが内部例外 message を返さない。
- invalid cursor / invalid snapshot は 400 として安全な固定コードで返る。
- 追加読み込み失敗/再試行 UI が現状どおり動く。
- `hasMore=false` のときだけ `今日の新着は以上です` が表示される。
- IndexedDB が使えない、または書き込みに失敗してもフィード閲覧は続けられる。
- keyboard/wheel navigation、既読、保存、閲覧位置の既存挙動を壊さない。
- ユーザーアカウント機能を前提にしない。

## 検証計画

最小検証:

```bash
pnpm --filter @upto/web test
pnpm --filter @upto/web typecheck
pnpm exec playwright test apps/web/e2e/feed.spec.ts
pnpm format:check
pnpm lint
```

本番デプロイ前に追加で確認するもの:

```bash
pnpm -r build
```

必要に応じて、API Route Handler のテストを追加した場合は対象 Vitest を個別実行する。

## リスクと注意点

- `error.tsx` は Client Component なので、ログはブラウザ側に出る。サーバー側ログが必要な場合は Route Handler や data access 層でも `console.error` する。
- API エラー形式を変える場合、将来の Client が `{ error: string }` に依存しないよう型を明示する。
- エラー状態 UI を共通化しすぎると feed の密度と操作性を損なう。まずは狭く改善する。
- IndexedDB 失敗をユーザーへ強く通知すると、記事を読む主目的を邪魔する。保存や既読の失敗は控えめに扱う。
