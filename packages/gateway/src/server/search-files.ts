import { readdir, realpath, stat } from "node:fs/promises"
import { join, relative, sep } from "node:path"

export type FileSearchErrorCode = "INVALID_DIRECTORY"

export class FileSearchError extends Error {
  constructor(readonly code: FileSearchErrorCode) {
    super(code)
    this.name = "FileSearchError"
  }
}

export interface FileSearchHit {
  name: string
  path: string
}

/** 工程里体积大、又几乎不会被 @提及 的目录名。 */
const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".venv",
  "__pycache__",
  ".cache",
])
/** 相对 cwd 的遍历层数上限。 */
const MAX_DEPTH = 6
/** 总扫描条目上限：超大仓库超出即停，单次请求不无限跑。 */
const MAX_SCANNED_ENTRIES = 20_000
/** 返回结果上限。 */
const MAX_RESULTS = 50

/**
 * 在 cwd 下按文件名做大小写不敏感的子串匹配，返回相对 cwd 的 POSIX 路径。
 * query 为空（或全空白）时不遍历。
 */
export async function searchFiles(cwd: string, query: string): Promise<FileSearchHit[]> {
  const needle = query.trim().toLowerCase()

  if (!needle) return []

  const root = await resolveSearchRoot(cwd)
  const hits: Array<FileSearchHit & { prefix: boolean }> = []
  const pending: Array<{ directory: string; depth: number }> = [{ directory: root, depth: 0 }]
  let scanned = 0

  while (pending.length > 0 && scanned < MAX_SCANNED_ENTRIES) {
    const next = pending.shift()

    if (!next) break

    // 读不到的目录（权限、并发删除）直接跳过，不影响其余分支
    const entries = await readdir(next.directory, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      if (scanned >= MAX_SCANNED_ENTRIES) break
      scanned += 1

      if (entry.isDirectory()) {
        if (next.depth + 1 >= MAX_DEPTH || SKIP_DIRECTORIES.has(entry.name)) continue
        pending.push({ directory: join(next.directory, entry.name), depth: next.depth + 1 })
        continue
      }

      // withFileTypes 下符号链接既不是 file 也不是 directory，天然跳过，不会绕出 cwd
      if (!entry.isFile() || !entry.name.toLowerCase().includes(needle)) continue

      hits.push({
        name: entry.name,
        path: toPosixRelative(root, join(next.directory, entry.name)),
        prefix: entry.name.toLowerCase().startsWith(needle),
      })
    }
  }

  hits.sort(
    (a, b) =>
      Number(b.prefix) - Number(a.prefix) ||
      a.name.length - b.name.length ||
      a.path.localeCompare(b.path),
  )
  return hits.slice(0, MAX_RESULTS).map(({ name, path }) => ({ name, path }))
}

/** realpath 同时得到绝对路径并消掉 `..` 与符号链接，遍历起点不会穿出调用方给的目录。 */
async function resolveSearchRoot(cwd: string): Promise<string> {
  try {
    const root = await realpath(cwd)
    const info = await stat(root)

    if (!info.isDirectory()) throw new FileSearchError("INVALID_DIRECTORY")
    return root
  } catch (error) {
    if (error instanceof FileSearchError) throw error
    throw new FileSearchError("INVALID_DIRECTORY")
  }
}

function toPosixRelative(root: string, target: string): string {
  return relative(root, target).split(sep).join("/")
}
