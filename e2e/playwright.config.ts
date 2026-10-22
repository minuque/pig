import { defineConfig, devices } from "@playwright/test"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export default defineConfig({
  testDir: dirname(fileURLToPath(import.meta.url)),
  testMatch: "*.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 本地没有 CI 变量，只有 pre-push 跑 e2e；test.only 溜进去就没人发现
  forbidOnly: true,
  globalSetup: resolve(root, "e2e/global-setup.ts"),
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: resolve(root, "playwright-report"),
      },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium" }],
})
