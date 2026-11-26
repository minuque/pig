import { defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"

export default defineConfig({
  test: { name: "@pig/protocol", maxWorkers },
})
