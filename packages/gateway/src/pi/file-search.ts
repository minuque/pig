import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export interface FileSearchEntry {
  /** cwd 相对路径，posix 分隔符。 */
  path: string
  kind: "file" | "directory"
}

/** 递归深度与命中上限：@ 面板只消费头部结果，深树截断不影响候选质量。 */
const MAX_DEPTH = 8
const MAX_RESULTS = 50
/** 遍历时仍继续收候选项，直到足够打分；不再按 4000 条无差别截断。 */
const MAX_CANDIDATES = 2_000
const SKIP_DIRS = new Set([
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

/** 子序列打分：命中越靠开头/连续段，分越高。空查询时遍历顺序流。 */
function score(path: string, query: string): number {
  const target = path.toLowerCase()
  const needle = query.toLowerCase()

  if (!needle) return 0
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

/** 粗过滤：query 的每个字符都出现才进入打分，避免对明显无关条目算分。 */
function candidate(path: string, query: string): boolean {
  const target = path.toLowerCase()

  for (const ch of query.toLowerCase()) {
    if (!target.includes(ch)) return false
  }

  return true
}

interface WalkState {
  candidates: FileSearchEntry[]
  /** 目录仍要继续下探；满了也只影响候选收集，不影响遍历完成。 */
  full: boolean
}

async function walk(dir: string, root: string, depth: number, query: string, state: WalkState) {
  if (depth > MAX_DEPTH || state.full) return
  let entries

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (state.candidates.length >= MAX_CANDIDATES) {
      state.full = true
      return
    }

    const name = entry.name

    if (name.startsWith(".") && depth === 0 && name !== ".pi") continue
    const full = join(dir, name)
    const isDirectory = entry.isDirectory()

    if (!isDirectory && !entry.isFile()) continue
    const rel = relative(root, full).split(sep).join("/")

    if (!rel) continue

    // 目录本身也当候选（带尾斜杠），且要继续下探它的子树
    if (!query || candidate(rel, query)) {
      state.candidates.push({
        path: isDirectory ? `${rel}/` : rel,
        kind: isDirectory ? "directory" : "file",
      })
    }

    if (isDirectory && !SKIP_DIRS.has(name)) await walk(full, root, depth + 1, query, state)

    if (state.full) return
  }
}

/** 按 cwd 搜文件与目录：遍历时做粗过滤，打分只排已命中的候选。 */
export async function searchFiles(
  cwd: string,
  query: string,
  limit = MAX_RESULTS,
): Promise<FileSearchEntry[]> {
  const trimmed = query.trim()
  const state: WalkState = { candidates: [], full: false }

  await walk(cwd, cwd, 0, trimmed, state)

  if (!trimmed) return state.candidates.slice(0, limit)
  const scored: Array<{ entry: FileSearchEntry; value: number }> = []

  for (const entry of state.candidates) {
    const value = score(entry.path, trimmed)

    if (value > Number.NEGATIVE_INFINITY) scored.push({ entry, value })
  }

  scored.sort((a, b) => b.value - a.value)
  return scored.slice(0, limit).map((item) => item.entry)
}
