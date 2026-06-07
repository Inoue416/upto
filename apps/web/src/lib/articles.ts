import type { Article } from "@upto/domain";

export async function getInitialArticles(): Promise<Article[]> {
  return [
    {
      id: "00000000-0000-4000-8000-000000000001",
      normalizedUrl: "https://zenn.dev/example/articles/next-news",
      originalUrl: "https://zenn.dev/example/articles/next-news",
      publishedAt: new Date("2026-06-07T00:00:00.000Z").toISOString(),
      score: 83,
      sourceId: "00000000-0000-4000-8000-100000000001",
      summary: "Next.js App Router と Server Components を活用した記事配信の実装例です。",
      summaryBullets: [
        "初期表示は Server Component で取得する",
        "カード遷移は Client Component に閉じ込める",
        "追加取得は cursor pagination で拡張する",
      ],
      title: "Next.js で縦スワイプ型ニュース UI を作る",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      normalizedUrl: "https://qiita.com/example/items/collector",
      originalUrl: "https://qiita.com/example/items/collector",
      publishedAt: new Date("2026-06-07T01:00:00.000Z").toISOString(),
      score: 61,
      sourceId: "00000000-0000-4000-8000-100000000002",
      summary: "RSS 取得、本文抽出、LLM 要約を idempotent に進めるためのバッチ設計です。",
      summaryBullets: [
        "crawl_jobs に実行状態を保存する",
        "記事単位の失敗を retry_count で管理する",
        "Gemini の rate limit を concurrency で制御する",
      ],
      title: "ニュース収集バッチを安全に設計する",
    },
  ];
}
