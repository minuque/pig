import assert from "node:assert/strict"
import { resolve } from "node:path"
import { describe, it } from "node:test"

import { buildArchHtml } from "./build.mjs"

const root = resolve(import.meta.dirname, "../..")

describe("buildArchHtml", () => {
  it("生成的单文件包含主题基座、完整数据且无残留占位符", async () => {
    const html = await buildArchHtml(root)

    for (const marker of ["/*__CSS__*/", "/*__PELE__*/", "__ICON__", "/*__DATA__*/", "/*__APP__*/"])
      assert.equal(html.includes(marker), false, `残留占位符 ${marker}`)

    const match = html.match(/globalThis\.__ARCH_DATA__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/)
    assert.ok(match, "缺少内联数据脚本")
    const data = JSON.parse(match[1])
    assert.ok(data.graph.files.length > 0)
    assert.ok(data.flows.length > 0)
    assert.ok(data.api.http.length > 0)
    assert.ok(data.api.ws.commands.length > 0)
  })
})
