以下に参考のためのプロンプトを示します。

## 要約のフォーマット例
```
{
  "title": "記事タイトル",
  "one_line_summary": "1行要約",
  "summary": "3〜5行の要約",
  "key_points": [
    "重要ポイント1",
    "重要ポイント2",
    "重要ポイント3"
  ],
  "tags": ["AI", "TypeScript", "OSS"],
  "difficulty": "beginner | intermediate | advanced",
  "importance_score": 1
}
```

## Gemini要約用の保存JSON例
```
{
  "one_line_summary": "Gemini APIを使ってIT記事を低コストに要約する方法を解説している。",
  "summary": "この記事では、RSSやAPIで収集したIT記事をGeminiで要約する構成を紹介している。本文抽出、長文分割、バッチ処理、DB保存の流れが説明されている。MVPではGemini Flash-Liteを使い、重要記事のみ高性能モデルに切り替える方法が現実的とされている。",
  "key_points": [
    "RSSは記事発見に使い、本文はURLから抽出する",
    "長文記事はチャンク分割して段階要約する",
    "Gemini Flash-Liteは低コストなMVP向けモデルとして使いやすい"
  ],
  "why_it_matters": "低コストでニュース要約アプリを作るための実装方針として参考になる。",
  "tags": ["Gemini", "RSS", "要約", "バッチ処理"],
  "difficulty": "intermediate",
  "importance_score": 78
}
```
