import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

import { auditCssTokens } from "./css-tokens.mjs"

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }

  return out
}

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

  it("仓库现状无未定义变量且无死变量", () => {
    const root = process.cwd()
    const tokensPath = path.join(root, "apps/web/src/style/tokens.css")
    const srcDir = path.join(root, "apps/web/src")
    const paths = [
      path.join(root, "apps/web/index.html"),
      ...walk(srcDir).filter((file) => /\.(vue|css|ts)$/.test(file) && file !== tokensPath),
    ]
    const result = auditCssTokens({
      tokensCss: fs.readFileSync(tokensPath, "utf8"),
      files: paths.map((filePath) => ({
        path: path.relative(root, filePath).replace(/\\/g, "/"),
        content: fs.readFileSync(filePath, "utf8"),
      })),
    })

    assert.deepEqual(result.undefinedRefs, [])
    assert.deepEqual(result.unusedTokens, [])
  })
})
