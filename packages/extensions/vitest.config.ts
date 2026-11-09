import { defineConfig } from "vitest/config"

import { maxWorkers } from "../../vitest.workers.mjs"

export default defineConfig({
  // 工作区编译型包在测试里直接用源码
  resolve: { tsconfigPaths: true },
  test: { maxWorkers },
})
