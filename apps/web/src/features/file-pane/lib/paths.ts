import { toolGroupKey } from "@features/transcript-view/lib/tool-summary.js"
import { toolPath } from "@features/transcript-view/lib/transcript-format.js"
import type { TranscriptItem } from "@/types/common-type.js"

export interface WorkspaceTarget {
  path: string
  line?: number
  endLine?: number
}

/** 协议名至少两个字母，这样 C: 这样的盘符不会被当成协议。 */
const SCHEME = /^[a-z][a-z\d+.-]+:/i
const LINE_SUFFIX = /(?:#L(\d+)(?:-L?(\d+))?|:(\d+)(?:-(\d+))?(?::\d+)?)$/
const slashes = (value: string) => value.replace(/\\/g, "/")
const isAbsolute = (value: string) => value.startsWith("/") || /^[a-z]:\//i.test(value)

/** 远程工作区键 ssh://别名/路径 的根就是后面那段路径。 */
function workspaceRoot(cwd: string): string {
  return slashes(cwd.replace(/^ssh:\/\/[^/]+/, "")).replace(/\/+$/, "")
}

function decode(value: string): string {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

/** 对话里的一个路径或链接 → 工作区内的相对路径与行号；网址、工作区外的路径给 undefined。 */
export function workspacePath(cwd: string, raw: string): WorkspaceTarget | undefined {
  let value = raw.trim()
  const lines = LINE_SUFFIX.exec(value)
  const start = Number(lines?.[1] ?? lines?.[3]) || undefined
  const end = Number(lines?.[2] ?? lines?.[4]) || start

  if (lines) value = value.slice(0, lines.index)

  if (value.startsWith("file://"))
    value = value.slice("file://".length).replace(/^\/(?=[a-z]:)/i, "")
  else if (!value || value.startsWith("#") || SCHEME.test(value)) return undefined

  value = slashes(decode(value)).replace(/^(\.\/)+/, "")

  if (isAbsolute(value)) {
    const root = workspaceRoot(cwd)
    const windows = /^[a-z]:\//i.test(root)
    const same = windows
      ? value.toLowerCase().startsWith(`${root.toLowerCase()}/`)
      : value.startsWith(`${root}/`)

    if (!same) return undefined
    value = value.slice(root.length + 1)
  }

  if (!value || value.split("/").includes("..")) return undefined
  return start ? { path: value, line: start, endLine: end ?? start } : { path: value }
}

/** 片段在文本里第一次出现的行范围（从 1 起）。 */
export function locateLines(text: string, snippet: string) {
  const at = snippet ? text.indexOf(snippet) : -1

  if (at < 0) return undefined

  const line = text.slice(0, at).split("\n").length
  return { line, endLine: line + snippet.split("\n").length - 1 }
}

/** 已完成的编辑与写入，路径换成工作区内的相对路径。 */
export function finishedWrites(cwd: string, items: readonly TranscriptItem[]) {
  return items.flatMap((item) => {
    if (item.role !== "tool" || item.status !== "complete") return []

    const group = toolGroupKey(item.toolName)

    if (group !== "edit" && group !== "write") return []

    const target = workspacePath(cwd, toolPath(item.input))
    return target ? [{ id: item.id, path: target.path }] : []
  })
}
