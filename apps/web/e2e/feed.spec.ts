import { expect, test } from "@playwright/test";

test("renders the news feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upto" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Next.js で縦スワイプ型ニュース UI を作る" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "次の記事へ" }).first()).toBeVisible();
});

test("moves through cards with keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("article-feed")).toHaveAttribute("data-ready", "true");

  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("heading", { name: "ニュース収集バッチを安全に設計する" }),
  ).toBeInViewport();
  await expect
    .poll(async () => page.locator("div.h-screen").evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await page.keyboard.press("Shift+Space");
  await expect(
    page.getByRole("heading", { name: "Next.js で縦スワイプ型ニュース UI を作る" }),
  ).toBeInViewport();
  await expect
    .poll(async () => page.locator("div.h-screen").evaluate((element) => element.scrollTop))
    .toBeLessThan(80);
});
