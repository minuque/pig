import assert from "node:assert/strict"
import { resolve } from "node:path"
import { before, describe, it } from "node:test"

import { scanGraph } from "./graph.mjs"

const root = resolve(import.meta.dirname, "../..")
const hasEdge = (graph, from, to) => graph.edges.some((e) => e.from === from && e.to === to)

describe("scanGraph", () => {
  let graph

  before(() => {
    graph = scanGraph(root)
  })

  it("vue 文件里的别名与 .js 后缀解析到真实 ts 文件", () => {
    assert.ok(
      hasEdge(
        graph,
        "apps/web/src/shell/WorkbenchShell.vue",
        "apps/web/src/features/session/index.ts",
      ),
    )
  })

  it("@pig/* 包名解析到该包 src/index.ts", () => {
    assert.ok(
      hasEdge(graph, "packages/gateway/src/pi/context-usage.ts", "packages/protocol/src/index.ts"),
    )
  })

  it("只收仓库内的文件，节点都有所属包", () => {
    const ids = new Set(graph.files.map((f) => f.id))
    assert.ok(graph.edges.every((e) => ids.has(e.from) && ids.has(e.to)))
    assert.ok(graph.files.every((f) => f.pkg && !f.id.includes("node_modules")))
  })
})
