"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FeedArticle } from "../lib/articles";

import { ThemeToggle } from "./theme-toggle";

type ArticleFeedProps = {
  articles: FeedArticle[];
};

const wheelThreshold = 70;
const wheelCooldownMs = 520;

export function ArticleFeed({ articles }: ArticleFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef({
    accumulatedDelta: 0,
    lastDirection: 0,
    lastMoveAt: 0,
  });
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      if (articles.length === 0) {
        return;
      }

      const boundedIndex = Math.max(0, Math.min(nextIndex, articles.length - 1));
      const container = containerRef.current;
      const target = container?.children.item(boundedIndex);
      setActiveIndex(boundedIndex);
      if (!(container && target instanceof HTMLElement)) {
        return;
      }

      container.scrollTo({
        behavior: "smooth",
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
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown" || (event.key === " " && !event.shiftKey)) {
        event.preventDefault();
        scrollToIndex(activeIndex + 1);
      }

      if (event.key === "ArrowUp" || (event.key === " " && event.shiftKey)) {
        event.preventDefault();
        scrollToIndex(activeIndex - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, scrollToIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function onWheel(event: WheelEvent) {
      if (articles.length < 2 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
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
        {articles.map((article, index) => (
          <article
            data-index={index}
            key={article.id}
            className="mx-auto flex h-full max-w-3xl snap-start items-center px-4 py-3"
          >
            <div className="flex h-full w-full flex-col overflow-hidden">
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-xs font-medium">
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

              <h2 className="line-clamp-2 shrink-0 text-xl leading-snug font-semibold text-balance sm:text-2xl">
                {article.title}
              </h2>
              {article.oneLineSummary ? (
                <p className="mt-2 line-clamp-1 shrink-0 text-sm leading-6 font-medium text-[var(--foreground)] sm:text-base">
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
                <a
                  className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  href={article.originalUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  元記事を読む
                </a>
                <div className="flex items-center gap-3">
                  <span className="text-xs whitespace-nowrap text-[var(--muted)]">
                    score {Math.round(article.score)} / {article.bookmarks} bookmarks
                  </span>
                  <button
                    className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={articles.length < 2}
                    onClick={() => scrollToIndex(index === articles.length - 1 ? 0 : index + 1)}
                    type="button"
                  >
                    {index === articles.length - 1 ? "先頭へ戻る" : "次の記事へ"}
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
        ))}
      </div>
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
            {articleCount === 0 ? "0 / 0" : `${activeIndex + 1} / ${articleCount}`}
          </span>
        </div>
      </div>
    </header>
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
