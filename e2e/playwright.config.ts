import { defineConfig, devices } from "@playwright/test"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export default defineConfig({
  testDir: dirname(fileURLToPath(import.meta.url)),
  testMatch: "*.spec.ts",
  // 故事基线与桌面壳冒烟各自有独立配置和 webServer，不在主配置里跑
  testIgnore: ["electron/**", "storybook/**"],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    // 零容忍会把抗锯齿与字体渲染抖动都算失败，真变化又看不出来
    toHaveScreenshot: { maxDiffPixels: 200 },
  },
  fullyParallel: false,
  // 文件间并行，文件内仍串行；实测 32 条从 38.0s 降到 19.1s
  workers: 4,
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
