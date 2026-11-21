import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "@playwright/test"

const here = dirname(fileURLToPath(import.meta.url))

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
