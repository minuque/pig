import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"
import { findMockedWebTests, webAliases } from "./vitest.shared.ts"

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: webAliases },
  test: {
    name: "@pig/web:isolated",
    isolate: true,
    maxWorkers,
    setupFiles: ["./test/setup.ts"],
    include: findMockedWebTests(),
  },
})
