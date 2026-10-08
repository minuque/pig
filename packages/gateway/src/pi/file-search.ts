import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export interface FileSearchEntry {
  /** cwd 相对路径，posix 分隔符。 */
  path: string
  kind: "file" | "directory"
}

/** 递归深度与命中上限：@ 面板只消费头部结果，深树截断不影响候选质量。 */
const MAX_DEPTH = 8
const MAX_ENTRIES = 4_000
const MAX_RESULTS = 50
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

/** 简单子序列打分：命中越靠开头/连续段，分越高。空查询返回顺序流。 */
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

async function walk(dir: string, root: string, depth: number, out: FileSearchEntry[]) {
  if (depth > MAX_DEPTH || out.length >= MAX_ENTRIES) return
  let entries

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (out.length >= MAX_ENTRIES) return
    const name = entry.name

    if (name.startsWith(".") && depth === 0 && name !== ".pi") continue
    const full = join(dir, name)
    const isDirectory = entry.isDirectory()

    if (!isDirectory && !entry.isFile()) continue
    const rel = relative(root, full).split(sep).join("/")

    if (!rel) continue
    out.push({ path: isDirectory ? `${rel}/` : rel, kind: isDirectory ? "directory" : "file" })

    if (isDirectory && !SKIP_DIRS.has(name)) await walk(full, root, depth + 1, out)
  }
}

/** 按 cwd 搜文件与目录：目录带尾斜杠，便于继续键入下钻。 */
export async function searchFiles(
  cwd: string,
  query: string,
  limit = MAX_RESULTS,
): Promise<FileSearchEntry[]> {
  const entries: FileSearchEntry[] = []
  await walk(cwd, cwd, 0, entries)

  const trimmed = query.trim()

  if (!trimmed) return entries.slice(0, limit)
  const scored: Array<{ entry: FileSearchEntry; value: number }> = []

  for (const entry of entries) {
    const value = score(entry.path, trimmed)

    if (value > Number.NEGATIVE_INFINITY) scored.push({ entry, value })
  }

  scored.sort((a, b) => b.value - a.value)
  return scored.slice(0, limit).map((item) => item.entry)
}
