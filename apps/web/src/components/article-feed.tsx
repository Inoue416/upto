"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FeedArticle } from "../lib/articles";

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
    lastMoveAt: 0,
  });

  useEffect(() => {
    setIsReady(true);
  }, []);

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

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (articles.length < 2 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      const now = Date.now();
      const wheelState = wheelRef.current;

      if (now - wheelState.lastMoveAt < wheelCooldownMs) {
        event.preventDefault();
        return;
      }

      wheelState.accumulatedDelta += event.deltaY;
      if (Math.abs(wheelState.accumulatedDelta) < wheelThreshold) {
        return;
      }

      event.preventDefault();
      scrollToIndex(activeIndex + (wheelState.accumulatedDelta > 0 ? 1 : -1));
      wheelState.accumulatedDelta = 0;
      wheelState.lastMoveAt = now;
    },
    [activeIndex, articles.length, scrollToIndex],
  );

  if (articles.length === 0) {
    return (
      <section className="min-h-screen px-4">
        <AppHeader activeIndex={0} articleCount={0} />
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center pt-16">
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
    <section className="min-h-screen">
      <AppHeader activeIndex={activeIndex} articleCount={articles.length} />

      <div
        ref={containerRef}
        className="h-screen snap-y snap-mandatory overflow-y-auto overscroll-y-contain scroll-smooth pt-14"
        data-ready={isReady ? "true" : "false"}
        data-testid="article-feed"
        onWheel={handleWheel}
      >
        {articles.map((article, index) => (
          <article
            data-index={index}
            key={article.id}
            className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl snap-start flex-col justify-center px-4 py-6 sm:py-8"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium">
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

            <h2 className="text-2xl leading-tight font-semibold text-balance sm:text-4xl">
              {article.title}
            </h2>
            {article.oneLineSummary ? (
              <p className="mt-4 text-lg leading-8 font-medium text-[var(--foreground)]">
                {article.oneLineSummary}
              </p>
            ) : null}
            <p className="mt-4 leading-8 text-[var(--muted)]">{article.summary}</p>

            <ul className="mt-5 space-y-3">
              {article.summaryBullets.map((bullet) => (
                <li
                  key={bullet}
                  className="rounded-lg bg-[var(--surface)] px-4 py-3 leading-7 shadow-sm"
                >
                  {bullet}
                </li>
              ))}
            </ul>

            {article.whyItMatters ? (
              <p className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
                {article.whyItMatters}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {article.tags.slice(0, 6).map((tag) => (
                <span
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                  key={tag}
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <a
                className="rounded-md bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                href={article.originalUrl}
                rel="noreferrer"
                target="_blank"
              >
                元記事を読む
              </a>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)]">
                  score {Math.round(article.score)} / {article.bookmarks} bookmarks
                </span>
                <button
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={articles.length < 2}
                  onClick={() => scrollToIndex(index === articles.length - 1 ? 0 : index + 1)}
                  type="button"
                >
                  {index === articles.length - 1 ? "先頭へ戻る" : "次の記事へ"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex gap-1.5" aria-hidden="true">
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
          </article>
        ))}
      </div>
    </section>
  );
}

function AppHeader({ activeIndex, articleCount }: { activeIndex: number; articleCount: number }) {
  return (
    <header className="fixed top-0 right-0 left-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/92 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div>
          <h1 className="text-lg leading-none font-semibold tracking-normal">Upto</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">日本語ITニュース要約</p>
        </div>
        <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm text-[var(--muted)] shadow-sm">
          {articleCount === 0 ? "0 / 0" : `${activeIndex + 1} / ${articleCount}`}
        </span>
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
