import { z } from "zod";

export const sourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  siteUrl: z.string().url(),
});

export const articleSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  title: z.string().min(1),
  originalUrl: z.string().url(),
  normalizedUrl: z.string().url(),
  publishedAt: z.string().datetime().nullable(),
  summary: z.string().nullable(),
  summaryBullets: z.array(z.string()).default([]),
  score: z.number().nonnegative().default(0),
});

export const articleSummarySchema = z.object({
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  importanceScore: z.number().int().min(1).max(100),
  keyPoints: z.array(z.string().min(1)).min(1).max(5),
  oneLineSummary: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).max(8).default([]),
  title: z.string().min(1),
  whyItMatters: z.string().min(1),
});

export type Article = z.infer<typeof articleSchema>;
export type ArticleSummary = z.infer<typeof articleSummarySchema>;
export type Source = z.infer<typeof sourceSchema>;
