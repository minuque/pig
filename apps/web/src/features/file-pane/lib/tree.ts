export function ancestors(path: string): string[] {
  const parts = path.split("/").slice(0, -1)
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"))
}

type Node = { path: string; kind: string }

export function rowIndex<T extends Node>(
  roots: readonly T[],
  childrenOf: (node: T) => readonly T[] | undefined,
  expanded: readonly string[],
  path: string,
): number {
  const open = new Set(expanded)
  let row = 0

  function walk(nodes: readonly T[]): boolean {
    for (const node of nodes) {
      if (node.path === path) return true
      row += 1

      if (open.has(node.path) && walk(childrenOf(node) ?? [])) return true
    }

    return false
  }

  return walk(roots) ? row : -1
}
