import type { SearchEntry } from "./types.js"

export const MAX_DEPTH = 8
export const MAX_VISITED = 20_000
export const MAX_SEARCH_RESULTS = 50
export const SKIP_DIRS = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "dist",
  "out",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "coverage",
  "target",
  "vendor",
  "bin",
  "obj",
  "__pycache__",
  ".venv",
  "venv",
])
export const skipAtRoot = (name: string) => name.startsWith(".") && name !== ".pi"

function score(path: string, needle: string): number {
  const target = path.toLowerCase()
  let value = 0
  let at = 0
  let streak = 0
  let lastHit = -2

  for (const ch of needle) {
    const hit = target.indexOf(ch, at)

    if (hit === -1) return Number.NEGATIVE_INFINITY
    streak = hit === lastHit + 1 ? streak + 1 : 0
    lastHit = hit
    value +=
      2 + streak * 3 + (hit === 0 || "/_-.".includes(target[hit - 1] ?? "") ? 4 : 0) - hit * 0.01
    at = hit + 1
  }

  return value - path.length * 0.02
}

export function rankEntries(
  entries: readonly SearchEntry[],
  query: string,
  limit = MAX_SEARCH_RESULTS,
): SearchEntry[] {
  const needle = query.trim().toLowerCase()

  if (!needle) return entries.slice(0, limit)
  const scored: Array<{ entry: SearchEntry; value: number }> = []

  for (const entry of entries) {
    const value = score(entry.path, needle)

    if (value > Number.NEGATIVE_INFINITY) scored.push({ entry, value })
  }

  scored.sort((a, b) => b.value - a.value)
  return scored.slice(0, limit).map((item) => item.entry)
}
