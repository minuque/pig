import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "@playwright/test"

const here = dirname(fileURLToPath(import.meta.url))

/** 桌面壳冒烟：Electron 自己拉 Vite 与 Gateway，不走 webServer。 */
export default defineConfig({
  testDir: here,
  testMatch: "*.spec.ts",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
})
