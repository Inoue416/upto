import { describe, expect, it } from "vitest";

import { calculateTrendScore } from "./score.js";

describe("calculateTrendScore", () => {
  it("adds stronger weight to bookmarks than views", () => {
    expect(calculateTrendScore({ bookmarks: 10, views: 0, ageHours: 1 })).toBeGreaterThan(
      calculateTrendScore({ bookmarks: 0, views: 100, ageHours: 1 }),
    );
  });
});
