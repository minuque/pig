import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { checkCommentsInSource, isAllowedComment } from "./no-comments.mjs"

describe("no-comments", () => {
  it("放行五类允许注释并拦截普通注释（含正则字符串不误报）", async () => {
    assert.equal(isAllowedComment(" 外部：Chromium 限制"), true)
    assert.equal(isAllowedComment(" oxlint-disable-next-line typescript/no-require-imports"), true)
    assert.equal(isAllowedComment(" 普通解释"), false)

    const source = [
      "const re = /https?:\\/\\/example.com\\/a\\/\\*b\\*/",
      'const str = "// not a comment"',
      "// 普通注释",
      "const ok = 1",
    ].join("\n")
    const hits = await checkCommentsInSource("apps/web/src/a.ts", source)

    assert.deepEqual(hits, [{ line: 3, column: 1 }])
  })

  it("protocol 契约文件放行 JSDoc 块注释，Vue 模板与脚本注释都检出", async () => {
    const proto = "/** 公开契约文档 */\nexport type X = string\n// 内部注释\n"
    assert.deepEqual(await checkCommentsInSource("packages/protocol/src/x.ts", proto), [
      { line: 3, column: 1 },
    ])

    const vue = [
      "<template>",
      "  <!-- eslint-disable-next-line vue/no-v-html -- 放行 -->",
      "  <!-- 模板废话 -->",
      "  <div />",
      "</template>",
      "<script setup>",
      "// 脚本废话",
      "</script>",
    ].join("\n")
    const hits = await checkCommentsInSource("apps/web/src/A.vue", vue)

    assert.equal(hits.length, 2)
    assert.equal(hits[0].line, 3)
    assert.equal(hits[1].line, 7)
  })
})
