import { describe, expect, it } from "vitest";

import { getArticlesPage, mapArticleRow } from "./articles";

describe("mapArticleRow", () => {
  it("maps DB rows and snake_case summary JSON into feed articles", () => {
    const article = mapArticleRow({
      bookmarks: 12,
      bullets: ["要点1"],
      createdAt: new Date("2026-06-07T00:30:00.000Z"),
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

describe("getArticlesPage", () => {
  it("returns a first fixture page with a next cursor", async () => {
    process.env.UPTO_WEB_USE_FIXTURE_DATA = "true";

    const page = await getArticlesPage({ limit: 2 });

    expect(page.articles).toHaveLength(2);
    expect(page.articles.map((article) => article.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("uses the next cursor to fetch the following fixture page", async () => {
    process.env.UPTO_WEB_USE_FIXTURE_DATA = "true";

    const firstPage = await getArticlesPage({ limit: 2 });
    const secondPage = await getArticlesPage({ cursor: firstPage.nextCursor, limit: 2 });

    expect(secondPage.articles).toHaveLength(2);
    expect(secondPage.articles.map((article) => article.id)).toEqual([
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
    ]);
    expect(secondPage.hasMore).toBe(true);
    expect(secondPage.nextCursor).toEqual(expect.any(String));
  });

  it("returns no cursor on the final fixture page", async () => {
    process.env.UPTO_WEB_USE_FIXTURE_DATA = "true";

    let cursor: string | null = null;
    let finalPage = await getArticlesPage({ limit: 5 });
    while (finalPage.hasMore) {
      cursor = finalPage.nextCursor;
      finalPage = await getArticlesPage({ cursor, limit: 5 });
    }

    expect(finalPage.articles.length).toBeGreaterThan(0);
    expect(finalPage.hasMore).toBe(false);
    expect(finalPage.nextCursor).toBeNull();
  });

  it("rejects invalid cursors", async () => {
    process.env.UPTO_WEB_USE_FIXTURE_DATA = "true";

    await expect(getArticlesPage({ cursor: "not-a-cursor", limit: 2 })).rejects.toThrow(
      "Invalid article page cursor",
    );
  });
});
