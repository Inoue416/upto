import { expect, test } from "@playwright/test";

test("renders the news feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "次の記事へ" }).first()).toBeVisible();
});
