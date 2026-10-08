import { t } from "@i18n/index.js"
import type { ThoughtStep, ToolGroupKey, ToolRow } from "@features/transcript-view/type.js"

export function thoughtStepLabel(step: ThoughtStep, completedAt = step.endedAt): string {
  if (step.streaming) return t("transcript.thinking")

  const seconds = Math.max(1, Math.round(((completedAt ?? step.startedAt) - step.startedAt) / 1000))
  return t("transcript.thinkingSeconds", { seconds })
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
const TOOL_ROW_LABEL: Record<ToolGroupKey, (count: number) => string> = {
  read: (n) => t("transcript.labelRead", { n }),
  write: (n) => t("transcript.labelWrite", { n }),
  edit: (n) => t("transcript.labelEdit", { n }),
  command: (n) => t("transcript.labelCommand", { n }),
  search: (n) => t("transcript.labelSearch", { n }),
  tool: (n) => t("transcript.labelTool", { n }),
}

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

  if (thoughts) parts.push({ kind: "text", text: t("transcript.labelThinking", { n: thoughts }) })

  for (const key of TOOL_ROW_ORDER) {
    const count = counts.get(key)

    if (!count) continue

    if (key === "write")
      parts.push({
        kind: "count",
        prefix: t("transcript.partWritePrefix"),
        count,
        suffix: t("transcript.partWriteSuffix"),
      })
    else if (key === "edit")
      parts.push({
        kind: "count",
        prefix: t("transcript.partEditPrefix"),
        count,
        suffix: t("transcript.partWriteSuffix"),
      })
    else parts.push({ kind: "text", text: TOOL_ROW_LABEL[key](count) })
  }

  if (row.aborted)
    return parts.length
      ? [{ kind: "text", text: t("transcript.labelStopped") }, ...parts]
      : [{ kind: "text", text: t("transcript.labelStopped") }]

  if (parts.length) return parts
  return [
    {
      kind: "text",
      text: row.mode === "live" ? t("transcript.labelRunning") : t("transcript.labelRunningDone"),
    },
  ]
}

export function toolRowFailCount(row: ToolRow): number {
  let count = 0

  for (const step of row.steps) {
    if (step.type !== "tools") continue

    for (const item of step.items) if (item.isError) count += 1
  }

  return count
}
