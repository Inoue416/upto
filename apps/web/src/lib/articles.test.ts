import { describe, expect, it } from "vitest";

import { mapArticleRow } from "./articles";

describe("mapArticleRow", () => {
  it("maps DB rows and snake_case summary JSON into feed articles", () => {
    const article = mapArticleRow({
      bookmarks: 12,
      bullets: ["要点1"],
      id: "00000000-0000-4000-8000-000000000001",
      modelId: "gemini-test",
      normalizedUrl: "https://example.com/a",
      originalUrl: "https://example.com/a?utm_source=test",
      publishedAt: new Date("2026-06-07T00:00:00.000Z"),
      score: 23,
      shortSummary: "短い要約",
      sourceId: "00000000-0000-4000-8000-100000000001",
      sourceName: "Example",
      sourceSiteUrl: "https://example.com",
      summaryJson: {
        difficulty: "advanced",
        one_line_summary: "1行要約",
        summary: "本文要約",
        tags: ["TypeScript", "Next.js"],
        title: "整えたタイトル",
        why_it_matters: "重要な理由",
      },
      title: "元タイトル",
      topics: [],
      views: 345,
    });

    expect(article).toMatchObject({
      bookmarks: 12,
      difficulty: "advanced",
      oneLineSummary: "1行要約",
      summary: "本文要約",
      tags: ["TypeScript", "Next.js"],
      title: "整えたタイトル",
      views: 345,
      whyItMatters: "重要な理由",
    });
    expect(article.publishedAt).toBe("2026-06-07T00:00:00.000Z");
  });
});
