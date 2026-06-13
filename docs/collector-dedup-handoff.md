# Collector重複スキップ実装 引き継ぎ書

作成日: 2026-06-08
対象領域: `apps/collector`, `packages/db`

## 背景

Gemini API無料枠内で collector batch を運用するため、RSS/API上位に残り続ける既存記事を再要約しないようにする。

設計書では、collector の処理順は以下になっている。

```txt
RSS/API取得
↓
URL正規化
↓
重複排除
↓
本文抽出
↓
Gemini要約
↓
スコア計算
↓
DB保存
```

実DBスキーマも `articles.normalized_url` に unique index を持っている。

- `packages/db/src/schema.ts`
  - `uniqueIndex("articles_normalized_url_unique").on(table.normalizedUrl)`
- `packages/db/drizzle/0000_cute_killraven.sql`
  - `CREATE UNIQUE INDEX "articles_normalized_url_unique" ON "articles" USING btree ("normalized_url")`

つまり、DB設計上はURL正規化後の記事URLで一意になっている。

## 現状のギャップ

現在の `processFeedItem()` は、URL正規化後に既存記事を確認せず、本文抽出と Gemini 要約を実行してから `saveArticle()` する。

現在の処理順:

```txt
normalizedUrl = normalizeArticleUrl(item.url)
↓
extractArticleContent(...)
↓
summarizer.summarize(...)  // Gemini API消費
↓
persistence.saveArticle(...)  // normalized_url conflict時は更新
```

`saveArticle()` は `onConflictDoUpdate` を使うため、同じ `normalized_url` のDB行が増えることは防げている。
一方で、Gemini API呼び出し前の重複スキップは未実装である。

そのため現状では、同じ記事がRSS上位に再登場するとDB行は重複しないが、Gemini要約は再実行され得る。

## 用語

この引き継ぎ書での「重複記事」は、以下を指す。

- feed item の `url` を `normalizeArticleUrl()` で正規化した値が、既に `articles.normalized_url` に存在する記事
- source が異なっていても、`normalized_url` が同じなら同一記事として扱う

## 実装方針

最小実装では、DB migration は追加しない。

`processFeedItem()` の冒頭で `normalizedUrl` を算出した直後、本文抽出より前に既存記事を確認する。

既に `summaryStatus = "summarized"` の記事が存在する場合:

- 本文抽出を行わない
- Gemini要約を行わない
- `article_summaries` を更新しない
- `article_contents` を更新しない
- 必要に応じて `article_metrics` だけ更新する
- `article_skipped_duplicate` のログを出す

`summaryStatus = "failed"` または `pending` の場合:

- 再試行対象として従来どおり本文抽出とGemini要約を実行する

## 推奨するコード変更

### 1. Persistence に既存記事確認APIを追加する

対象: `apps/collector/src/persistence.ts`

追加する型の例:

```ts
export type ExistingArticle = {
  id: string;
  summaryStatus: "pending" | "summarized" | "failed";
};
```

`Persistence` interface に追加:

```ts
findArticleByNormalizedUrl(normalizedUrl: string): Promise<ExistingArticle | null>;
```

`DbPersistence` 実装例:

```ts
async findArticleByNormalizedUrl(normalizedUrl: string): Promise<ExistingArticle | null> {
  const [article] = await this.db
    .select({
      id: articles.id,
      summaryStatus: articles.summaryStatus,
    })
    .from(articles)
    .where(eq(articles.normalizedUrl, normalizedUrl))
    .limit(1);

  return article ?? null;
}
```

### 2. 既存記事のメトリクス更新APIを追加する

要約済み記事を完全にスキップすると、bookmark数やscoreが古くなる。
ニュースフィードの並び替えでは `article_metrics.score` を使うため、可能ならメトリクスだけ更新する。

`Persistence` interface に追加する候補:

```ts
updateArticleMetrics(input: {
  articleId: string;
  bookmarks: number;
  score: number;
  views: number;
}): Promise<void>;
```

実装では `article_metrics.article_id` を conflict target にして upsert する。

### 3. processFeedItem() で Gemini 前にスキップする

対象: `apps/collector/src/run-collector.ts`

実装イメージ:

