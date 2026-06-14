"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FeedArticle } from "../lib/articles";

import { useUserArticleState } from "../lib/use-user-article-state";
import { markArticleRead, markArticleSaved, saveReadingProgress } from "../lib/user-state-db";
import { ThemeToggle } from "./theme-toggle";

type ArticleFeedProps = {
  articles: FeedArticle[];
  feedType?: string;
};

const wheelThreshold = 70;
const wheelCooldownMs = 520;

export function ArticleFeed({ articles, feedType = "home" }: ArticleFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailArticle, setDetailArticle] = useState<FeedArticle | null>(null);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef({
    accumulatedDelta: 0,
    lastDirection: 0,
    lastMoveAt: 0,
  });
  const activeIndexRef = useRef(activeIndex);
  const articleIds = useMemo(() => articles.map((article) => article.id), [articles]);
  const articleIdsKey = useMemo(() => articleIds.join("\u001f"), [articleIds]);
  const userState = useUserArticleState(articleIds, feedType);
  const activeArticle = activeIndex < articles.length ? articles[activeIndex] : null;

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    setHasRestoredProgress(false);
  }, [articleIdsKey, feedType]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const scrollToIndex = useCallback(
    (nextIndex: number, behavior: ScrollBehavior = "smooth") => {
      if (articles.length === 0) {
        return;
      }

      const boundedIndex = Math.max(0, Math.min(nextIndex, articles.length));
      const container = containerRef.current;
      const target = container?.children.item(boundedIndex);
      activeIndexRef.current = boundedIndex;
      setActiveIndex(boundedIndex);
      if (!(container && target instanceof HTMLElement)) {
        return;
      }

      container.scrollTo({
        behavior,
        top: target.offsetTop - container.offsetTop,
      });
    },
    [articles.length],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || articles.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visibleEntry) {
          return;
        }

        const nextIndex = Number((visibleEntry.target as HTMLElement).dataset.index);
        if (Number.isFinite(nextIndex)) {
          setActiveIndex(nextIndex);
        }
      },
      {
        root: container,
        threshold: [0.55, 0.75],
      },
    );

    for (const child of Array.from(container.children)) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [articles.length]);

  useEffect(() => {
    if (!userState.isLoaded || hasRestoredProgress || articles.length === 0) {
      return;
    }

    const restoredIndex = articles.findIndex(
      (article) => article.id === userState.readingProgressArticleId,
    );
    setHasRestoredProgress(true);
    if (restoredIndex > 0) {
      window.requestAnimationFrame(() => scrollToIndex(restoredIndex, "auto"));
    }
  }, [
    articles,
    hasRestoredProgress,
    scrollToIndex,
    userState.isLoaded,
    userState.readingProgressArticleId,
  ]);

  useEffect(() => {
    if (!(hasRestoredProgress && userState.isLoaded && activeArticle)) {
      return;
    }

    void saveReadingProgress(feedType, activeArticle.id);
  }, [activeArticle, feedType, hasRestoredProgress, userState.isLoaded]);

  useEffect(() => {
    if (!(hasRestoredProgress && activeArticle)) {
      return;
    }

    if (userState.readArticleIds.has(activeArticle.id)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void markArticleRead(activeArticle.id);
    }, 3_000);

    return () => window.clearTimeout(timeoutId);
  }, [activeArticle, hasRestoredProgress, userState.readArticleIds]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown" || (event.key === " " && !event.shiftKey)) {
        event.preventDefault();
        scrollToIndex(activeIndexRef.current + 1);
      }

      if (event.key === "ArrowUp" || (event.key === " " && event.shiftKey)) {
        event.preventDefault();
        scrollToIndex(activeIndexRef.current - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scrollToIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function onWheel(event: WheelEvent) {
      if (articles.length === 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      const now = Date.now();
      const wheelState = wheelRef.current;

      if (now - wheelState.lastMoveAt < wheelCooldownMs) {
        event.preventDefault();
        return;
      }

      const direction = Math.sign(event.deltaY);
      if (direction !== wheelState.lastDirection) {
        wheelState.accumulatedDelta = 0;
        wheelState.lastDirection = direction;
      }

      wheelState.accumulatedDelta += event.deltaY;
      event.preventDefault();
      if (Math.abs(wheelState.accumulatedDelta) < wheelThreshold) {
        return;
      }

      scrollToIndex(activeIndexRef.current + (wheelState.accumulatedDelta > 0 ? 1 : -1));
      wheelState.accumulatedDelta = 0;
      wheelState.lastMoveAt = now;
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [articles.length, scrollToIndex]);

  function openDetail(article: FeedArticle) {
    setDetailArticle(article);
    void markArticleRead(article.id);
  }

  function toggleSaved(article: FeedArticle, isSaved: boolean) {
    void markArticleSaved(article.id, !isSaved);
  }

  if (articles.length === 0) {
    return (
      <section className="flex h-dvh flex-col overflow-hidden">
        <AppHeader activeIndex={0} articleCount={0} />
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center px-4">
          <p className="text-sm font-medium text-[var(--accent)]">Upto</p>
          <h1 className="mt-3 text-3xl leading-tight font-semibold text-balance">
            まだ表示できる記事がありません
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-[var(--muted)]">
            collector batch を実行して、要約済みの記事がDBへ保存されるとここに表示されます。
            本番環境では `DATABASE_URL` を設定し、定期バッチを起動してください。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-dvh flex-col overflow-hidden">
      <AppHeader activeIndex={activeIndex} articleCount={articles.length} />

      <div
        ref={containerRef}
        className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain scroll-smooth"
        data-ready={isReady ? "true" : "false"}
        data-testid="article-feed"
      >
        {articles.map((article, index) => {
          const isRead = userState.readArticleIds.has(article.id);
          const isSaved = userState.savedArticleIds.has(article.id);

          return (
            <article
              data-index={index}
              key={article.id}
              className="mx-auto flex h-full max-w-3xl snap-start items-center px-4 py-3"
            >
              <div className="flex h-full w-full flex-col overflow-hidden">
                <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-xs font-medium">
                  <span
                    aria-label={isRead ? "既読" : "未読"}
                    className={
                      isRead
                        ? "size-2 rounded-full bg-[var(--border-strong)]"
                        : "size-2 rounded-full bg-blue-500"
                    }
                    title={isRead ? "既読" : "未読"}
                  />
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[var(--accent)]">
                    {article.sourceName}
                  </span>
                  <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-[var(--muted)] shadow-sm">
                    {difficultyLabel(article.difficulty)}
                  </span>
                  {article.publishedAt ? (
                    <time
                      className="text-[var(--muted)]"
                      dateTime={article.publishedAt}
                      title={formatAbsoluteDate(article.publishedAt)}
                    >
                      {formatRelativeDate(article.publishedAt)}
                    </time>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-start gap-2">
                  {isSaved ? (
                    <span
                      aria-label="保存済み"
                      className="mt-1 text-lg leading-none text-[var(--accent)]"
                      title="保存済み"
                    >
                      ★
                    </span>
                  ) : null}
                  <h2
                    className={`line-clamp-2 text-xl leading-snug text-balance sm:text-2xl ${
                      isRead
                        ? "font-normal text-[var(--muted)]"
                        : "font-semibold text-[var(--foreground)]"
                    }`}
                  >
                    {article.title}
                  </h2>
                </div>
                {article.oneLineSummary ? (
                  <p
                    className={`mt-2 line-clamp-1 shrink-0 text-sm leading-6 font-medium sm:text-base ${
                      isRead ? "text-[var(--muted)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {article.oneLineSummary}
                  </p>
                ) : null}
                <p className="mt-2 hidden shrink-0 text-sm leading-6 text-[var(--muted)] sm:line-clamp-1 sm:block">
                  {article.summary}
                </p>

                <ul className="mt-3 shrink-0 space-y-1.5" data-summary-bullets="true">
                  {article.summaryBullets.slice(0, 3).map((bullet) => (
                    <li
                      key={bullet}
                      className="rounded-lg bg-[var(--surface)] px-3 py-1.5 text-sm leading-5 shadow-sm"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>

                {article.whyItMatters ? (
                  <p
                    className="mt-3 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs leading-5 text-[var(--muted)]"
                    data-why-it-matters="true"
                  >
                    {article.whyItMatters}
                  </p>
                ) : null}

                <div className="mt-3 flex h-6 shrink-0 flex-nowrap gap-2 overflow-hidden">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span
                      className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                      key={tag}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium transition hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      onClick={() => openDetail(article)}
                      type="button"
                    >
                      詳細
                    </button>
                    <a
                      className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      href={article.originalUrl}
                      onClick={() => {
                        void markArticleRead(article.id);
                      }}
                      rel="noreferrer"
                      target="_blank"
                    >
                      元記事を読む
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs whitespace-nowrap text-[var(--muted)]">
                      score {Math.round(article.score)} / {article.bookmarks} bookmarks
                    </span>
                    <button
                      aria-label={isSaved ? "保存を解除する" : "記事を保存する"}
                      aria-pressed={isSaved}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-lg leading-none transition hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      data-saved={isSaved ? "true" : "false"}
                      data-testid={`save-article-${index}`}
                      onClick={() => toggleSaved(article, isSaved)}
                      title={isSaved ? "保存を解除" : "保存"}
                      type="button"
                    >
                      {isSaved ? "★" : "☆"}
                    </button>
                    <button
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => scrollToIndex(index + 1)}
                      type="button"
                    >
                      {index === articles.length - 1 ? "読み終える" : "次の記事へ"}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex shrink-0 gap-1.5" aria-hidden="true">
                  {articles.map((item, dotIndex) => (
                    <span
                      className={
                        dotIndex === index
                          ? "h-1.5 w-5 rounded-full bg-[var(--accent)]"
                          : "h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]"
                      }
                      key={item.id}
                    />
                  ))}
                </div>
              </div>
            </article>
          );
        })}
        <article
          className="mx-auto flex h-full max-w-3xl snap-start items-center px-4 py-3"
          data-index={articles.length}
          data-testid="feed-complete"
        >
          <div className="w-full">
            <p className="text-sm font-medium text-[var(--accent)]">Upto</p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold text-balance">
              🎉 今日の新着は以上です
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["今週の人気記事", "AIまとめ", "おすすめ記事"].map((label) => (
                <div
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
                  key={label}
                >
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    追加フィードの候補として準備中です。
                  </p>
                </div>
              ))}
            </div>
            <button
              className="mt-6 rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              onClick={() => scrollToIndex(0)}
              type="button"
            >
              先頭へ戻る
            </button>
          </div>
        </article>
      </div>
      {detailArticle ? (
        <ArticleDetailDialog article={detailArticle} onClose={() => setDetailArticle(null)} />
      ) : null}
    </section>
  );
}

function AppHeader({ activeIndex, articleCount }: { activeIndex: number; articleCount: number }) {
  return (
    <header className="shrink-0 border-b border-[var(--border)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div>
          <h1 className="text-lg leading-none font-semibold tracking-normal">Upto</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">日本語ITニュース要約</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm text-[var(--muted)] shadow-sm">
            {articleCount === 0
              ? "0 / 0"
              : activeIndex >= articleCount
                ? "完了"
                : `${activeIndex + 1} / ${articleCount}`}
          </span>
        </div>
      </div>
    </header>
  );
}

function ArticleDetailDialog({ article, onClose }: { article: FeedArticle; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <dialog
      aria-modal="true"
      className="fixed inset-0 z-20 m-0 flex h-auto max-h-none max-w-none items-end border-0 bg-black/35 px-3 py-4 text-[var(--foreground)] sm:items-center sm:justify-center"
      open
    >
      <div className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[var(--surface)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[var(--accent)]">{article.sourceName}</p>
            <h2 className="mt-2 text-2xl leading-snug font-semibold text-balance">
              {article.title}
            </h2>
          </div>
          <button
            aria-label="詳細を閉じる"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-lg leading-none hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {article.oneLineSummary ? (
          <p className="mt-4 text-base leading-7 font-medium">{article.oneLineSummary}</p>
        ) : null}
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{article.summary}</p>
        <ul className="mt-4 space-y-2">
          {article.summaryBullets.map((bullet) => (
            <li className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm" key={bullet}>
              {bullet}
            </li>
          ))}
        </ul>
        {article.whyItMatters ? (
          <p className="mt-4 rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
            {article.whyItMatters}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
              key={tag}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </dialog>
  );
}

function difficultyLabel(difficulty: FeedArticle["difficulty"]): string {
  if (difficulty === "beginner") {
    return "入門";
  }

  if (difficulty === "advanced") {
    return "深掘り";
  }

  return "実務";
}

function formatAbsoluteDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function formatRelativeDate(value: string): string {
  const publishedAt = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - publishedAt) / 60_000));

  if (diffMinutes < 60) {
    return `${diffMinutes || 1}分前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}日前`;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    timeZone: "Asia/Tokyo",
    day: "numeric",
  }).format(new Date(value));
}
