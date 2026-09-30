import type {
  EditDiffPreview,
  ToolCallView,
  ToolGroupKey,
  ToolSummaryDetail,
} from "@features/transcript-view/type.js"
import type { SupportedLanguages } from "stream-diffs/pierre"
import {
  isCommandTool,
  toolCallDetail,
  toolPath,
} from "@features/transcript-view/lib/transcript-format.js"

export function pathBasename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path
}

const FILE_LANGUAGES: Record<string, SupportedLanguages> = {
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  vue: "vue",
  json: "json",
  jsonc: "jsonc",
  md: "markdown",
  mdx: "mdx",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  svg: "xml",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  sh: "shellscript",
  bash: "shellscript",
  ps1: "powershell",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sql: "sql",
}

export function readToolPreview(input: unknown, output: string) {
  let startLine = 1

  if (typeof input === "object" && input !== null && "offset" in input) {
    const offset = input.offset

    if (typeof offset === "number" && Number.isSafeInteger(offset) && offset > 0) startLine = offset
  }

  let code = output
  let totalLines: number | null = null
  const notice = output.match(
    /\r?\n\r?\n(\[(?:Showing lines \d+-\d+ of \d+(?: \([^\]\r\n]+\))?\. Use offset=\d+ to continue\.|\d+ more lines in file\. Use offset=\d+ to continue\.)\])$/,
  )

  if (notice) {
    code = output.slice(0, notice.index)
    const range = notice[1]?.match(/Showing lines (\d+)-\d+ of (\d+)/)
    const remaining = notice[1]?.match(/(\d+) more lines in file\. Use offset=(\d+)/)

    if (range) {
      startLine = Number(range[1])
      totalLines = Number(range[2])
    } else if (remaining) {
      totalLines = Number(remaining[1]) + Number(remaining[2]) - 1
    }
  }

  const path = toolPath(input)
  const language = fileLanguage(path)
  const extension = pathBasename(path).split(".").pop()?.toLowerCase() ?? ""
  return {
    code,
    lines: code ? code.split(/\r?\n/) : [],
    startLine,
    totalLines,
    language,
    languageLabel: language === "text" ? "text" : extension,
    notice: notice?.[1] ?? "",
  }
}

export function fileLanguage(path: string): SupportedLanguages {
  const extension = pathBasename(path).split(".").pop()?.toLowerCase() ?? ""
  return FILE_LANGUAGES[extension] ?? "text"
}

export type ReadToolPreview = ReturnType<typeof readToolPreview>

export function toolGroupKey(toolName: string): ToolGroupKey {
  const name = toolName.trim().toLowerCase()

  if (name === "read") return "read"

  if (name === "write") return "write"

  if (name === "edit") return "edit"

  if (isCommandTool(name)) return "command"

  if (name === "grep" || name === "find" || name === "ls") return "search"
  return "tool"
}

