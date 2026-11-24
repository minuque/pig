import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"

export default defineConfig({
  plugins: [vue()],
  test: {
    maxWorkers,
  },
})
