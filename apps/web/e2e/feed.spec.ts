import { expect, test } from "@playwright/test";

test("renders the news feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upto" })).toBeVisible();
  await expect(page.locator("article[data-index='0'] h2")).toBeVisible();
  await expect(page.getByRole("button", { name: "次の記事へ" }).first()).toBeVisible();
});

test("persists the selected color theme across visits", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("upto-theme", "light");
  });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("theme-toggle")).toHaveAttribute("data-theme-icon", "moon");

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("theme-toggle")).toHaveAttribute("data-theme-icon", "sun");
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("upto-theme")))
    .toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "ライトモードに切り替える" })).toBeVisible();

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("upto-theme")))
    .toBe("light");
});

test("moves through cards with keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  await page.keyboard.press("ArrowDown");
  await expect(page.locator("article[data-index='1'] h2")).toBeInViewport();
  await expect
    .poll(async () => page.getByTestId("article-feed").evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await page.keyboard.press("Shift+Space");
  await expect(page.locator("article[data-index='0'] h2")).toBeInViewport();
  await expect
    .poll(async () => page.getByTestId("article-feed").evaluate((element) => element.scrollTop))
    .toBeLessThan(80);
});

test("persists read, saved, progress, and theme state in IndexedDB", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("upto-theme", "light");
  });
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  await page.getByTestId("save-article-0").click();
  await expect(page.getByTestId("save-article-0")).toHaveAttribute("data-saved", "true");

  await page.getByRole("button", { name: "要約を見る" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "要約を閉じる" }).click();

  await page.keyboard.press("ArrowDown");
  await expect(page.locator("article[data-index='1'] h2")).toBeInViewport();

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("upto_user_state");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        const read = <T>(storeName: string, key: IDBValidKey) =>
          new Promise<T | undefined>((resolve, reject) => {
            const transaction = db.transaction(storeName, "readonly");
            const request = transaction.objectStore(storeName).get(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result as T | undefined);
          });

        const [savedArticle, readArticle, readingProgress, themeSetting] = await Promise.all([
          read<{ articleId: string; savedAt: string }>(
            "saved_articles",
            "00000000-0000-4000-8000-000000000001",
          ),
          read<{ articleId: string; readAt: string }>(
            "read_articles",
            "00000000-0000-4000-8000-000000000001",
          ),
          read<{ articleId: string; feedType: string; updatedAt: string }>(
            "reading_progress",
            "home",
          ),
          read<{ key: string; value: string }>("app_settings", "theme"),
        ]);

        db.close();

        return { readArticle, readingProgress, savedArticle, themeSetting };
      }),
    )
    .toMatchObject({
      readArticle: {
        articleId: "00000000-0000-4000-8000-000000000001",
      },
      readingProgress: {
        articleId: "00000000-0000-4000-8000-000000000002",
        feedType: "home",
      },
      savedArticle: {
        articleId: "00000000-0000-4000-8000-000000000001",
      },
      themeSetting: {
        key: "theme",
        value: "dark",
      },
    });

  await page.reload();
  await expect(page.locator("article[data-index='1'] h2")).toBeInViewport();
  await expect(page.getByTestId("save-article-0")).toHaveAttribute("data-saved", "true");
});

test("marks an article read after staying on it for three seconds", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve, reject) => {
            const request = indexedDB.open("upto_user_state");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("read_articles", "readonly");
              const getRequest = transaction
                .objectStore("read_articles")
                .get("00000000-0000-4000-8000-000000000001");
              getRequest.onerror = () => reject(getRequest.error);
              getRequest.onsuccess = () => {
                db.close();
                resolve(Boolean(getRequest.result));
              };
            };
          }),
      ),
    )
    .toBe(true);
});

test("keeps article content inside the active card viewport", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  const metrics = await page.getByTestId("article-feed").evaluate((feed) => {
    const card = feed.querySelector<HTMLElement>("article[data-index='0']");
    const cardRect = card?.getBoundingClientRect();
    const measuredTextBlocks = Array.from(
      feed.querySelectorAll<HTMLElement>("[data-summary-bullets] li, [data-why-it-matters]"),
    );

    return {
      bodyScrollable: document.documentElement.scrollHeight > window.innerHeight,
      cardBottom: cardRect?.bottom ?? 0,
      cardHeight: card?.clientHeight ?? 0,
      cardScrollable: card ? card.scrollHeight > card.clientHeight : true,
      clippedTextBlockCount: measuredTextBlocks.filter(
        (element) => element.scrollHeight > element.clientHeight + 1,
      ).length,
      feedHeight: feed.clientHeight,
      nestedScrollAreaCount: feed.querySelectorAll("[data-article-scroll]").length,
    };
  });

  expect(metrics.bodyScrollable).toBe(false);
  expect(metrics.cardHeight).toBe(metrics.feedHeight);
  expect(metrics.cardBottom).toBeLessThanOrEqual(600);
  expect(metrics.cardScrollable).toBe(false);
  expect(metrics.clippedTextBlockCount).toBe(0);
  expect(metrics.nestedScrollAreaCount).toBe(0);
});

test("keeps key points and why-it-matters readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  const metrics = await page.getByTestId("article-feed").evaluate((feed) => {
    const cards = Array.from(feed.querySelectorAll<HTMLElement>("article[data-index]"));
    const measuredTextBlocks = Array.from(
      feed.querySelectorAll<HTMLElement>("[data-summary-bullets] li, [data-why-it-matters]"),
    );

    return {
      clippedTextBlockCount: measuredTextBlocks.filter(
        (element) => element.scrollHeight > element.clientHeight + 1,
      ).length,
      overflowingCardCount: cards.filter((card) => card.scrollHeight > card.clientHeight + 1)
        .length,
    };
  });

  expect(metrics.clippedTextBlockCount).toBe(0);
  expect(metrics.overflowingCardCount).toBe(0);
});

test("moves only one card with wheel navigation", async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));

  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");
  const feed = page.getByTestId("article-feed");
  await expect(feed).toHaveAttribute("data-ready", "true");

  await page.mouse.move(400, 320);
  await page.mouse.wheel(0, 900);

  await expect(page.locator("article[data-index='1'] h2")).toBeInViewport();
  const feedHeight = await feed.evaluate((element) => element.clientHeight);
  await expect.poll(async () => feed.evaluate((element) => element.scrollTop)).toBe(feedHeight);

  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(100);
  await expect
    .poll(async () => feed.evaluate((element) => element.scrollTop))
    .toBeLessThan(feedHeight * 1.5);
  expect(consoleMessages.join("\n")).not.toContain(
    "Unable to preventDefault inside passive event listener invocation",
  );
});

test("shows the end-of-feed experience after the last article", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");

  await expect(page.getByTestId("feed-complete")).toBeInViewport();
  await expect(page.getByRole("heading", { name: "🎉 今日の新着は以上です" })).toBeVisible();
  await expect(page.getByText("今週の人気記事")).toBeVisible();
  await expect(page.getByText("AIまとめ")).toBeVisible();
  await expect(page.getByText("おすすめ記事")).toBeVisible();
});
