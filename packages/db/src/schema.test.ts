import { describe, expect, it } from "vitest";

import { articles, sources } from "./schema.js";

describe("schema", () => {
  it("exports core tables", () => {
    expect(sources).toBeDefined();
    expect(articles).toBeDefined();
  });
});
