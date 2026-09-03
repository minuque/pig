import type {
  EditDiffPreview,
  ToolCallView,
  ToolGroup,
  ToolGroupKey,
  ToolSummaryDetail,
} from "@features/transcript-view/type.js"
import { isCommandTool, toolCallDetail, toolPath } from "./transcript-format.js"
import { fileLanguage, pathBasename } from "./tool-presentation.js"

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
  return {
    path,
    fileName: path ? pathBasename(path) : "file",
    language: fileLanguage(path),
    hunks: pairs.map((pair) => ({ original: pair.oldText, modified: pair.newText })),
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
  return toolDetail(first.toolName, first.input)
}

function isFilePathDetail(text: string): boolean {
  if (!text || /\s/.test(text) || text.includes("://")) return false
  if (/[\\/]/.test(text)) return true
  return text.includes(".") && fileLanguage(text) !== "text"
}

export function directGroupItem(group: ToolGroup): ToolCallView | undefined {
  return group.items.length === 1 ? group.items[0] : undefined
}
