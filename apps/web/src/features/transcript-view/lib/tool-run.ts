import { t } from "@i18n/index.js"
import type { ToolCallView, ToolRow } from "@features/transcript-view/type.js"
import {
  toolCallDetail,
  toolCommand,
  toolPath,
} from "@features/transcript-view/lib/transcript-format.js"
import { pathBasename, toolGroupKey } from "@features/transcript-view/lib/tool-summary.js"
import {
  toolRowFailCount,
  toolRowLabelParts,
  toolRowLineChange,
} from "@features/transcript-view/lib/transcript-row-label.js"

export type ToolCallVariant = "command" | "read" | "edit" | "search" | "tool"

const VERB_KEYS = {
  command: "transcript.verbRun",
  read: "transcript.verbRead",
  edit: "transcript.verbEdit",
  search: "transcript.verbSearch",
} as const

export function toolCalls(row: ToolRow): ToolCallView[] {
  return row.steps.flatMap((step) => (step.type === "tools" ? step.items : []))
}

export function toolCallVariant(call: ToolCallView): ToolCallVariant {
  const key = toolGroupKey(call.toolName)

  if (key === "command") return "command"

  if (key === "read") return "read"

  if (key === "edit" || key === "write") return "edit"

  if (key === "search") return "search"
  return "tool"
}

export function toolCallVerb(call: ToolCallView): string {
  const variant = toolCallVariant(call)

  if (variant === "tool") return call.toolName
  return t(VERB_KEYS[variant])
}

function firstLine(text: string): string {
  const at = text.indexOf("\n")
  return at === -1 ? text : text.slice(0, at)
}

export type ToolCallTarget = { text: string; path?: string }

export function toolCallTarget(call: ToolCallView): ToolCallTarget {
  const variant = toolCallVariant(call)

  if (variant === "command") return { text: firstLine(toolCommand(call.input)) }

  const path = toolPath(call.input)

  if (path && (variant === "read" || variant === "edit")) return { text: pathBasename(path), path }

  const detail = toolCallDetail(call.toolName, call.input) || (path ? pathBasename(path) : "")
  return { text: detail || call.toolName }
}

/** 摘要行的数据：类别片段、失败数、增删行数，都取自同一份 ToolRow。 */
export function toolRunSummary(row: ToolRow) {
  return {
    parts: toolRowLabelParts(row),
    failCount: toolRowFailCount(row),
    lineChange: toolRowLineChange(row),
  }
}

/** 运行中显示最后一个还在跑的工具；没有就退回整组摘要。 */
export function runningToolLabel(row: ToolRow): string | null {
  if (row.mode !== "live") return null

  const running = toolCalls(row)
    .filter((call) => call.running)
    .at(-1)

  if (!running) return null
  const target = toolCallTarget(running)
  return [toolCallVerb(running), target.text].filter(Boolean).join(" ")
}
