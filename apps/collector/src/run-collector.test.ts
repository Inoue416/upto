import { describe, expect, it } from "vitest";

import type { Persistence } from "./persistence.js";
import type { Summarizer } from "./summarizer.js";

import { runCollector } from "./run-collector.js";

const baseConfig = {
  concurrency: 1,
  dryRun: true,
  geminiModelDefault: "gemini-2.5-flash-lite",
  geminiModelImportant: "gemini-2.5-flash",
  maxItemsPerFeed: 20,
  summaryChunkChars: 12000,
};

describe("runCollector", () => {
  it("can run in dry-run mode without secrets", async () => {
    const result = await runCollector({
      config: {
        ...baseConfig,
      },
      dependencies: {
        logger: () => undefined,
      },
      feeds: [
        {
          kind: "rss",
          name: "Example",
          siteUrl: "https://example.com",
          url: "https://example.com/feed.xml",
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.feedCount).toBe(1);
  });

  it("fetches RSS items, summarizes them, and saves article data", async () => {
    const savedArticles: unknown[] = [];
    const finishedJobs: unknown[] = [];
    const longDescription = "これはテスト用の記事本文です。".repeat(90);
    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <item>
      <title>TypeScript batch test</title>
      <link>https://example.com/articles/typescript-batch?utm_source=test</link>
      <pubDate>Sun, 07 Jun 2026 00:00:00 GMT</pubDate>
      <description>${longDescription}</description>
    </item>
  </channel>
</rss>`;
    const persistence: Persistence = {
      async finishFeedJob(_jobId, result) {
        finishedJobs.push(result);
      },
      async markArticleFailed() {
        throw new Error("markArticleFailed should not be called");
      },
      async saveArticle(input) {
        savedArticles.push(input);
        return "article-1";
      },
      async startFeedJob() {
        return {
          feedEndpointId: "feed-1",
          jobId: "job-1",
          sourceId: "source-1",
        };
      },
    };
    const summarizer: Summarizer = {
      async summarize(article) {
        return {
          modelId: "test-model",
          summary: {
            difficulty: "intermediate",
            importanceScore: 42,
            keyPoints: ["RSSを取得する", "本文をfallbackする", "DBへ保存する"],
            oneLineSummary: `${article.title} のテスト要約です。`,
            summary: "RSSから取得した本文を使って要約し、保存する経路を検証している。",
            tags: ["TypeScript", "RSS"],
            title: article.title,
            whyItMatters: "外部依存を差し替えてcollectorの主要経路を検証できる。",
          },
        };
      },
    };

    const result = await runCollector({
      config: {
        ...baseConfig,
        dryRun: false,
        maxItemsPerFeed: 1,
      },
      dependencies: {
        fetcher: async () => new Response(rss),
        logger: () => undefined,
        persistence,
        summarizer,
      },
      feeds: [
        {
          kind: "rss",
          name: "Example",
          siteUrl: "https://example.com",
          url: "https://example.com/feed.xml",
        },
      ],
    });

    expect(result).toEqual({
      articleCount: 1,
      dryRun: false,
      failedCount: 0,
      feedCount: 1,
    });
    expect(savedArticles).toHaveLength(1);
    expect(finishedJobs).toEqual([
      {
        errorSummary: null,
        failedCount: 0,
        fetchedCount: 1,
      },
    ]);
  });
});
