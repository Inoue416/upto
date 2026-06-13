import { expect, test } from "@playwright/test";

test("renders the news feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upto" })).toBeVisible();
  await expect(page.locator("article[data-index='0'] h2")).toBeVisible();
  await expect(page.getByRole("button", { name: "次の記事へ" }).first()).toBeVisible();
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
