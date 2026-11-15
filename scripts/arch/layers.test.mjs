import assert from "node:assert/strict"
import { resolve } from "node:path"
import { describe, it } from "node:test"

import { scanGraph } from "./graph.mjs"
import { layersOf } from "./layers.mjs"

const root = resolve(import.meta.dirname, "../..")

describe("layersOf", () => {
  it("矩阵里只有循环内的引用会往回指", () => {
    const graph = scanGraph(root)
    const byId = new Map(graph.files.map((f) => [f.id, f]))
    const layers = layersOf(graph)

    for (const [focus, { order, cycles }] of Object.entries(layers)) {
      const keyOf = (f) => (focus ? f.dir : f.pkg)
      const cycleOf = new Map(cycles.flatMap((c, i) => c.map((k) => [k, i])))

      for (const e of graph.edges) {
        const [a, b] = [byId.get(e.from), byId.get(e.to)]

        if (focus && (a.pkg !== focus || b.pkg !== focus)) continue
        const [ka, kb] = [keyOf(a), keyOf(b)]

        if (ka === kb || (cycleOf.has(ka) && cycleOf.get(ka) === cycleOf.get(kb))) continue
        assert.ok(order.indexOf(ka) < order.indexOf(kb), `${focus || "全部"}: ${ka} -> ${kb}`)
      }
    }
  })
})