```ts
const normalizedUrl = normalizeArticleUrl(input.item.url);
const existingArticle = await input.persistence.findArticleByNormalizedUrl(normalizedUrl);

if (existingArticle?.summaryStatus === "summarized") {
  const score = calculateScoreForItem(input.item);
  await input.persistence.updateArticleMetrics({
    articleId: existingArticle.id,
    bookmarks: input.item.bookmarks,
    score,
    views: input.item.views,
  });

  logger({
    feed: input.feed.name,
    normalizedUrl,
    status: "article_skipped_duplicate",
    url: input.item.url,
  });
  return;
}
```

注意点:

- `calculateTrendScore()` の計算は既存処理と同じロジックを使う
- 現在は `processFeedItem()` 内で `logger` を受け取っていないため、ログを出すなら `ProcessFeedItemInput` に `logger` を追加する
- `articleCount` / `fetchedCount` に skipped を含めるかは決める必要がある

## カウント方針

DB migration なしで進めるなら、以下を推奨する。

- `articleCount`: 新規または再処理して要約まで完了した記事数
- `feedFetchedCount`: 新規または再処理して要約まで完了した記事数
- skipped duplicate: JSONログのみ
- `crawl_jobs.fetched_count`: skipped を含めない

理由:

- 既存DB schema に `skipped_count` がない
- `fetched_count` に skipped を混ぜると、Geminiを使った処理数と区別できなくなる
- 無料枠運用では、ログ上で skipped 件数を確認できればまず十分

将来、運用メトリクスとして skipped 数をDBで見たい場合は、別途 migration で `crawl_jobs.skipped_count` を追加する。

## テスト方針

対象: `apps/collector/src/run-collector.test.ts`

追加すべきテスト:

1. 要約済み既存記事は Gemini を呼ばずにスキップする
   - persistence mock が `summaryStatus: "summarized"` を返す
   - summarizer mock が呼ばれないことを確認する
   - content fetch / extract 相当のネットワーク呼び出しが不要なら、その呼び出しも発生しないことを確認する

2. 要約済み既存記事でも metrics は更新される
   - `updateArticleMetrics()` が呼ばれることを確認する
   - score が既存ロジックと同じ条件で計算されることを確認する

3. `failed` / `pending` の既存記事は再処理される
   - summarizer が呼ばれることを確認する
   - `saveArticle()` が呼ばれることを確認する

4. 同一バッチ内で同じURLが複数feedから来た場合の挙動
   - `normalizedUrl` が同じなら2件目はスキップされること
   - concurrency > 1 では競合し得るため、初期運用では `COLLECTOR_CONCURRENCY=1` を推奨する

## 並列実行時の注意

`COLLECTOR_CONCURRENCY > 1` で、同じ `normalizedUrl` が同じ実行内に複数回出た場合、どちらも既存記事なしと判断して Gemini を呼ぶ race condition が残る可能性がある。

無料枠節約を優先する運用では、まず以下を推奨する。

```env
COLLECTOR_CONCURRENCY=1
```

完全に防ぐなら、DBに「処理中」状態を先に upsert する claim 処理を追加する。
ただし実装がやや重くなるため、今回の最小対応では範囲外とする。

## 受け入れ条件

- 同じ `normalizedUrl` で `summaryStatus = summarized` の記事は Gemini API を呼ばない
- 同じ `normalizedUrl` のDB行は増えない
- `summaryStatus = failed` / `pending` の記事は再処理できる
- skipped duplicate のログが残る
- `pnpm --filter @upto/collector test` または該当 Vitest が成功する
- `pnpm typecheck` が成功する
- 実DBで同じ条件のバッチを2回実行したとき、2回目の Gemini 呼び出し数が新規記事分だけになる

## 運用設定案

重複スキップ実装後なら、無料枠運用で以下を検討できる。

```env
COLLECTOR_MAX_ITEMS_PER_FEED=20
COLLECTOR_CONCURRENCY=1
GEMINI_MODEL_DEFAULT=gemini-2.5-flash-lite
GEMINI_MODEL_IMPORTANT=gemini-2.5-flash-lite
SUMMARY_CHUNK_CHARS=20000
```

スケジュール:

```txt
08:00 JST
20:00 JST
```

初回実行では最大100記事分の要約が走る可能性がある。
2回目以降は、RSS/API上位20件のうち新規URLだけが Gemini 要約対象になる。

## 関連ファイル

- `docs/news-summary-batch-db-design-v2.md`
- `docs/manual-batch-verification.md`
- `apps/collector/src/run-collector.ts`
- `apps/collector/src/persistence.ts`
- `apps/collector/src/run-collector.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/drizzle/0000_cute_killraven.sql`
