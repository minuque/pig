import type {
  SessionPhase,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import {
  assistantThinking,
  isAssistantItem,
  isToolItem,
  isUserItem,
  isVisibleTranscriptItem,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"

export const THINKING_ROW_ID = "transcript-thinking"

export type WorkKind = "thought" | "read" | "command" | "tool"

export type ThinkingRow = { id: typeof THINKING_ROW_ID; role: "thinking" }
export type WorkRow = {
  id: string
  role: "work"
  mode: "live" | "fold"
  thinking: string[]
  thinkingStreaming: boolean
  tools: ToolTranscriptItem[]
  kinds: WorkKind[]
  aborted: boolean
}
export type TimelineRow = TranscriptItem | ThinkingRow | WorkRow

export function isThinkingRow(row: TimelineRow): row is ThinkingRow {
  return row.role === "thinking"
}

export function isWorkRow(row: TimelineRow): row is WorkRow {
  return row.role === "work"
}

type TurnSegment = {
  user: UserTranscriptItem | null
  rest: TranscriptItem[]
}

const KIND_LABEL: Record<WorkKind, { one: string; many: string }> = {
  thought: { one: "thought", many: "thoughts" },
  read: { one: "file read", many: "file reads" },
  command: { one: "command", many: "commands" },
  tool: { one: "tool call", many: "tool calls" },
}

/** 运行中且末条不是流式正文或进行中的工具时，补一条思考占位。 */
export function needsThinkingPlaceholder(
  phase: SessionPhase | undefined,
  items: readonly TranscriptItem[],
): boolean {
  if (phase === undefined || phase === "idle") return false
  const last = items[items.length - 1]
  if (!last) return true
  if (isAssistantItem(last) && last.status === "streaming" && transcriptText(last).length > 0) {
    return false
  }
  if (isToolItem(last) && last.status === "running") return false
  return true
}

function turnSegments(items: readonly TranscriptItem[]): TurnSegment[] {
  const segments: TurnSegment[] = []
  let user: UserTranscriptItem | null = null
  let rest: TranscriptItem[] = []
  const flush = () => {
    if (user || rest.length > 0) segments.push({ user, rest })
  }
  for (const item of items) {
    if (isUserItem(item) && isVisibleTranscriptItem(item)) {
      flush()
      user = item
      rest = []
      continue
    }
    rest.push(item)
  }
  flush()
  return segments
}

export function workKindOfTool(toolName: string): WorkKind {
  const name = toolName.trim().toLowerCase()
  if (name === "read") return "read"
  if (name === "bash") return "command"
  return "tool"
}

export function formatWorkKinds(kinds: readonly WorkKind[]): string {
  const counts = new Map<WorkKind, number>()
  for (const kind of kinds) {
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  const body = [...counts.entries()]
    .map(([kind, count]) => {
      const noun = count === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many
      return `${count} ${noun}`
    })
    .join(" · ")
  return body ? `Ran ${body}` : ""
}

export function workFoldLabel(row: WorkRow): string {
  if (row.aborted) return "已停止"
  return formatWorkKinds(row.kinds)
}

function emitClusters(
  rest: readonly TranscriptItem[],
  rows: TimelineRow[],
  mode: WorkRow["mode"],
  orphanThinking: boolean,
) {
  let thinking: string[] = []
  let thinkingStreaming = false
  let tools: ToolTranscriptItem[] = []
  let kinds: WorkKind[] = []
  let aborted = false
  let thinkAnchor: string | undefined

  const reset = () => {
    thinking = []
    thinkingStreaming = false
    tools = []
    kinds = []
    aborted = false
    thinkAnchor = undefined
  }

  const flush = (allowThinkingOnly: boolean) => {
    if (tools.length === 0 && thinking.length === 0) return
    if (tools.length === 0 && !allowThinkingOnly) return
    const id = tools[0] ? `work:${tools[0].id}` : `work:think:${thinkAnchor ?? "head"}`
    rows.push({
      id,
      role: "work",
      mode,
      thinking,
      thinkingStreaming,
      tools,
      kinds,
      aborted,
    })
    reset()
  }

  for (const item of rest) {
    if (isToolItem(item)) {
      tools.push(item)
      kinds.push(workKindOfTool(item.toolName))
      continue
    }
    if (!isAssistantItem(item)) continue
    if (item.status === "aborted") aborted = true
    const blocks = assistantThinking(item)
    if (blocks.length > 0) {
      thinking.push(...blocks)
      kinds.push("thought")
      thinkAnchor ??= item.id
      if (item.status === "streaming") thinkingStreaming = true
    }
    if (transcriptText(item).length > 0) {
      flush(mode === "fold")
      rows.push(item)
      continue
    }
    if (
      (item.status === "error" || item.status === "aborted") &&
      tools.length === 0 &&
      thinking.length === 0
    ) {
      rows.push(item)
    }
  }
  flush(mode === "fold" || orphanThinking)
}

/** 历史按正文切开工作组并折叠；进行中不折叠，连续工具占一行。 */
export function buildTimelineRows(
  items: readonly TranscriptItem[],
  phase: SessionPhase | undefined,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  const live = phase !== undefined && phase !== "idle"
  const segments = turnSegments(items)
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const folding = Boolean(segment.user) && !(live && index === segments.length - 1)
    if (segment.user) rows.push(segment.user)
    emitClusters(segment.rest, rows, folding ? "fold" : "live", !segment.user)
  }
  if (needsThinkingPlaceholder(phase, items)) {
    rows.push({ id: THINKING_ROW_ID, role: "thinking" })
  }
  return rows
}

export function toolCardOpen(
  item: ToolTranscriptItem,
  expanded: ReadonlyMap<string, boolean>,
): boolean {
  if (item.status === "running" || item.isError) return true
  return expanded.get(item.id) === true
}

/** 时间线认 Markdown 的 kind：仅助手正文。加载行和工作行不是 Markdown。 */
export function transcriptRowKind(item: TimelineRow): string {
  if (isThinkingRow(item)) return "thinking-wait"
  if (isWorkRow(item)) return item.mode === "fold" ? "work-fold" : "tool-group"
  if (item.role === "assistant") return "assistant-markdown"
  if (item.role === "tool") return "tool-call"
  return "user-message"
}

export function transcriptRowContent(item: TimelineRow): string {
  return !isThinkingRow(item) && !isWorkRow(item) && isAssistantItem(item)
    ? transcriptText(item)
    : ""
}

export function transcriptRowFinal(item: TimelineRow): boolean {
  return (
    isThinkingRow(item) ||
    isWorkRow(item) ||
    !(isAssistantItem(item) && item.status === "streaming")
  )
}

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1
  let lines = 0
  for (const part of text.split("\n")) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine))
  }
  return lines
}

/**
 * 虚拟列表估高：宁可偏高，避免宽度变窄后按 200px 塞进过多未测行。
 * 助手约 48 字/行、26px 行高；用户约 36 字/行、22px 行高。
 */
export function estimateTranscriptRowHeight(item: TimelineRow): number {
  if (isThinkingRow(item)) return 36
  if (isWorkRow(item)) {
    if (item.mode === "fold") return 36
    const thinking = item.thinking.length > 0 ? (item.thinkingStreaming ? 200 : 36) : 0
    return Math.max(48, 16 + thinking + item.tools.length * 48)
  }
  const text = transcriptText(item)
  if (item.role === "user") {
    return Math.min(280, 56 + estimateWrappedLines(text, 36) * 22)
  }
  if (item.role === "tool") return 48
  const height = 36 + estimateWrappedLines(text, 48) * 26
  return Math.min(960, Math.max(160, height))
}
