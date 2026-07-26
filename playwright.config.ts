import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./acceptance",
  globalSetup: "./acceptance/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "line",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testMatch: ["**/critical-journey.spec.ts", "**/browser-smoke.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: "**/browser-smoke.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: "**/browser-smoke.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
