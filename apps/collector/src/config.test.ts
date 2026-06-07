import { describe, expect, it } from "vitest";

import { readCollectorConfig } from "./config.js";

describe("readCollectorConfig", () => {
  it("parses COLLECTOR_DRY_RUN=false as false", () => {
    expect(
      readCollectorConfig({
        COLLECTOR_DRY_RUN: "false",
      }).dryRun,
    ).toBe(false);
  });

  it("defaults to dry-run mode", () => {
    expect(readCollectorConfig({}).dryRun).toBe(true);
  });
});
