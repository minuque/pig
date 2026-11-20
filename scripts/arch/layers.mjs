import { join } from "node:path"
import { pathToFileURL } from "node:url"

export const LAYERS_FILE = "docs/architecture/layers.ts"

export async function loadLayers(root) {
  const { layers } = await import(pathToFileURL(join(root, LAYERS_FILE)).href)
  return layers
}

function cyclesOf(nodes, links) {
  const out = new Map(nodes.map((n) => [n, new Set()]))
  const index = new Map()
  const low = new Map()
  const stack = []
  const done = new Set()
  const cycles = []

  for (const [a, b] of links) out.get(a).add(b)

  const visit = (v) => {
    index.set(v, index.size)
    low.set(v, index.get(v))
    stack.push(v)

    for (const w of out.get(v)) {
      if (!index.has(w)) visit(w)

      if (!done.has(w)) low.set(v, Math.min(low.get(v), low.get(w)))
    }

    if (low.get(v) !== index.get(v)) return
    const members = []
    let w

    do {
      w = stack.pop()
      done.add(w)
      members.push(w)
    } while (w !== v)

    if (members.length > 1) cycles.push(members.sort())
  }

  for (const n of nodes) if (!index.has(n)) visit(n)
  return cycles.sort((x, y) => x[0].localeCompare(y[0]))
}

/** 每个焦点（"" 是包之间，其余是包目录）一份视图：分层、循环、违规；配置和代码对不上时给 errors。 */
export function analyzeLayers({ files, edges }, config) {
  const byId = new Map(files.map((f) => [f.id, f]))
  const pkgs = [...new Set(files.map((f) => f.pkg))]
  const views = {}
  const errors = []
  const foci = [["", (f) => f.pkg, () => true, (d) => d]]

  for (const pkg of pkgs)
    foci.push([
      pkg,
      (f) => f.dir,
      (f) => f.pkg === pkg,
      (d) => (d ? `${pkg}/src/${d}` : `${pkg}/src`),
    ])

  for (const [focus, keyOf, keep, toKey] of foci) {
    const nodes = [...new Set(files.filter(keep).map(keyOf))]

    if (nodes.length < 2) continue
    const where = focus || "包之间"
    const bands = (config[focus] ?? []).map((l) => ({ ...l, keys: l.dirs.map(toKey) }))
    const layerOf = new Map(bands.flatMap((b, i) => b.keys.map((k) => [k, i])))

    for (const k of nodes) if (!layerOf.has(k)) errors.push(`${where}: ${k} 没有归层`)

    for (const k of layerOf.keys())
      if (!nodes.includes(k)) errors.push(`${where}: ${k} 不是现有模块`)

    const counts = new Map()

    for (const e of edges) {
      const [a, b] = [byId.get(e.from), byId.get(e.to)]

      if (!keep(a) || !keep(b) || keyOf(a) === keyOf(b)) continue
      const pair = `${keyOf(a)}\n${keyOf(b)}`
      counts.set(pair, (counts.get(pair) ?? 0) + 1)
    }

    const links = [...counts.keys()].map((p) => p.split("\n"))
    const violations = links
      .filter(([a, b]) => layerOf.get(a) > layerOf.get(b))
      .map(([from, to]) => ({ from, to, count: counts.get(`${from}\n${to}`) }))

    views[focus] = { bands, cycles: cyclesOf(nodes, links), violations }
  }

  return { views, errors }
}
