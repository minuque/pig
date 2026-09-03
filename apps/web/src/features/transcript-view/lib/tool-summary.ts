import { isCommandTool, toolCallDetail, toolPath } from "./transcript-format.js"
import { fileLanguage, pathBasename } from "./tool-presentation.js"
import type { ToolCallView, ToolGroup } from "./transcript-rows.js"

export type ToolSummaryDetail =
  { kind: "file"; name: string; path: string } | { kind: "text"; text: string }

/** Pi 内置：read / write / edit / bash|powershell / grep|find|ls，其余为 tool。 */
export type ToolGroupKey = "read" | "write" | "edit" | "command" | "search" | "tool"

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
    write: `${prefix}写入 ${count} 个文件`,
    command: `${running ? "正在运行" : "运行了"} ${count} 条命令`,
    edit: `${prefix}编辑 ${count} 次文件`,
    search: `${prefix}搜索 ${count} 次`,
    tool: `${prefix}调用 ${count} 次工具`,
  } satisfies Record<ToolGroupKey, string>
  return labels[key]
}

export function toolDetail(toolName: string, input: unknown): ToolSummaryDetail | null {
  const text = toolCallDetail(toolName, input)
  if (!isCommandTool(toolName)) {
    const path = toolPath(input) || (isFilePathDetail(text) ? text : "")
    if (path) return { kind: "file", name: pathBasename(path), path }
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
