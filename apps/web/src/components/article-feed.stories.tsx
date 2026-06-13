import type { FeedArticle } from "../lib/articles";

import { ArticleFeed } from "./article-feed";

const articles = [
  {
    bookmarks: 42,
    difficulty: "intermediate",
    id: "00000000-0000-4000-8000-000000000001",
    modelId: "storybook",
    normalizedUrl: "https://zenn.dev/example/articles/next-news",
    oneLineSummary: "Next.js App Router と Server Components を活用した記事配信の実装例です。",
    originalUrl: "https://zenn.dev/example/articles/next-news",
    publishedAt: new Date("2026-06-13T00:00:00.000Z").toISOString(),
    score: 83,
    sourceId: "00000000-0000-4000-8000-100000000001",
    sourceName: "Zenn",
    sourceSiteUrl: "https://zenn.dev",
    summary:
      "Next.js App Router と Server Components を土台に、初期表示を軽く保ちながら縦スワイプ型ニュースフィードを構成する実装例です。",
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
    modelId: "storybook",
    normalizedUrl: "https://qiita.com/example/items/collector",
    oneLineSummary: "RSS 取得、本文抽出、LLM 要約を安全に進めるためのバッチ設計です。",
    originalUrl: "https://qiita.com/example/items/collector",
    publishedAt: new Date("2026-06-13T01:00:00.000Z").toISOString(),
    score: 61,
    sourceId: "00000000-0000-4000-8000-100000000002",
    sourceName: "Qiita",
    sourceSiteUrl: "https://qiita.com",
    summary:
      "ニュース収集バッチをidempotentに動かすため、crawl_jobs と記事単位のステータスで実行結果を記録します。",
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
] satisfies FeedArticle[];

export default {
  title: "Components/ArticleFeed",
  component: ArticleFeed,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    articles,
  },
};

export const Default = {};

export const Empty = {
  args: {
    articles: [],
  },
};
