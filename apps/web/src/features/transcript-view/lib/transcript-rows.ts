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
  errorMessage?: string
  retryCount?: number
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

export type ToolKind = "thought" | "read" | "command" | "tool"

export type ToolRow = {
  id: string
  role: "tools"
  mode: "live" | "fold"
  thinking: string[]
  thinkingStreaming: boolean
  tools: ToolCallView[]
  kinds: ToolKind[]
  aborted: boolean
}

export type ToolRowStep =
  | { type: "thought"; id: string; text: string; streaming: boolean }
  | { type: "tool"; item: ToolCallView }

export type TimelineRow = UserRow | AssistantRow | ToolRow

export function isToolRow(row: TimelineRow): row is ToolRow {
  return row.role === "tools"
}

function emptyToolRow(id: string): ToolRow {
  return {
    id,
    role: "tools",
    mode: "live",
    thinking: [],
    thinkingStreaming: false,
    tools: [],
    kinds: [],
    aborted: false,
  }
}

type TurnSegment = {
  user: UserTranscriptItem | null
  rest: TranscriptItem[]
}

const KIND_LABEL: Record<ToolKind, { one: string; many: string }> = {
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

function assistantErrorMessage(item: AssistantTranscriptItem): string | undefined {
  if (!("errorMessage" in item)) return undefined
  const value = item.errorMessage
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function toAssistantRow(item: AssistantTranscriptItem, retryCount = 1): AssistantRow {
  const errorMessage = assistantErrorMessage(item)
  return {
    id: item.id,
    role: "assistant",
    text: transcriptText(item),
    streaming: item.status === "streaming",
    error: item.status === "error",
    aborted: item.status === "aborted",
    ...(errorMessage ? { errorMessage } : {}),
    ...(retryCount > 1 ? { retryCount } : {}),
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
function needsThinkingPlaceholder(running: boolean, items: readonly TranscriptItem[]): boolean {
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

export function toolKindOfTool(toolName: string): ToolKind {
  const name = toolName.trim().toLowerCase()
  if (name === "read") return "read"
  if (name === "bash") return "command"
  return "tool"
}

function formatToolKinds(kinds: readonly ToolKind[]): string {
  const counts = new Map<ToolKind, number>()
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

export function toolRowLabel(row: ToolRow): string {
  if (row.aborted) return "已停止"
  return formatToolKinds(row.kinds)
}

function emitClusters(
  rest: readonly TranscriptItem[],
  rows: TimelineRow[],
  mode: ToolRow["mode"],
  anchor: string,
) {
  let thinking: string[] = []
  let thinkingStreaming = false
  let tools: ToolCallView[] = []
  let kinds: ToolKind[] = []
  let aborted = false
  let cluster = 0
  let errorRun: AssistantTranscriptItem[] = []

  const reset = () => {
    thinking = []
    thinkingStreaming = false
    tools = []
    kinds = []
    aborted = false
  }

  const flushErrors = () => {
    const last = errorRun[errorRun.length - 1]
    if (!last) return
    rows.push(toAssistantRow(last, errorRun.length))
    errorRun = []
  }

  const flush = () => {
    flushErrors()
    if (tools.length === 0 && thinking.length === 0) return
    rows.push({
      id: `tools:${anchor}:${cluster}`,
      role: "tools",
      mode,
      thinking,
      thinkingStreaming,
      tools,
      kinds,
      aborted,
    })
    cluster += 1
    reset()
  }

  for (const item of rest) {
    if (isToolItem(item)) {
      flushErrors()
      tools.push(toToolCallView(item))
      kinds.push(toolKindOfTool(item.toolName))
      continue
    }
    if (!isAssistantItem(item)) continue
    if (item.status === "aborted") aborted = true
    const blocks = assistantThinking(item)
    if (blocks.length > 0) {
      flushErrors()
      thinking.push(blocks.join("\n\n"))
      kinds.push("thought")
      if (item.status === "streaming") thinkingStreaming = true
    }
    if (transcriptText(item).length > 0) {
      flush()
      rows.push(toAssistantRow(item))
      continue
    }
    if (
      (item.status === "error" || item.status === "aborted") &&
      tools.length === 0 &&
      thinking.length === 0
    ) {
      errorRun.push(item)
    }
  }
  flush()
}

/** 进行中只留最后一个工作槽展开，上面已完成的收成折叠条。 */
function foldPriorLiveToolRows(rows: TimelineRow[]) {
  const last = rows[rows.length - 1]
  const keepLive = last !== undefined && isToolRow(last)
  let lastTool = -1
  if (keepLive) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (isToolRow(rows[index]!)) {
        lastTool = index
        break
      }
    }
  }
  for (const [index, row] of rows.entries()) {
    if (!isToolRow(row) || row.mode !== "live") continue
    if (keepLive && index === lastTool) continue
    row.mode = "fold"
  }
}

/** 历史按正文切开工具行并折叠；进行中只展开末个工作槽。 */
export function buildTimelineRows(
  items: readonly TranscriptItem[],
  running: boolean,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  const segments = turnSegments(items)
  const wait = needsThinkingPlaceholder(running, items)
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const live = running && index === segments.length - 1
    const folding = Boolean(segment.user) && !live
    if (segment.user) rows.push(toUserRow(segment.user))
    emitClusters(segment.rest, rows, folding ? "fold" : "live", segment.user?.id ?? "orphan")
  }
  if (wait) {
    const last = rows[rows.length - 1]
    if (!last || !isToolRow(last) || last.mode !== "live") {
      const anchor = segments[segments.length - 1]?.user?.id ?? "orphan"
      const prefix = `tools:${anchor}:`
      let cluster = 0
      for (const row of rows) {
        if (isToolRow(row) && row.id.startsWith(prefix)) cluster += 1
      }
      rows.push(emptyToolRow(`${prefix}${cluster}`))
    }
  }
  if (running) foldPriorLiveToolRows(rows)
  return rows
}

export function toolRowSteps(row: ToolRow): ToolRowStep[] {
  const steps: ToolRowStep[] = []
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
  return expanded.get(item.id) === true
}

export function thinkCardOpen(id: string, expanded: ReadonlyMap<string, boolean>): boolean {
  return expanded.get(id) === true
}
