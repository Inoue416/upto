import { describe, expect, it } from "vitest";

import { serializeSummary } from "./persistence.js";

describe("serializeSummary", () => {
  it("keeps the sample prompt JSON shape for database storage", () => {
    expect(
      serializeSummary({
        difficulty: "intermediate",
        importanceScore: 78,
        keyPoints: [
          "RSSは記事発見に使い、本文はURLから抽出する",
          "長文記事はチャンク分割して段階要約する",
          "Gemini Flash-Liteは低コストなMVP向けモデルとして使いやすい",
        ],
        oneLineSummary: "Gemini APIを使ってIT記事を低コストに要約する方法を解説している。",
        summary: "この記事では、RSSやAPIで収集したIT記事をGeminiで要約する構成を紹介している。",
        tags: ["Gemini", "RSS", "要約", "バッチ処理"],
        title: "記事タイトル",
        whyItMatters: "低コストでニュース要約アプリを作るための実装方針として参考になる。",
      }),
    ).toEqual({
      difficulty: "intermediate",
      importance_score: 78,
      key_points: [
        "RSSは記事発見に使い、本文はURLから抽出する",
        "長文記事はチャンク分割して段階要約する",
        "Gemini Flash-Liteは低コストなMVP向けモデルとして使いやすい",
      ],
      one_line_summary: "Gemini APIを使ってIT記事を低コストに要約する方法を解説している。",
      summary: "この記事では、RSSやAPIで収集したIT記事をGeminiで要約する構成を紹介している。",
      tags: ["Gemini", "RSS", "要約", "バッチ処理"],
      title: "記事タイトル",
      why_it_matters: "低コストでニュース要約アプリを作るための実装方針として参考になる。",
    });
  });
});
