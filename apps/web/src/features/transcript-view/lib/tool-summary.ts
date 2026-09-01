import { isCommandTool, toolCallDetail } from "./transcript-format.js"
import type { ToolCallView } from "./transcript-rows.js"

export function toolGroupKey(toolName: string): string {
  const name = toolName.trim().toLowerCase()
  if (isCommandTool(name)) return "command"
  if (["write", "edit"].includes(name)) return "edit"
  if (["grep", "find", "ls"].includes(name)) return "search"
  return name
}

export function toolSummary(items: readonly ToolCallView[]): string {
  const first = items[0]
  if (!first) return "工具调用"
  const running = items.some((item) => item.running)
  const count = items.length
  const key = toolGroupKey(first.toolName)
  const prefix = running ? "正在" : "已"
  const labels: Record<string, string> = {
    read: `${prefix}读取 ${count} 个文件`,
    command: `${running ? "正在运行" : "运行了"} ${count} 条命令`,
    edit: `${prefix}编辑 ${count} 次文件`,
    search: `${prefix}搜索 ${count} 次`,
  }
  const label = labels[key] ?? `${prefix}调用 ${first.toolName}${count > 1 ? ` ${count} 次` : ""}`
  return label
}

export function toolSummaryDetail(items: readonly ToolCallView[]): string {
  const first = items[0]
  return first && items.length === 1 ? toolCallDetail(first.toolName, first.input) : ""
}
