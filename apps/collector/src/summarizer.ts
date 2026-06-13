import { GoogleGenAI, Type } from "@google/genai";
import { articleSummarySchema, type ArticleSummary } from "@upto/domain";
import { z } from "zod";

import { splitArticleIntoChunks } from "./content.js";

export type ArticleToSummarize = {
  sourceName: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  contentText: string;
  bookmarks: number;
  views: number;
};

export type Summarizer = {
  summarize(article: ArticleToSummarize): Promise<SummaryResult>;
};

export type SummaryResult = {
  modelId: string;
  summary: ArticleSummary;
};

type GeminiSummarizerOptions = {
  apiKey: string;
  chunkSize: number;
  defaultModel: string;
  importantModel: string;
};

const geminiSummarySchema = z.object({
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  importance_score: z.number().int().min(1).max(100),
  key_points: z.array(z.string().min(1)).min(1).max(5),
  one_line_summary: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).max(8).default([]),
  title: z.string().min(1),
  why_it_matters: z.string().min(1),
});

export function createGeminiSummarizer(options: GeminiSummarizerOptions): Summarizer {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });

  return {
    async summarize(article) {
      const model = chooseModel(article, options.defaultModel, options.importantModel);
      try {
        return await summarizeWithModel(ai, model, article, options.chunkSize);
      } catch (error) {
        if (model === options.defaultModel) {
          throw error;
        }

        return summarizeWithModel(ai, options.defaultModel, article, options.chunkSize);
      }
    },
  };
}

export function createExtractiveSummarizer(): Summarizer {
  return {
    async summarize(article) {
      const sentences = article.contentText
        .split(/(?<=。|\.|!|\?)\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
      const keyPoints = sentences.slice(0, 3);
      const summary = keyPoints.join("\n") || article.title;

      return {
        modelId: "extractive-fallback",
        summary: articleSummarySchema.parse({
          difficulty: "intermediate",
          importanceScore: Math.max(
            1,
            Math.min(100, Math.round(article.bookmarks || article.views || 1)),
          ),
          keyPoints: keyPoints.length > 0 ? keyPoints : [article.title],
          oneLineSummary: keyPoints[0] ?? article.title,
          summary,
          tags: [article.sourceName],
          title: article.title,
          whyItMatters:
            "本文から抽出した暫定要約です。Gemini APIキー設定後にAI要約へ置き換えられます。",
        }),
      };
    },
  };
}

function chooseModel(
  article: ArticleToSummarize,
  defaultModel: string,
  importantModel: string,
): string {
  return article.bookmarks >= 100 || article.views >= 100 ? importantModel : defaultModel;
}

async function requestChunkSummary(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    config: {
      responseMimeType: "text/plain",
    },
    contents: prompt,
    model,
  });

  return readGeminiText(response.text).trim();
}

async function summarizeWithModel(
  ai: GoogleGenAI,
  model: string,
  article: ArticleToSummarize,
  chunkSize: number,
): Promise<SummaryResult> {
  const chunks = splitArticleIntoChunks(article.contentText, chunkSize);
  if (chunks.length === 0) {
    throw new Error("Cannot summarize an article without text.");
  }

  const onlyChunk = chunks[0];
  if (chunks.length === 1 && onlyChunk) {
    return {
      modelId: model,
      summary: await requestFinalSummary(ai, model, buildFinalPrompt(article, onlyChunk)),
    };
  }

  const chunkSummaries = [];
  for (const [index, chunk] of chunks.entries()) {
    chunkSummaries.push(
      await requestChunkSummary(
        ai,
        model,
        buildChunkPrompt(article, chunk, index + 1, chunks.length),
      ),
    );
  }

  return {
    modelId: model,
    summary: await requestFinalSummary(
      ai,
      model,
      buildFinalPrompt(article, chunkSummaries.join("\n\n")),
    ),
  };
}

async function requestFinalSummary(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
): Promise<ArticleSummary> {
  const response = await ai.models.generateContent({
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        properties: {
          difficulty: {
            enum: ["beginner", "intermediate", "advanced"],
            type: Type.STRING,
          },
          importance_score: {
            type: Type.INTEGER,
          },
          key_points: {
            items: { type: Type.STRING },
            type: Type.ARRAY,
          },
          one_line_summary: {
            type: Type.STRING,
          },
          summary: {
            type: Type.STRING,
          },
          tags: {
            items: { type: Type.STRING },
            type: Type.ARRAY,
          },
          title: {
            type: Type.STRING,
          },
          why_it_matters: {
            type: Type.STRING,
          },
        },
        required: [
          "title",
          "one_line_summary",
          "summary",
          "key_points",
          "why_it_matters",
          "tags",
          "difficulty",
          "importance_score",
        ],
        type: Type.OBJECT,
      },
    },
    contents: prompt,
    model,
  });

  const parsed = geminiSummarySchema.parse(
    JSON.parse(stripCodeFence(readGeminiText(response.text))),
  );
  return articleSummarySchema.parse({
    difficulty: parsed.difficulty,
    importanceScore: parsed.importance_score,
    keyPoints: parsed.key_points,
    oneLineSummary: parsed.one_line_summary,
    summary: parsed.summary,
    tags: parsed.tags,
    title: parsed.title,
    whyItMatters: parsed.why_it_matters,
  });
}

function buildChunkPrompt(
  article: ArticleToSummarize,
  chunk: string,
  index: number,
  total: number,
): string {
  return `あなたは日本語ITニュースの編集者です。長文記事を分割要約するため、以下の記事チャンクだけを忠実に要約してください。

条件:
- 推測で補わず、チャンク内の事実だけを使う
- 固有名詞、技術名、数値、リリース名を残す
- 最終統合で使いやすいように、重要ポイントを箇条書き中心で返す
- 日本語で返す

記事:
- source: ${article.sourceName}
- title: ${article.title}
- url: ${article.url}
- chunk: ${index}/${total}

本文チャンク:
${chunk}`;
}

function buildFinalPrompt(article: ArticleToSummarize, contentOrChunkSummaries: string): string {
  return `あなたは日本語ITニュース要約アプリの編集者です。以下の記事本文またはチャンク要約を、読者が短時間で判断できる形式に統合してください。

出力条件:
- 必ずJSONだけを返す
- title は記事タイトルを日本語で自然に整える
- one_line_summary は80字以内の1文
- summary は3〜5行相当で、背景、何が変わるか、実務上の影響を含める
- key_points は3〜5個
- why_it_matters はITエンジニアが読む価値を1〜2文で説明する
- tags は最大8個
- difficulty は beginner / intermediate / advanced のいずれか
- importance_score は1〜100の整数
- 誇張や本文にない断定を避ける

期待JSON:
{
  "title": "記事タイトル",
  "one_line_summary": "1行要約",
  "summary": "3〜5行の要約",
  "key_points": ["重要ポイント1", "重要ポイント2", "重要ポイント3"],
  "why_it_matters": "なぜ重要か",
  "tags": ["AI", "TypeScript", "OSS"],
  "difficulty": "beginner | intermediate | advanced",
  "importance_score": 78
}

記事:
- source: ${article.sourceName}
- title: ${article.title}
- url: ${article.url}
- published_at: ${article.publishedAt?.toISOString() ?? "unknown"}
- bookmarks_or_score: ${article.bookmarks}
- comments_or_views: ${article.views}

本文またはチャンク要約:
${contentOrChunkSummaries}`;
}

function stripCodeFence(input: string): string {
  const trimmed = input.trim();
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function readGeminiText(text: string | undefined): string {
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}
