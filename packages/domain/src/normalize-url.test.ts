import { describe, expect, it } from "vitest";

import { normalizeArticleUrl } from "./normalize-url.js";

describe("normalizeArticleUrl", () => {
  it("removes tracking parameters and normalizes host casing", () => {
    expect(normalizeArticleUrl("https://Example.com/news?a=1&utm_source=x#section")).toBe(
      "https://example.com/news?a=1",
    );
  });
});
