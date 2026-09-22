import type { ThoughtStep, ToolGroupKey, ToolRow } from "@features/transcript-view/type.js"

export function thoughtStepLabel(step: ThoughtStep, completedAt = step.endedAt): string {
  if (step.streaming) return "思考中"

  const seconds = Math.max(1, Math.round(((completedAt ?? step.startedAt) - step.startedAt) / 1000))
  return `思考了 ${seconds} 秒`
}

function formatToolRowDuration(ms: number, showZero = false): string {
  const total = Math.round(ms / 1000)

  if (total < 0 || (total === 0 && !showZero)) return ""
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts: string[] = []

  if (hours) parts.push(`${hours}h`)

  if (hours || minutes) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

export function toolRowDurationLabel(row: ToolRow, now: number): string {
  const start = row.startedAt

  if (start == null) return ""

  if (row.mode === "live") return formatToolRowDuration(now - start, true)
  const end = row.endedAt

  if (end == null || end <= start) return ""
  return formatToolRowDuration(end - start)
}

const TOOL_ROW_ORDER = ["read", "write", "edit", "command", "search", "tool"] as const
const TOOL_ROW_LABEL = {
  read: (n: number) => `读 ${n} 次文件`,
  write: (n: number) => `写 ${n} 次文件`,
  edit: (n: number) => `编辑 ${n} 次文件`,
  command: (n: number) => `运行 ${n} 条命令`,
  search: (n: number) => `搜 ${n} 次`,
  tool: (n: number) => `调用工具 ${n} 次`,
} as const satisfies Record<ToolGroupKey, (count: number) => string>

export type ToolRowLabelPart =
  { kind: "text"; text: string } | { kind: "count"; prefix: string; count: number; suffix: string }

export function toolRowLabelParts(row: ToolRow): ToolRowLabelPart[] {
  const counts = new Map<ToolGroupKey, number>()
  let thoughts = 0

  for (const step of row.steps) {
    if (step.type === "thought") thoughts += 1
    else counts.set(step.key, (counts.get(step.key) ?? 0) + step.items.length)
  }

  const parts: ToolRowLabelPart[] = []

  if (thoughts) parts.push({ kind: "text", text: `思考 ${thoughts} 轮` })

  for (const key of TOOL_ROW_ORDER) {
    const count = counts.get(key)

    if (!count) continue

    if (key === "write") parts.push({ kind: "count", prefix: "写", count, suffix: "次文件" })
    else if (key === "edit") parts.push({ kind: "count", prefix: "编辑", count, suffix: "次文件" })
    else parts.push({ kind: "text", text: TOOL_ROW_LABEL[key](count) })
  }

  if (row.aborted)
    return parts.length
      ? [{ kind: "text", text: "已停止" }, ...parts]
      : [{ kind: "text", text: "已停止" }]

  if (parts.length) return parts
  return [{ kind: "text", text: row.mode === "live" ? "执行中" : "执行过程" }]
}

export function toolRowLabel(row: ToolRow): string {
  return toolRowLabelParts(row)
    .map((part) =>
      part.kind === "text" ? part.text : `${part.prefix} ${part.count} ${part.suffix}`,
    )
    .join(" · ")
}

export function toolRowFailCount(row: ToolRow): number {
  let count = 0

  for (const step of row.steps) {
    if (step.type !== "tools") continue

    for (const item of step.items) if (item.isError) count += 1
  }

  return count
}
