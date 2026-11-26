import { defineConfig } from "vitest/config"

import { maxWorkers } from "./vitest.workers.mjs"

export default defineConfig({
  test: {
    maxWorkers,
    projects: [
      "apps/web/vite.config.ts",
      "apps/desktop/vitest.config.ts",
      "packages/*/vitest.config.ts",
    ],
  },
})
