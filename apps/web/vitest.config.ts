import vue from "@vitejs/plugin-vue"
import { configDefaults, defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"
import { findMockedWebTests, webAliases } from "./vitest.shared.ts"

const mockedTests = findMockedWebTests()

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: webAliases },
  test: {
    name: "@pig/web",
    isolate: false,
    maxWorkers,
    setupFiles: ["./test/setup.ts"],
    exclude: [...configDefaults.exclude, ...mockedTests],
    coverage: {
      reporter: ["text", "html"],
    },
  },
})
