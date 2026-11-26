import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { classifyTouched } from "./scope.mjs"

describe("classifyTouched", () => {
  it("只映射脏文件所属包", () => {
    const scope = classifyTouched(["apps/web/src/client/transport.ts", "apps/web/test/x.ts"])
    assert.deepEqual(scope.packages, ["@pig/web"])
    assert.equal(scope.escalate, false)
    assert.deepEqual(scope.lintFiles, ["apps/web/src/client/transport.ts", "apps/web/test/x.ts"])
  })

  it("根配置改动升级全量 check", () => {
    assert.equal(classifyTouched([".oxlintrc.json"]).escalate, true)
    assert.equal(classifyTouched(["stylelint.config.js"]).escalate, true)
    assert.equal(classifyTouched(["scripts/check/lint-ignores.mjs"]).escalate, true)
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
    const scope = classifyTouched(["e2e/support/checkpoint.ts"])
    assert.equal(scope.e2e, true)
    assert.equal(scope.scripts, false)
    assert.deepEqual(scope.packages, [])
  })

  it("改上游包连带检查依赖它的包", () => {
    assert.deepEqual(classifyTouched(["packages/gateway/src/cli.ts"]).packages, [
      "@pig/gateway",
      "@pig/desktop",
    ])
    assert.deepEqual(classifyTouched(["packages/ui/src/ui/button/Button.vue"]).packages, [
      "@pig/ui",
      "@pig/web",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/App.vue"]).packages, ["@pig/web"])
  })

  it("按改动区域挑 e2e，未命中的 web 改动回落到新建会话旅程", () => {
    assert.deepEqual(classifyTouched(["apps/web/src/features/composer/index.vue"]).specs, [
      "e2e/composer/",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/style/app.css"]).specs, [
      "e2e/conversation/new-session.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/features/session-nav/index.vue"]).specs, [
      "e2e/sidebar/",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/shell/WorkbenchShell.vue"]).specs, [
      "e2e/workbench/split-view.spec.ts",
      "e2e/conversation/new-session.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/features/theme/lib/palette.ts"]).specs, [
      "e2e/conversation/new-session.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/features/startup/index.ts"]).specs, [
      "e2e/conversation/new-session.spec.ts",
      "e2e/startup/",
    ])
    assert.deepEqual(classifyTouched(["apps/web/src/App.vue"]).specs, [
      "e2e/conversation/new-session.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["e2e/support/fixtures.ts"]).specs, [])
    assert.deepEqual(classifyTouched(["e2e/composer/composer-queue.spec.ts"]).specs, [
      "e2e/composer/composer-queue.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["packages/ui/src/ui/button/Button.vue"]).specs, [
      "e2e/conversation/new-session.spec.ts",
    ])
    assert.deepEqual(classifyTouched(["packages/gateway/test/host.test.ts"]).specs, [])
    assert.deepEqual(classifyTouched(["apps/web/test/client/local-cwd.test.ts"]).specs, [])
    assert.deepEqual(classifyTouched(["docs/CODEBASE.md"]).specs, [])
  })

  it("波及所有旅程的改动要全量 e2e，只动某块界面的按映射跑", () => {
    for (const file of [
      "e2e/support/fixtures.ts",
      "packages/gateway/src/server/host.ts",
      "packages/protocol/src/index.ts",
      "apps/web/vite.config.ts",
      "package.json",
    ])
      assert.equal(classifyTouched([file]).e2eAll, true, file)

    for (const file of [
      "apps/web/src/features/composer/index.vue",
      "e2e/composer/composer-queue.spec.ts",
      "packages/ui/src/ui/button/Button.vue",
      "packages/gateway/test/host.test.ts",
      "apps/web/test/client/local-cwd.test.ts",
      "docs/CODEBASE.md",
    ])
      assert.equal(classifyTouched([file]).e2eAll, false, file)
  })

  it("UI 改动（模板与样式）标记为 ui，纯数据不算", () => {
    assert.equal(classifyTouched(["apps/web/src/App.vue"]).ui, true)
    assert.equal(classifyTouched(["apps/web/src/style/app.css"]).ui, true)
    assert.equal(classifyTouched(["packages/ui/src/ui/button/Button.vue"]).ui, true)
    assert.equal(classifyTouched(["packages/ui/src/theme/palette.ts"]).ui, false)
    assert.equal(classifyTouched(["apps/web/src/features/theme/index.ts"]).ui, false)
    assert.equal(classifyTouched(["packages/gateway/src/cli.ts"]).ui, false)
  })
})
