import { defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"

export default defineConfig({
  test: { name: "@pig/environment", isolate: false, maxWorkers },
})
