import type { Article } from "@upto/domain";

import {
  articleMetrics,
  articles,
  articleSummaries,
  createDb,
  desc,
  eq,
  sources,
  sql,
} from "@upto/db";

export type FeedArticle = Article & {
  bookmarks: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  modelId: string;
  oneLineSummary: string | null;
  sourceName: string;
  sourceSiteUrl: string;
  tags: string[];
  views: number;
  whyItMatters: string | null;
};

type ArticleRow = {
  bookmarks: number | null;
  bullets: string[];
  id: string;
  modelId: string;
  normalizedUrl: string;
  originalUrl: string;
  publishedAt: Date | null;
  score: number | null;
  shortSummary: string;
  sourceId: string;
  sourceName: string;
  sourceSiteUrl: string;
  summaryJson: Record<string, unknown>;
  title: string;
  topics: string[];
  views: number | null;
};

const fixtureArticles: FeedArticle[] = [
  {
    bookmarks: 42,
    difficulty: "intermediate",
    id: "00000000-0000-4000-8000-000000000001",
    modelId: "fixture",
    normalizedUrl: "https://zenn.dev/example/articles/next-news",
    oneLineSummary: "Next.js App Router と Server Components を活用した記事配信の実装例です。",
    originalUrl: "https://zenn.dev/example/articles/next-news",
    publishedAt: new Date("2026-06-07T00:00:00.000Z").toISOString(),
    score: 83,
    sourceId: "00000000-0000-4000-8000-100000000001",
    sourceName: "Zenn",
    sourceSiteUrl: "https://zenn.dev",
    summary:
      "Next.js App Router と Server Components を土台に、初期表示を軽く保ちながら縦スワイプ型ニュースフィードを構成する実装例です。カード遷移はClient Componentに閉じ込め、データ取得はサーバー側に寄せています。",
    summaryBullets: [
      "初期表示は Server Component で取得する",
      "カード遷移は Client Component に閉じ込める",
      "追加取得は cursor pagination で拡張する",
    ],
    tags: ["Next.js", "React", "UI"],
    title: "Next.js で縦スワイプ型ニュース UI を作る",
    views: 820,
    whyItMatters:
      "サーバー取得とクライアント操作の責務を分けることで、MVPでも拡張しやすいUIを作れます。",
  },
  {
    bookmarks: 31,
    difficulty: "beginner",
    id: "00000000-0000-4000-8000-000000000002",
    modelId: "fixture",
    normalizedUrl: "https://qiita.com/example/items/collector",
    oneLineSummary: "RSS 取得、本文抽出、LLM 要約を安全に進めるためのバッチ設計です。",
    originalUrl: "https://qiita.com/example/items/collector",
    publishedAt: new Date("2026-06-07T01:00:00.000Z").toISOString(),
    score: 61,
    sourceId: "00000000-0000-4000-8000-100000000002",
    sourceName: "Qiita",
    sourceSiteUrl: "https://qiita.com",
    summary:
      "ニュース収集バッチをidempotentに動かすため、crawl_jobs と記事単位のステータスで実行結果を記録します。本文抽出や要約で失敗しても、他の記事の処理を続けられる設計です。",
    summaryBullets: [
      "crawl_jobs に実行状態を保存する",
      "記事単位の失敗を retry_count で管理する",
      "Gemini の rate limit を concurrency で制御する",
    ],
    tags: ["Batch", "PostgreSQL", "Gemini"],
    title: "ニュース収集バッチを安全に設計する",
    views: 510,
    whyItMatters:
      "外部APIとLLMを扱うバッチでは、部分失敗を前提にした永続化が運用安定性に直結します。",
  },
];

export async function getInitialArticles(limit = 50): Promise<FeedArticle[]> {
  if (process.env.UPTO_WEB_USE_FIXTURE_DATA === "true") {
    return fixtureArticles;
  }

  const db = createDb();
  const rows = await db
    .select({
      bookmarks: articleMetrics.bookmarks,
      bullets: articleSummaries.bullets,
      id: articles.id,
      modelId: articleSummaries.modelId,
      normalizedUrl: articles.normalizedUrl,
      originalUrl: articles.originalUrl,
      publishedAt: articles.publishedAt,
      score: articleMetrics.score,
      shortSummary: articleSummaries.shortSummary,
      sourceId: articles.sourceId,
      sourceName: sources.name,
      sourceSiteUrl: sources.siteUrl,
      summaryJson: articleSummaries.summaryJson,
      title: articles.title,
      topics: articleSummaries.topics,
      views: articleMetrics.views,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .innerJoin(articleSummaries, eq(articles.id, articleSummaries.articleId))
    .leftJoin(articleMetrics, eq(articles.id, articleMetrics.articleId))
    .where(eq(articles.summaryStatus, "summarized"))
    .orderBy(
      sql`coalesce(${articleMetrics.score}, 0) desc`,
      sql`${articles.publishedAt} desc nulls last`,
      desc(articles.createdAt),
    )
    .limit(limit);

  return rows.map(mapArticleRow);
}

export function mapArticleRow(row: ArticleRow): FeedArticle {
  const summary = readString(row.summaryJson.summary) ?? row.shortSummary;
  const oneLineSummary = readString(row.summaryJson.one_line_summary) ?? row.shortSummary;
  const tags = readStringArray(row.summaryJson.tags);

  return {
    bookmarks: row.bookmarks ?? 0,
    difficulty: readDifficulty(row.summaryJson.difficulty),
    id: row.id,
    modelId: row.modelId,
    normalizedUrl: row.normalizedUrl,
    oneLineSummary,
    originalUrl: row.originalUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    score: row.score ?? 0,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceSiteUrl: row.sourceSiteUrl,
    summary,
    summaryBullets:
      row.bullets.length > 0 ? row.bullets : readStringArray(row.summaryJson.key_points),
    tags: tags.length > 0 ? tags : row.topics,
    title: readString(row.summaryJson.title) ?? row.title,
    views: row.views ?? 0,
    whyItMatters: readString(row.summaryJson.why_it_matters),
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readDifficulty(value: unknown): FeedArticle["difficulty"] {
  if (value === "beginner" || value === "advanced") {
    return value;
  }

  return "intermediate";
}

export async function getFixtureArticlesForTest(): Promise<FeedArticle[]> {
  return [...fixtureArticles];
}
