import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  outputDir: "test-results/e2e-artifacts",
  reporter: isCi ? [["line"], ["html", { open: "never" }]] : "line",
  retries: isCi ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    channel: isCi ? undefined : "chrome",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-dist.mjs",
    reuseExistingServer: !isCi,
    timeout: 30_000,
    url: "http://127.0.0.1:4173",
  },
  workers: 1,
});