export function toolSummary(items: readonly ToolCallView[]): string {
  const first = items[0]

  if (!first) return "工具调用"

  const running = items.some((item) => item.running)
  const count = items.length
  const key = toolGroupKey(first.toolName)
  const prefix = running ? "正在" : "已"
  const labels = {
    read: `${prefix}读取 ${count} 个文件`,
    write: count === 1 ? `${prefix}写入` : `${prefix}写入 ${count} 个文件`,
    command: `${running ? "正在运行" : "运行了"} ${count} 条命令`,
    edit: count === 1 ? `${prefix}编辑` : `${prefix}编辑 ${count} 次文件`,
    search: `${prefix}搜索 ${count} 次`,
    tool: `${prefix}调用 ${count} 次工具`,
  } satisfies Record<ToolGroupKey, string>
  return labels[key]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function splitLines(text: string): string[] {
  if (!text) return []
  const lines = text.split(/\r?\n/)

  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

function lineChange(oldText: string, newText: string): { added: number; removed: number } {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)
  let start = 0
  const shared = Math.min(oldLines.length, newLines.length)

  while (start < shared && oldLines[start] === newLines[start]) start += 1

  let end = 0

  while (
    end < oldLines.length - start &&
    end < newLines.length - start &&
    oldLines[oldLines.length - 1 - end] === newLines[newLines.length - 1 - end]
  ) {
    end += 1
  }

  return {
    added: newLines.length - start - end,
    removed: oldLines.length - start - end,
  }
}

function editReplacements(input: unknown): { oldText: string; newText: string }[] {
  if (!isRecord(input)) return []

  let edits: unknown = input.edits

  if (typeof edits === "string") {
    try {
      edits = JSON.parse(edits) as unknown
    } catch {
      edits = []
    }
  }

  const pairs: { oldText: string; newText: string }[] = []

  if (Array.isArray(edits)) {
    for (const item of edits) {
      if (isRecord(item) && typeof item.oldText === "string" && typeof item.newText === "string") {
        pairs.push({ oldText: item.oldText, newText: item.newText })
      }
    }
  }

  if (typeof input.oldText === "string" && typeof input.newText === "string") {
    pairs.push({ oldText: input.oldText, newText: input.newText })
  }

  return pairs
}

export function editDiffPreview(input: unknown): EditDiffPreview | null {
  const pairs = editReplacements(input)

  if (pairs.length === 0) return null

  const path = toolPath(input)
  let added = 0
  let removed = 0
  const hunks = pairs.map((pair) => {
    const change = lineChange(pair.oldText, pair.newText)
    added += change.added
    removed += change.removed
    return { original: pair.oldText, modified: pair.newText }
  })
  return {
    path,
    fileName: path ? pathBasename(path) : "file",
    language: fileLanguage(path),
    hunks,
    added,
    removed,
  }
}

/** write 没有旧文本，整份 content 当作新增。 */
export function writeDiffPreview(input: unknown): EditDiffPreview | null {
  if (!isRecord(input) || typeof input.content !== "string") return null
  const path = toolPath(input)
  const content = input.content
  return {
    path,
    fileName: path ? pathBasename(path) : "file",
    language: fileLanguage(path),
    hunks: [{ original: "", modified: content }],
    added: splitLines(content).length,
    removed: 0,
  }
}

function withLineChange(
  detail: Extract<ToolSummaryDetail, { kind: "file" }>,
  added: number,
  removed: number,
): ToolSummaryDetail {
  if (added === 0 && removed === 0) return detail
  return { ...detail, added, removed }
}

export function toolDetail(toolName: string, input: unknown): ToolSummaryDetail | null {
  const text = toolCallDetail(toolName, input)

  if (!isCommandTool(toolName)) {
    const path = toolPath(input) || (isFilePathDetail(text) ? text : "")

    if (path) {
      const file = { kind: "file" as const, name: pathBasename(path), path }
      const name = toolName.trim().toLowerCase()

      if (name === "edit") {
        let added = 0
        let removed = 0

        for (const pair of editReplacements(input)) {
          const change = lineChange(pair.oldText, pair.newText)
          added += change.added
          removed += change.removed
        }

        return withLineChange(file, added, removed)
      }

      if (name === "write") {
        const content = isRecord(input) && typeof input.content === "string" ? input.content : ""
        return withLineChange(file, splitLines(content).length, 0)
      }

      return file
    }
  }

  return text ? { kind: "text", text } : null
}

export function toolSummaryDetail(items: readonly ToolCallView[]): ToolSummaryDetail | null {
  const first = items[0]

  if (!first || items.length !== 1) return null

  if (toolGroupKey(first.toolName) === "tool") {
    const name = first.toolName.trim()
    return name ? { kind: "text", text: name } : null
  }

  return toolDetail(first.toolName, first.input)
}

function isFilePathDetail(text: string): boolean {
  if (!text || /\s/.test(text) || text.includes("://")) return false

  if (/[\\/]/.test(text)) return true
  return text.includes(".") && fileLanguage(text) !== "text"
}
