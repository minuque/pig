/** 给依赖矩阵排层：循环折成一组，组按"引用方在前、被引用方在后"排，同层按名字。 */
function order(nodes, links) {
  const out = new Map(nodes.map((n) => [n, new Set()]))

  for (const [a, b] of links) out.get(a).add(b)

  // Tarjan 求强连通分量
  const index = new Map()
  const low = new Map()
  const stack = []
  const comp = new Map()
  const comps = []
  const visit = (v) => {
    index.set(v, index.size)
    low.set(v, index.get(v))
    stack.push(v)

    for (const w of out.get(v)) {
      if (!index.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v), low.get(w)))
      } else if (!comp.has(w)) low.set(v, Math.min(low.get(v), index.get(w)))
    }

    if (low.get(v) !== index.get(v)) return
    const members = []
    let w

    do {
      w = stack.pop()
      comp.set(w, comps.length)
      members.push(w)
    } while (w !== v)

    comps.push(members.sort())
  }

  for (const n of nodes) if (!index.has(n)) visit(n)

  // 分量的高度：到最底层的最长路径
  const height = new Map()
  const heightOf = (c) => {
    if (!height.has(c)) {
      let h = 0

      for (const v of comps[c])
        for (const w of out.get(v))
          if (comp.get(w) !== c) h = Math.max(h, heightOf(comp.get(w)) + 1)
      height.set(c, h)
    }

    return height.get(c)
  }
  const sorted = comps
    .map((_, c) => c)
    .sort((x, y) => heightOf(y) - heightOf(x) || comps[x][0].localeCompare(comps[y][0]))
  return {
    order: sorted.flatMap((c) => comps[c]),
    cycles: comps.filter((c) => c.length > 1),
  }
}

/** 每个焦点一份排层："" 是包之间，包目录是该包内的分组之间。 */
export function layersOf({ files, edges }) {
  const byId = new Map(files.map((f) => [f.id, f]))
  const pkgs = [...new Set(files.map((f) => f.pkg))]
  const layers = {}
  const links = (keyOf, keep) =>
    edges
      .map((e) => [byId.get(e.from), byId.get(e.to)])
      .filter(([a, b]) => keep(a) && keep(b) && keyOf(a) !== keyOf(b))
      .map(([a, b]) => [keyOf(a), keyOf(b)])

  layers[""] = order(
    pkgs,
    links(
      (f) => f.pkg,
      () => true,
    ),
  )

  for (const pkg of pkgs) {
    const keep = (f) => f.pkg === pkg
    const dirs = [...new Set(files.filter(keep).map((f) => f.dir))]
    layers[pkg] = order(
      dirs,
      links((f) => f.dir, keep),
    )
  }

  return layers
}
