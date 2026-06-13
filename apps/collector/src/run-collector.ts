import { calculateTrendScore, normalizeArticleUrl } from "@upto/domain";
import pLimit from "p-limit";

import type { CollectorConfig } from "./config.js";

import { extractArticleContent } from "./content.js";
import { feedEndpointUrl, fetchFeedItems, type FeedItem, type FeedTarget } from "./feeds.js";
import { createPersistence, type Persistence } from "./persistence.js";
import { createGeminiSummarizer, type Summarizer } from "./summarizer.js";

export type RunCollectorInput = {
  config: CollectorConfig;
  dependencies?: RunCollectorDependencies;
  feeds: FeedTarget[];
};

export type RunCollectorDependencies = {
  fetcher?: typeof fetch;
  logger?: (event: Record<string, unknown>) => void;
  persistence?: Persistence;
  summarizer?: Summarizer;
};

export type RunCollectorResult = {
  articleCount: number;
  dryRun: boolean;
  failedCount: number;
  feedCount: number;
};

export async function runCollector(input: RunCollectorInput): Promise<RunCollectorResult> {
  const logger = input.dependencies?.logger ?? ((event) => console.log(JSON.stringify(event)));

  if (input.config.dryRun) {
    logger({
      dryRun: true,
      feeds: input.feeds.map((feed) => ({
        endpoint: feedEndpointUrl(feed),
        kind: feed.kind,
        name: feed.name,
      })),
      message: "Collector dry run completed. No network, LLM, or DB writes were performed.",
    });

    return {
      articleCount: 0,
      dryRun: true,
      failedCount: 0,
      feedCount: input.feeds.length,
    };
  }

  if (!input.config.databaseUrl && !input.dependencies?.persistence) {
    throw new Error("DATABASE_URL is required when COLLECTOR_DRY_RUN=false.");
  }

  if (!input.config.geminiApiKey && !input.dependencies?.summarizer) {
    throw new Error("GEMINI_API_KEY is required when COLLECTOR_DRY_RUN=false.");
  }

  const persistence =
    input.dependencies?.persistence ?? createPersistence(input.config.databaseUrl ?? "");
  const summarizer =
    input.dependencies?.summarizer ??
    createGeminiSummarizer({
      apiKey: input.config.geminiApiKey ?? "",
      chunkSize: input.config.summaryChunkChars,
      defaultModel: input.config.geminiModelDefault,
      importantModel: input.config.geminiModelImportant,
    });
  const fetcher = input.dependencies?.fetcher ?? fetch;
  const articleLimit = pLimit(input.config.concurrency);

  let articleCount = 0;
  let totalFailedCount = 0;

  for (const feed of input.feeds) {
    const job = await persistence.startFeedJob(feed);
    let feedFetchedCount = 0;
    let feedFailedCount = 0;
    const feedErrors: string[] = [];

    logger({
      endpoint: feedEndpointUrl(feed),
      feed: feed.name,
      jobId: job.jobId,
      status: "started",
    });

    try {
      const items = await fetchFeedItems(feed, input.config.maxItemsPerFeed, fetcher);
      await Promise.all(
        items.map((item) =>
          articleLimit(async () => {
            try {
              await processFeedItem({
                feed,
                fetcher,
                item,
                persistence,
                sourceId: job.sourceId,
                summarizer,
              });
              articleCount += 1;
              feedFetchedCount += 1;
            } catch (error) {
              feedFailedCount += 1;
              const errorMessage = error instanceof Error ? error.message : String(error);
              feedErrors.push(`${item.url}: ${errorMessage}`);
              await markItemFailedIfPossible(persistence, job.sourceId, item, error);
              logger({
                error: errorMessage,
                feed: feed.name,
                status: "article_failed",
                url: item.url,
              });
            }
          }),
        ),
      );
    } catch (error) {
      feedFailedCount += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      feedErrors.push(errorMessage);
      logger({
        error: errorMessage,
        feed: feed.name,
        status: "feed_failed",
      });
    }

    totalFailedCount += feedFailedCount;
    await persistence.finishFeedJob(job.jobId, {
      errorSummary: feedErrors.length > 0 ? feedErrors.slice(0, 10).join("\n") : null,
      failedCount: feedFailedCount,
      fetchedCount: feedFetchedCount,
    });

    logger({
      failedCount: feedFailedCount,
      feed: feed.name,
      fetchedCount: feedFetchedCount,
      jobId: job.jobId,
      status: feedFailedCount > 0 ? "finished_with_errors" : "finished",
    });
  }

  return {
    articleCount,
    dryRun: false,
    failedCount: totalFailedCount,
    feedCount: input.feeds.length,
  };
}

type ProcessFeedItemInput = {
  feed: FeedTarget;
  fetcher: typeof fetch;
  item: FeedItem;
  persistence: Persistence;
  sourceId: string;
  summarizer: Summarizer;
};

async function processFeedItem(input: ProcessFeedItemInput): Promise<void> {
  const normalizedUrl = normalizeArticleUrl(input.item.url);
  const content = await extractArticleContent(
    input.item.url,
    input.item.summaryText,
    input.item.contentHtml,
    input.fetcher,
  );

  if (!content.contentText) {
    throw new Error("No article content was available after extraction and fallback.");
  }

  const summary = await input.summarizer.summarize({
    bookmarks: input.item.bookmarks,
    contentText: content.contentText,
    publishedAt: input.item.publishedAt,
    sourceName: input.feed.name,
    title: input.item.title,
    url: input.item.url,
    views: input.item.views,
  });
  const ageHours = input.item.publishedAt
    ? Math.max(0, (Date.now() - input.item.publishedAt.getTime()) / 3_600_000)
    : 0;
  const score = calculateTrendScore({
    ageHours,
    bookmarks: input.item.bookmarks,
    views: input.item.views,
  });

  await input.persistence.saveArticle({
    content,
    item: input.item,
    modelId: summary.modelId,
    normalizedUrl,
    score,
    sourceId: input.sourceId,
    summary: summary.summary,
  });
}

async function markItemFailedIfPossible(
  persistence: Persistence,
  sourceId: string,
  item: FeedItem,
  error: unknown,
): Promise<void> {
  try {
    await persistence.markArticleFailed({
      error,
      item,
      normalizedUrl: normalizeArticleUrl(item.url),
      sourceId,
    });
  } catch {
    // If the URL itself is invalid, the crawl job error summary is the durable record.
  }
}
