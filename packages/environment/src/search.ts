import type { SearchEntry } from "./types.js"

/** 递归深度与遍历总量上限：@ 面板只消费头部结果，深树截断不影响候选质量。 */
export const MAX_DEPTH = 8
export const MAX_VISITED = 20_000
export const MAX_SEARCH_RESULTS = 50
/** 列为候选但不下探的目录。 */
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
/** 根下的隐藏项只留 .pi。 */
export const skipAtRoot = (name: string) => name.startsWith(".") && name !== ".pi"

/** 子序列打分：命中越靠开头/连续段，分越高。 */
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
    // 连续命中与词首命中加权；首字符靠后线性减分
    value +=
      2 + streak * 3 + (hit === 0 || "/_-.".includes(target[hit - 1] ?? "") ? 4 : 0) - hit * 0.01
    at = hit + 1
  }

  // 短路径优先，同分更靠前
  return value - path.length * 0.02
}

/** 空查询按遍历顺序取头部；否则按子序列打分排序。 */
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
