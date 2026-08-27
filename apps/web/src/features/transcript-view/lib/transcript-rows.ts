import type {
  AssistantTranscriptItem,
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
  transcriptImages,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"

export const THINKING_ROW_ID = "transcript-thinking"

export type TranscriptImage = { data: string; mimeType: string }

export type UserRow = {
  id: string
  role: "user"
  text: string
  images: TranscriptImage[]
}

export type AssistantRow = {
  id: string
  role: "assistant"
  text: string
  streaming: boolean
  error: boolean
  aborted: boolean
}

export type ToolCallView = {
  id: string
  toolName: string
  running: boolean
  isError: boolean
  input: unknown
  outputText: string
  outputImages: TranscriptImage[]
}

export type WorkKind = "thought" | "read" | "command" | "tool"

export type ThinkingRow = { id: typeof THINKING_ROW_ID; role: "thinking" }

export type WorkRow = {
  id: string
  role: "work"
  mode: "live" | "fold"
  thinking: string[]
  thinkingStreaming: boolean
  tools: ToolCallView[]
  kinds: WorkKind[]
  aborted: boolean
}

export type WorkStep =
  | { type: "thought"; id: string; text: string; streaming: boolean }
  | { type: "tool"; item: ToolCallView }

export type TimelineRow = UserRow | AssistantRow | ThinkingRow | WorkRow

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

function toUserRow(item: UserTranscriptItem): UserRow {
  return {
    id: item.id,
    role: "user",
    text: transcriptText(item),
    images: transcriptImages(item),
  }
}

function toAssistantRow(item: AssistantTranscriptItem): AssistantRow {
  return {
    id: item.id,
    role: "assistant",
    text: transcriptText(item),
    streaming: item.status === "streaming",
    error: item.status === "error",
    aborted: item.status === "aborted",
  }
}

function toToolCallView(item: ToolTranscriptItem): ToolCallView {
  return {
    id: item.id,
    toolName: item.toolName,
    running: item.status === "running",
    isError: item.isError,
    input: item.input,
    outputText: transcriptText(item),
    outputImages: transcriptImages(item),
  }
}

/** 运行中且末条不是流式正文或进行中的工具时，补一条思考占位。 */
export function needsThinkingPlaceholder(
  running: boolean,
  items: readonly TranscriptItem[],
): boolean {
  if (running === false) return false
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
  let tools: ToolCallView[] = []
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
      tools.push(toToolCallView(item))
      kinds.push(workKindOfTool(item.toolName))
      continue
    }
    if (!isAssistantItem(item)) continue
    if (item.status === "aborted") aborted = true
    const blocks = assistantThinking(item)
    if (blocks.length > 0) {
      thinking.push(blocks.join("\n\n"))
      kinds.push("thought")
      thinkAnchor ??= item.id
      if (item.status === "streaming") thinkingStreaming = true
    }
    if (transcriptText(item).length > 0) {
      flush(mode === "fold")
      rows.push(toAssistantRow(item))
      continue
    }
    if (
      (item.status === "error" || item.status === "aborted") &&
      tools.length === 0 &&
      thinking.length === 0
    ) {
      rows.push(toAssistantRow(item))
    }
  }
  flush(mode === "fold" || orphanThinking)
}

/** 历史按正文切开工作组并折叠；进行中不折叠，连续工具占一行。 */
export function buildTimelineRows(
  items: readonly TranscriptItem[],
  running: boolean,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  const segments = turnSegments(items)
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const folding = Boolean(segment.user) && !(running && index === segments.length - 1)
    if (segment.user) rows.push(toUserRow(segment.user))
    emitClusters(segment.rest, rows, folding ? "fold" : "live", !segment.user)
  }
  if (needsThinkingPlaceholder(running, items)) {
    rows.push({ id: THINKING_ROW_ID, role: "thinking" })
  }
  return rows
}

export function workSteps(row: WorkRow): WorkStep[] {
  const steps: WorkStep[] = []
  let thinkAt = 0
  let toolAt = 0
  for (const [index, kind] of row.kinds.entries()) {
    if (kind === "thought") {
      const last = thinkAt + 1 === row.thinking.length
      steps.push({
        type: "thought",
        id: `${row.id}:think:${index}`,
        text: row.thinking[thinkAt] ?? "",
        streaming: row.thinkingStreaming && last,
      })
      thinkAt += 1
      continue
    }
    const item = row.tools[toolAt]
    toolAt += 1
    if (item) steps.push({ type: "tool", item })
  }
  return steps
}

export function toolCardOpen(item: ToolCallView, expanded: ReadonlyMap<string, boolean>): boolean {
  if (item.running || item.isError) return true
  return expanded.get(item.id) === true
}

export function thinkCardOpen(
  id: string,
  streaming: boolean,
  expanded: ReadonlyMap<string, boolean>,
): boolean {
  if (streaming) return true
  return expanded.get(id) === true
}

/** 时间线认 Markdown 的 kind：仅助手正文。加载行和工作行不是 Markdown。 */
export function transcriptRowKind(item: TimelineRow): string {
  if (isThinkingRow(item)) return "thinking-wait"
  if (isWorkRow(item)) return item.mode === "fold" ? "work-fold" : "tool-group"
  if (item.role === "assistant") return "assistant-markdown"
  return "user-message"
}

export function transcriptRowContent(item: TimelineRow): string {
  return item.role === "assistant" ? item.text : ""
}

export function transcriptRowFinal(item: TimelineRow): boolean {
  return item.role !== "assistant" || !item.streaming
}

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1
  let lines = 0
  for (const part of text.split("\n")) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine))
  }
  return lines
}

/** 虚拟列表估高宁可偏高：助手约 48 字/行 26px，用户约 36 字/行 22px。 */
export function estimateTranscriptRowHeight(item: TimelineRow): number {
  if (isThinkingRow(item)) return 36
  if (isWorkRow(item)) {
    if (item.mode === "fold") return 36
    const thinking = item.thinking.length > 0 ? (item.thinkingStreaming ? 200 : 36) : 0
    return Math.max(48, 16 + thinking + item.tools.length * 48)
  }
  const text = item.text
  if (item.role === "user") {
    return Math.min(280, 56 + estimateWrappedLines(text, 36) * 22)
  }
  const height = 36 + estimateWrappedLines(text, 48) * 26
  return Math.min(960, Math.max(160, height))
}
