import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { getAgentDir } from "@earendil-works/pi-coding-agent"

/** 侧栏用的会话元数据；字段语义同 pi 的 SessionInfo，但不读全文。 */
export interface IndexedSession {
  path: string
  id: string
  cwd: string
  name?: string
  firstMessage?: string
  parentSessionPath?: string
  created: Date
  modified: Date
  /** subagent 开的子会话；侧栏不列，只在子任务卡片里点开看。 */
  subagent?: true
  /** 文件 mtime 与大小拼成的版本号；内容变了它就变，供下游缓存失效。 */
  version: string
}

type Cached = { mtimeMs: number; size: number; session: IndexedSession | undefined }

const parse = (line: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(line)
    return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function messageText(message: Record<string, unknown>): string {
  const content = message.content

  if (typeof content === "string") return content

  if (!Array.isArray(content)) return ""
  return content
    .filter((block): block is { type: "text"; text: string } => block?.type === "text")
    .map((block) => block.text)
    .join(" ")
}

/** 用户或助手消息的活动时刻：优先消息时间戳，其次条目时间戳。 */
function activityTime(entry: Record<string, unknown>): number | undefined {
  const message = entry.message as Record<string, unknown> | undefined

  if (!message || (message.role !== "user" && message.role !== "assistant")) return undefined

  if (typeof message.timestamp === "number") return message.timestamp
  const at = new Date(String(entry.timestamp)).getTime()
  return Number.isNaN(at) ? undefined : at
}

/** 只解析文件头、改名条目、首条用户句与末尾的消息；其余行只做子串判断。 */
export function indexSessionText(
  path: string,
  text: string,
  mtime: Date,
  version = "",
): IndexedSession | undefined {
  const lines = text.split("\n")
  const header = parse(lines[0] ?? "")

  if (!header || header.type !== "session" || typeof header.id !== "string") return undefined
  let name: string | undefined
  let firstMessage: string | undefined
  let modified: number | undefined
  let subagent = false

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ""

    if (!subagent && line.includes('"customType":"pig.subagent"')) subagent = true

    if (line.includes('"type":"session_info"')) {
      const entry = parse(line)

      if (entry?.type === "session_info")
        name = typeof entry.name === "string" ? entry.name.trim() || undefined : undefined
    } else if (!firstMessage && line.includes('"role":"user"')) {
      const entry = parse(line)
      const message = entry?.message as Record<string, unknown> | undefined

      if (entry?.type === "message" && message?.role === "user")
        firstMessage = messageText(message) || undefined
    }
  }

  for (let index = lines.length - 1; index > 0 && modified === undefined; index -= 1) {
    const line = lines[index] ?? ""

    if (!line.includes('"type":"message"')) continue
    const entry = parse(line)

    if (entry?.type === "message") modified = activityTime(entry)
  }

  const created = new Date(String(header.timestamp))
  return {
    path,
    id: header.id,
    cwd: typeof header.cwd === "string" ? header.cwd : "",
    ...(name ? { name } : {}),
    ...(firstMessage ? { firstMessage } : {}),
    ...(typeof header.parentSession === "string"
      ? { parentSessionPath: header.parentSession }
      : {}),
    created,
    version,
    ...(subagent ? { subagent: true as const } : {}),
    modified: new Date(modified ?? (Number.isNaN(created.getTime()) ? mtime : created).getTime()),
  }
}

/**
 * 会话目录的元数据索引：按文件的 mtime 与大小缓存，没变的文件只做一次 stat。
 * 自定义会话目录是平铺的 .jsonl；缺省目录按工作目录分子目录。
 */
export class SessionIndex {
  private readonly cache = new Map<string, Cached>()

  constructor(private readonly sessionDir?: string) {}

  async list(): Promise<IndexedSession[]> {
    const files = await this.files()
    const live = new Set(files)

    for (const path of this.cache.keys()) if (!live.has(path)) this.cache.delete(path)
    const sessions = await Promise.all(files.map((path) => this.read(path)))
    return sessions
      .filter((session): session is IndexedSession => session !== undefined)
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())
  }

  private async read(path: string): Promise<IndexedSession | undefined> {
    try {
      const info = await stat(path)
      const cached = this.cache.get(path)

      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size)
        return cached.session

      const session = indexSessionText(
        path,
        await readFile(path, "utf8"),
        info.mtime,
        `${info.mtimeMs}:${info.size}`,
      )

      this.cache.set(path, { mtimeMs: info.mtimeMs, size: info.size, session })
      return session
    } catch {
      return undefined
    }
  }

  private async files(): Promise<string[]> {
    if (this.sessionDir) return jsonlIn(this.sessionDir)
    const root = join(getAgentDir(), "sessions")
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    const nested = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => jsonlIn(join(root, entry.name))),
    )
    return nested.flat()
  }
}

async function jsonlIn(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => [])
  return names.filter((name) => name.endsWith(".jsonl")).map((name) => join(dir, name))
}
