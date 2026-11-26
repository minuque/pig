import { defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { name: "@pig/extensions", maxWorkers },
})
