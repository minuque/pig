import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { classifyTouched } from "./check-scope.mjs"

describe("classifyTouched", () => {
  it("只映射脏文件所属包", () => {
    const scope = classifyTouched(["apps/web/src/client/transport.ts", "apps/web/test/x.ts"])
    assert.deepEqual(scope.packages, ["@pig/web"])
    assert.equal(scope.escalate, false)
    assert.deepEqual(scope.lintFiles, ["apps/web/src/client/transport.ts", "apps/web/test/x.ts"])
  })

  it("根配置改动升级全量 check", () => {
    assert.equal(classifyTouched(["eslint.config.js"]).escalate, true)
    assert.equal(classifyTouched(["stylelint.config.js"]).escalate, true)
    assert.equal(classifyTouched(["scripts/lint-ignores.mjs"]).escalate, true)
    assert.equal(classifyTouched([".prettierignore"]).escalate, true)
    assert.equal(classifyTouched(["package.json"]).escalate, true)
  })

  it("css 与 vue 走 stylelint", () => {
    const css = classifyTouched(["apps/web/src/style/app.css"])
    assert.deepEqual(css.stylelintFiles, ["apps/web/src/style/app.css"])
    assert.deepEqual(css.lintFiles, [])

    const vue = classifyTouched(["apps/web/src/App.vue"])
    assert.deepEqual(vue.stylelintFiles, ["apps/web/src/App.vue"])
    assert.deepEqual(vue.lintFiles, ["apps/web/src/App.vue"])
    assert.deepEqual(vue.vueFiles, ["apps/web/src/App.vue"])
    assert.deepEqual(css.vueFiles, [])
  })

  it("删除的包内路径仍映射到所属包", () => {
    const scope = classifyTouched(["apps/web/src/gone.vue"])
    assert.deepEqual(scope.packages, ["@pig/web"])
    assert.deepEqual(scope.lintFiles, ["apps/web/src/gone.vue"])
    assert.deepEqual(scope.prettierFiles, ["apps/web/src/gone.vue"])
  })

  it("e2e 目录改动单独标记，不映射到包", () => {
    const scope = classifyTouched(["e2e/checkpoint.ts"])
    assert.equal(scope.e2e, true)
    assert.equal(scope.scripts, false)
    assert.deepEqual(scope.packages, [])
  })

  it("改 gateway 连带检查依赖它的 desktop", () => {
    assert.deepEqual(classifyTouched(["packages/gateway/src/cli.ts"]).packages, [
      "@pig/gateway",
      "@pig/desktop",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/App.vue"]).packages, ["@pig/web"])
  })

  it("按改动区域挑 e2e，未命中的 web 改动回落到关键旅程", () => {
    assert.deepEqual(classifyTouched(["apps/web/src/features/composer/index.vue"]).specs, [
      "e2e/composer-attachments.spec.ts",
      "e2e/composer-queue.spec.ts",
      "e2e/visual/composer.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/style/app.css"]).specs, [
      "e2e/visual/composer.spec.ts",
      "e2e/visual/transcript.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/App.vue"]).specs, [
      "e2e/critical-journey.spec.ts",
    ])
    // e2e 自身改动不按范围判断，交给全量
    assert.deepEqual(classifyTouched(["e2e/fixtures.ts"]).specs, [])
    // 纯文档改动不挑 e2e
    assert.deepEqual(classifyTouched(["docs/directory-structure.md"]).specs, [])
  })

  it("DESIGN.md 触发 designmd 与 token", () => {
    const scope = classifyTouched(["DESIGN.md"])
    assert.equal(scope.designmd, true)
    assert.equal(scope.tokens, true)
    assert.deepEqual(scope.packages, [])
  })
})
