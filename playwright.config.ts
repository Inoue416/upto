import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  webServer: {
    command: "UPTO_WEB_USE_FIXTURE_DATA=true pnpm dev:web",
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://127.0.0.1:3000",
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
