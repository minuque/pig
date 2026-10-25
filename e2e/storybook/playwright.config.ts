import { defineConfig } from "@playwright/test"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "../..")

/** 故事截图基线：独立 playwright 项目，起 Storybook 预览服务后逐故事截图。 */
export default defineConfig({
  testDir: here,
  testMatch: "*.spec.ts",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    // 与 e2e/visual 同口径：抗锯齿抖动可容忍，真变化看得见
    toHaveScreenshot: { maxDiffPixels: 200 },
  },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  webServer: {
    command: "corepack pnpm --filter @pig/web exec storybook dev -p 6007 --ci --no-open",
    cwd: root,
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: "http://127.0.0.1:6007",
    viewport: { width: 900, height: 640 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
})
