import assert from "node:assert/strict"
import { resolve } from "node:path"
import { describe, it } from "node:test"

import { scanGraph } from "./graph.mjs"
import { analyzeLayers, loadLayers } from "./layers.mjs"

const root = resolve(import.meta.dirname, "../..")
const file = (id, dir) => ({ id, pkg: "p", dir })
const graph = {
  files: [
    file("p/src/a/1.ts", "p/src/a"),
    file("p/src/b/1.ts", "p/src/b"),
    file("p/src/c/1.ts", "p/src/c"),
    file("p/src/d/1.ts", "p/src/d"),
  ],
  edges: [
    { from: "p/src/a/1.ts", to: "p/src/c/1.ts" },
    { from: "p/src/c/1.ts", to: "p/src/a/1.ts" },
    { from: "p/src/b/1.ts", to: "p/src/d/1.ts" },
    { from: "p/src/d/1.ts", to: "p/src/b/1.ts" },
  ],
}
const config = {
  "": [{ name: "全部", note: "", dirs: ["p"] }],
  p: [
    { name: "上", note: "", dirs: ["a", "b"] },
    { name: "下", note: "", dirs: ["c", "d"] },
  ],
}

describe("analyzeLayers", () => {
  it("仓库里的分层配置覆盖每个模块", async () => {
    assert.deepEqual(analyzeLayers(scanGraph(root), await loadLayers(root)).errors, [])
  })

  it("漏写的模块和不存在的目录都报错", () => {
    const broken = { ...config, p: [{ name: "上", note: "", dirs: ["a", "b", "c", "x"] }] }
    const { errors } = analyzeLayers(graph, broken)
    assert.equal(errors.length, 2)
    assert.ok(errors.some((e) => e.includes("p/src/d")))
    assert.ok(errors.some((e) => e.includes("p/src/x")))
  })

  it("下层引用上层算违规，互相引用算循环", () => {
    const { views } = analyzeLayers(graph, config)
    assert.deepEqual(views.p.violations.map((v) => `${v.from}>${v.to}`).sort(), [
      "p/src/c>p/src/a",
      "p/src/d>p/src/b",
    ])
    assert.deepEqual(views.p.cycles, [
      ["p/src/a", "p/src/c"],
      ["p/src/b", "p/src/d"],
    ])
  })
})
