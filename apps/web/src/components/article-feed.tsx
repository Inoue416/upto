"use client";

import type { Article } from "@upto/domain";

import { useCallback, useEffect, useRef, useState } from "react";

type ArticleFeedProps = {
  articles: Article[];
};

export function ArticleFeed({ articles }: ArticleFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      const boundedIndex = Math.max(0, Math.min(nextIndex, articles.length - 1));
      setActiveIndex(boundedIndex);
      containerRef.current?.children.item(boundedIndex)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [articles.length],
  );

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

  return (
    <section className="min-h-screen">
      <header className="fixed top-0 right-0 left-0 z-10 border-b border-black/10 bg-[var(--background)]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-semibold tracking-normal">Upto</h1>
          <span className="text-sm text-[var(--muted)]">
            {activeIndex + 1} / {articles.length}
          </span>
        </div>
      </header>

      <div
        ref={containerRef}
        className="h-screen snap-y snap-mandatory overflow-y-auto scroll-smooth pt-14"
      >
        {articles.map((article, index) => (
          <article
            key={article.id}
            className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl snap-start flex-col justify-center px-4 py-8"
          >
            <p className="mb-3 text-sm text-[var(--accent)]">IT News</p>
            <h2 className="text-3xl leading-tight font-semibold">{article.title}</h2>
            <p className="mt-5 text-lg leading-8 text-[var(--muted)]">{article.summary}</p>
            <ul className="mt-6 space-y-3">
              {article.summaryBullets.map((bullet) => (
                <li key={bullet} className="rounded-lg bg-[var(--surface)] p-4 shadow-sm">
                  {bullet}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center justify-between gap-4">
              <a
                className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white"
                href={article.originalUrl}
                rel="noreferrer"
                target="_blank"
              >
                元記事を読む
              </a>
              <button
                className="rounded-md border border-black/15 px-4 py-2 text-sm"
                onClick={() => scrollToIndex(index + 1)}
                type="button"
              >
                次の記事へ
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
