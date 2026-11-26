import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  auditCssTokens,
  auditRepoCssTokens,
  collectRootTokens,
  missingDarkBaseline,
  missingUiContracts,
} from "./css-tokens.mjs"

describe("auditCssTokens", () => {
  it("检出未定义的 CSS 变量并指出文件", () => {
    const result = auditCssTokens({
      tokensCss: ":root { --ok: #000; }",
      files: [{ path: "a.vue", content: "<style>.a { color: var(--missing); }</style>" }],
    })

    assert.deepEqual(result.undefinedRefs, [{ name: "--missing", files: ["a.vue"] }])
    assert.deepEqual(result.unusedTokens, ["--ok"])
  })

  it("放行组件内声明的局部变量与 @ui-sdk 运行时变量", () => {
    const result = auditCssTokens({
      tokensCss: ":root { --bg: #fff; }",
      files: [
        {
          path: "b.vue",
          content: `
            <template><div :style="{ '--inline-var': '1px' }"></div></template>
            <script setup>el.style.setProperty("--dyn", "2px")</script>
            <style>.x { --local: var(--bg); color: var(--local); width: var(--inline-var); max-height: var(--dyn); left: var(--anchor-width); }</style>
          `,
        },
      ],
    })

    assert.deepEqual(result.undefinedRefs, [])
    assert.deepEqual(result.unusedTokens, [])
  })

  it("识别模板前缀、模板后缀以及 tokens.css 内部传递依赖", () => {
    const result = auditCssTokens({
      tokensCss: `
        :root {
          --palette-1: #123;
          --used: var(--palette-1);
          --language-blue: #00f;
          --font-sans-default: sans-serif;
          --orphan-b: #999;
          --orphan-a: var(--orphan-b);
        }
      `,
      files: [
        {
          path: "c.vue",
          content: `
            <script setup>
            const a = \`var(--language-\${hue})\`
            const b = \`var(\${token}-default)\`
            </script>
            <style>.c { color: var(--used); }</style>
          `,
        },
      ],
    })

    assert.deepEqual(result.undefinedRefs, [])
    assert.deepEqual(result.unusedTokens, ["--orphan-a", "--orphan-b"])
  })

  it("collectRootTokens 只采集 :root 声明而不误收其它选择器", () => {
    const vars = collectRootTokens(`
      :root { --a: 1; --b: 2; }
      html.dark { --c: 3; }
      :root, [data-tone="accent"] { --d: 4; }
    `)

    assert.deepEqual([...vars].sort(), ["--a", "--b", "--d"])
  })

  it("检出缺少 :root 基线的 html.dark 变量与缺失的色调契约", () => {
    assert.deepEqual(missingDarkBaseline(":root { --a: 1; } html.dark { --a: 2; --b: 3; }"), [
      "--b",
    ])
    assert.ok(missingUiContracts(":root { --switch-thumb-unchecked: 2px; }").length > 0)
  })

  it("仓库现状 @pig/ui 自洽、无重复 :root 变量、深色覆写有基线且无未定义或死变量", () => {
    const result = auditRepoCssTokens(process.cwd())

    assert.deepEqual(result.uiUndefinedRefs, [])
    assert.deepEqual(result.duplicateRootTokens, [])
    assert.deepEqual(result.uiMissingDarkBaseline, [])
    assert.deepEqual(result.appMissingDarkBaseline, [])
    assert.deepEqual(result.uiMissingContracts, [])
    assert.deepEqual(result.undefinedRefs, [])
    assert.deepEqual(result.unusedTokens, [])
  })
})
