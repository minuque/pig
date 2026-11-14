import { quote, type Environment } from "@pig/environment"
import type { ContentSearchMatch, GitFileStatus } from "@pig/protocol"

/** 一次命令行最多带多少个路径：Windows 命令行有长度上限。 */
const IGNORE_BATCH = 200
/** 内容搜索的上限：与 cc-wrapper 一样，命中、文件数、耗时都封顶。 */
const MAX_MATCHES = 200
const MAX_FILES = 5_000
const MAX_FILE_BYTES = 1024 * 1024
const SEARCH_DEADLINE_MS = 3_000
const MAX_LINE_CHARS = 300

async function run(env: Environment, cwd: string, command: string, signal?: AbortSignal) {
  const chunks: Buffer[] = []
  const { exitCode } = await env.exec(command, {
    cwd,
    onData: (data) => chunks.push(data),
    ...(signal ? { signal } : {}),
  })
  return { exitCode, output: Buffer.concat(chunks).toString("utf8") }
}

/** 哪些路径被 .gitignore 命中；不是 git 仓库或没装 git 时一个都不算。目录要带尾斜杠。 */
export async function gitIgnored(env: Environment, root: string, paths: readonly string[]) {
  const ignored = new Set<string>()

  for (let at = 0; at < paths.length; at += IGNORE_BATCH) {
    const batch = paths.slice(at, at + IGNORE_BATCH)
    const { exitCode, output } = await run(
      env,
      root,
      `git check-ignore -- ${batch.map(quote).join(" ")}`,
    )

    if (exitCode !== 0) {
      if (exitCode === 1) continue
      return ignored
    }

    for (const line of output.split("\n")) if (line) ignored.add(line.replace(/\/$/, ""))
  }

  return ignored
}

function statusLetter(code: string): GitFileStatus["status"] {
  if (code === "??") return "U"

  if (code.includes("D")) return "D"

  if (code.includes("R")) return "R"
  return code[0] === "A" ? "A" : "M"
}

/** 工作区里改动过的文件；路径相对工作区，不是仓库时 repo 为 false。 */
export async function gitStatus(env: Environment, root: string) {
  const { exitCode, output } = await run(
    env,
    root,
    "git rev-parse --show-prefix && git -c core.quotepath=off status --porcelain=v1 -z -uall -- .",
  )

  if (exitCode !== 0) return { repo: false, files: [] as GitFileStatus[] }

  const newline = output.indexOf("\n")
  const prefix = output.slice(0, newline).trim()
  const parts = output.slice(newline + 1).split("\0")
  const files: GitFileStatus[] = []

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!

    if (part.length < 4) continue

    const code = part.slice(0, 2)
    const path = part.slice(3)

    // 改名的下一段是旧路径
    if (code.includes("R") || code.includes("C")) i += 1

    if (path.startsWith(prefix))
      files.push({ path: path.slice(prefix.length), status: statusLetter(code) })
  }

  return { repo: true, files }
}

/** 要搜的文件：git 仓库用 ls-files（自带 .gitignore 过滤），否则走环境自己的遍历。 */
async function candidates(env: Environment, root: string, signal: AbortSignal) {
  const listed = await run(
    env,
    root,
    "git -c core.quotepath=off ls-files -co --exclude-standard -z",
    signal,
  )

  if (listed.exitCode === 0) return listed.output.split("\0").filter(Boolean).slice(0, MAX_FILES)

  const entries = await env.search(root, "", { limit: MAX_FILES, signal })
  return entries.filter((entry) => entry.kind === "file").map((entry) => entry.path)
}

/** 逐个文件找包含 query 的行，大小写不敏感；跳过二进制与过大的文件。 */
export async function searchContents(
  env: Environment,
  root: string,
  join: (root: string, path: string) => string,
  query: string,
  signal: AbortSignal,
) {
  const needle = query.toLowerCase()
  const matches: ContentSearchMatch[] = []
  const deadline = Date.now() + SEARCH_DEADLINE_MS

  if (!needle) return { matches, truncated: false }

  for (const path of await candidates(env, root, signal)) {
    if (signal.aborted || Date.now() > deadline || matches.length >= MAX_MATCHES)
      return { matches, truncated: true }

    const file = join(root, path)
    const info = await env.stat(file).catch(() => undefined)

    if (info?.kind !== "file" || info.size > MAX_FILE_BYTES) continue

    const bytes = await env.readFile(file).catch(() => undefined)

    if (!bytes || bytes.subarray(0, 8000).includes(0)) continue

    const lines = bytes.toString("utf8").split(/\r\n|\n|\r/)

    for (let index = 0; index < lines.length && matches.length < MAX_MATCHES; index += 1) {
      const line = lines[index]!

      if (line.toLowerCase().includes(needle))
        matches.push({ path, line: index + 1, text: line.trim().slice(0, MAX_LINE_CHARS) })
    }
  }

  return { matches, truncated: matches.length >= MAX_MATCHES }
}
