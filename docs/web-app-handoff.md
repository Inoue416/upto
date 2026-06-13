# Webアプリ実装 引き継ぎ書

作成日: 2026-06-07
作業ブランチ: `codex-web-app`
起点ブランチ: `codex-news-collector-batch`
起点コミット: `a2840b7 Implement news collector batch`

## 現状

collector batch とDB基盤は、`codex-news-collector-batch` の内容を起点として実装済み。

実DB検証では `.env` の `DATABASE_URL` と `GEMINI_API_KEY` を使い、以下5ソースについて実取得、Gemini要約、PostgreSQL保存まで確認した。

- Zenn
- Qiita
- はてなブックマークIT
- Hacker News
- GitHub Blog

直近の検証では、各ソースで `articles=1`、`article_contents=1`、`article_summaries=1`、`article_metrics=1` を確認済み。直近5件の `crawl_jobs` はすべて `succeeded`、`failed_count=0`。

## Web側の既存足場

`apps/web` には Next.js App Router、React 19、Tailwind CSS v4 の最小構成がある。

主なファイル:

- `apps/web/src/app/page.tsx`
- `apps/web/src/components/article-feed.tsx`
- `apps/web/src/lib/articles.ts`
- `apps/web/e2e/feed.spec.ts`

現在の `getInitialArticles()` は固定モックを返している。次のWeb実装では、ここをPostgreSQLの実データ取得へ置き換える。

## 次にやること

1. `apps/web/src/lib/articles.ts` をDB接続に置き換える。
   - `@upto/db` の `createDb` と schema を使う。
   - `articles`、`sources`、`article_summaries`、`article_metrics` をjoinする。
   - 表示順はまず `article_metrics.score desc`、次に `articles.published_at desc` を推奨。

2. `Article` 型への変換を整理する。
   - `summary` は `article_summaries.short_summary` または `summary_json.summary` を使う。
   - `summaryBullets` は `article_summaries.bullets` を使う。
   - `score` は `article_metrics.score` を使う。

3. フィードUIを実データ前提に整える。
   - 空状態: 記事がない場合の表示。
   - loading/error: App Routerの `loading.tsx` / `error.tsx` 追加を検討。
   - source名、tags、difficulty、publishedAt、scoreの表示。
   - 元記事リンクは `articles.original_url`。

4. 縦スワイプUXを強化する。
   - 現状はCSS scroll snapとキーボード操作が中心。
   - PCのwheel/trackpadを1スクロール=1カード移動に寄せるなら、delta累積、cooldown、慣性対策を追加する。
   - キーボード要件: Up、Down、Space、Shift+Space は維持する。

5. Playwrightで確認する。
   - mobile viewportで1カードずつ読めること。
   - desktop viewportでカードが見切れないこと。
   - keyboard navigationが動くこと。
   - 空データ時の表示が壊れないこと。

## 注意点

- `.env` はGit管理しない。
- `.env.example` にはキー名だけを置く。
- collector実行時、`.env` の `GEMINI_MODEL_IMPORTANT` が無効なモデル名でも、通常モデルへfallbackする実装になっている。
- `COLLECTOR_DRY_RUN=false` は文字列として正しくfalse判定されるよう修正済み。
- local PostgreSQL検証では Docker image を `postgres:17` にしている。`postgres:17-alpine` は手元でpullが詰まったため使っていない。

## 検証済みコマンド

```bash
pnpm --filter @upto/db db:migrate
pnpm --filter @upto/db db:generate
pnpm verify
```

collectorの実行検証:

```bash
set -a
source .env
set +a
COLLECTOR_DRY_RUN=false COLLECTOR_MAX_ITEMS_PER_FEED=1 COLLECTOR_CONCURRENCY=1 pnpm --filter @upto/collector exec tsx src/index.ts
```

## PR/remote状況

`codex-news-collector-batch` にはローカルコミット `a2840b7` があるが、repository remote が未設定で、`gh auth status` も token invalid のため、まだpush/PR作成はできていない。

Web作業ブランチ `codex-web-app` は、その `a2840b7` から分岐している。
