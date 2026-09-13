import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import type {
  AssistantRow,
  ThoughtStep,
  TimelineRow,
  ToolCallView,
  ToolGroupKey,
  ToolRow,
  ToolRowStep,
  TranscriptImage,
  UserRow,
} from "@features/transcript-view/type.js"
import {
  isAssistantItem,
  isToolItem,
  isUserItem,
  isVisibleTranscriptItem,
  transcriptImages,
  transcriptText,
} from "./transcript-format.js"
import { toolGroupKey } from "./tool-summary.js"

export function isToolRow(row: TimelineRow): row is ToolRow {
  return row.role === "tools"
}

/** DOM key 跟行 id，prepend 时已有行不能换 key。 */
export function timelineRowKeys(rows: readonly TimelineRow[]): string[] {
  return rows.map((row) => row.id)
}

function assistantRow(item: AssistantTranscriptItem, text = transcriptText(item)): AssistantRow {
  return {
    id: item.id,
    role: "assistant",
    text,
    streaming: item.status === "streaming",
    error: item.status === "error",
    aborted: item.status === "aborted",
    timestamp: item.timestamp,
    ...("errorMessage" in item && item.errorMessage ? { errorMessage: item.errorMessage } : {}),
  }
}

function addAssistant(rows: TimelineRow[], item: AssistantRow) {
  const last = rows.at(-1)
  if (!item.text && item.error && last?.role === "assistant" && last.error && !last.text) {
    Object.assign(last, { ...item, retryCount: (last.retryCount ?? 1) + 1 })
    return
  }
  rows.push(item)
}

function appendTurn({
  rows,
  user,
  rest,
  live,
  timings,
}: {
  rows: TimelineRow[]
  user: UserTranscriptItem | undefined
  rest: TranscriptItem[]
  live: boolean
  timings: readonly TurnTiming[]
}) {
  const turnStart = rows.length
  if (user)
    rows.push({
      id: user.id,
      role: "user",
      text: transcriptText(user),
      images: transcriptImages(user),
      timestamp: user.timestamp,
    })

  const anchor = `tools:${user?.id ?? rest[0]?.id ?? "orphan"}`
  const timing = timings.find((value) => value.userId === user?.id)
  let steps: ToolRowStep[] = []
  let segmentIndex = 0
  let segmentAborted = false
  let segmentError = false

  const toolResults = new Map<string, ToolTranscriptItem>()
  const describedToolCalls = new Set<string>()
  const renderedToolCalls = new Set<string>()

  for (const item of rest) {
    if (isToolItem(item)) toolResults.set(item.toolCallId, item)
    if (!isAssistantItem(item)) continue
    for (const block of item.content) {
      if (block.type === "toolCall") describedToolCalls.add(block.toolCallId)
    }
  }

  function flushTools(mode: ToolRow["mode"]) {
    if (!steps.length) return
    rows.push({
      id: `${anchor}:${segmentIndex}`,
      role: "tools",
      mode,
      turnStreaming: live,
      steps,
      aborted: segmentAborted || (mode === "live" && timing?.outcome === "aborted"),
      error: segmentError || (mode === "live" && timing?.outcome === "error"),
      ...(timing ? { timing } : {}),
    })
    steps = []
    segmentIndex += 1
    segmentAborted = false
    segmentError = false
  }

  function appendTool(tool: ToolCallView) {
    steps.push({
      type: "tools",
      id: `group:${tool.id}`,
      key: toolGroupKey(tool.toolName),
      items: [tool],
    })
    segmentError ||= tool.isError
  }

  for (const [itemIndex, item] of rest.entries()) {
    if (isToolItem(item)) {
      if (describedToolCalls.has(item.toolCallId) || live) continue
      appendTool({
        id: item.toolCallId,
        toolName: item.toolName,
        running: false,
        isError: item.isError,
        input: item.input,
        outputText: transcriptText(item),
        outputImages: transcriptImages(item),
      })
      continue
    }
    if (!isAssistantItem(item)) continue
    segmentAborted ||= item.status === "aborted"
    segmentError ||= item.status === "error"
    let pendingText: AssistantRow | undefined
    for (const [index, block] of item.content.entries()) {
      const id = `${anchor}:${item.timestamp}:${itemIndex}:${index}`
      if (block.type === "thinking" && block.thinking) {
        if (pendingText) {
          flushTools("done")
          addAssistant(rows, pendingText)
          pendingText = undefined
        }
        const streaming = live && item.status === "streaming" && index === item.content.length - 1
        const nextTimestamp = rest
          .slice(itemIndex + 1)
          .find((next) => next.timestamp >= item.timestamp)?.timestamp
        const endedAt = streaming ? undefined : (nextTimestamp ?? timing?.endedAt)
        steps.push({
          type: "thought",
          id: `thought:${id}`,
          text: block.thinking,
          streaming,
          startedAt: item.timestamp,
          ...(endedAt === undefined ? {} : { endedAt: Math.max(item.timestamp, endedAt) }),
        })
      } else if (block.type === "toolCall") {
        if (pendingText) {
          flushTools("done")
          addAssistant(rows, pendingText)
          pendingText = undefined
        }
        if (renderedToolCalls.has(block.toolCallId)) continue
        renderedToolCalls.add(block.toolCallId)
        const result = toolResults.get(block.toolCallId)
        appendTool({
          id: block.toolCallId,
          toolName: block.toolName,
          running: live && (result?.status ?? "running") === "running",
          isError: result?.isError ?? false,
          input: block.input,
          outputText: result ? transcriptText(result) : "",
          outputImages: result ? transcriptImages(result) : [],
        })
      } else if (block.type === "text" && block.text) {
        if (pendingText) pendingText.text += block.text
        else pendingText = { ...assistantRow(item, block.text), id: `text:${id}` }
      } else if (pendingText) {
        flushTools("done")
        addAssistant(rows, pendingText)
        pendingText = undefined
      }
    }
    if (pendingText) {
      flushTools("done")
      addAssistant(rows, pendingText)
    } else if (!transcriptText(item) && (item.status === "error" || item.status === "aborted")) {
      flushTools("done")
      addAssistant(rows, assistantRow(item))
    }
  }

  flushTools(live ? "live" : "done")
  markLastAssistantTimestamp(rows, turnStart)
}

function markLastAssistantTimestamp(rows: TimelineRow[], start: number) {
  for (let i = rows.length - 1; i >= start; i -= 1) {
    const row = rows[i]
    if (row?.role === "assistant") {
      row.showTimestamp = true
      return
    }
  }
}

export function thoughtStepLabel(step: ThoughtStep, completedAt = step.endedAt): string {
  if (step.streaming) return "思考中"

  const seconds = Math.max(1, Math.round(((completedAt ?? step.startedAt) - step.startedAt) / 1000))
  return `思考了 ${seconds}秒`
}

export function buildTimelineRows(
  items: readonly TranscriptItem[],
  running: boolean,
  timings: readonly TurnTiming[] = [],
): TimelineRow[] {
  const rows: TimelineRow[] = []
  let user: UserTranscriptItem | undefined
  let rest: TranscriptItem[] = []
  for (const item of items) {
    if (isUserItem(item) && isVisibleTranscriptItem(item)) {
      if (user || rest.length) appendTurn({ rows, user, rest, live: false, timings })
      user = item
      rest = []
    } else rest.push(item)
  }

  if (user || rest.length || running) appendTurn({ rows, user, rest, live: running, timings })

  return rows
}

function sameImages(left: readonly TranscriptImage[], right: readonly TranscriptImage[]) {
  if (left === right) return true
  if (left.length !== right.length) return false
  return left.every((image, index) => {
    const other = right[index]
    return other != null && image.data === other.data && image.mimeType === other.mimeType
  })
}

function sameTiming(left: TurnTiming | undefined, right: TurnTiming | undefined) {
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.userId === right.userId &&
    left.startedAt === right.startedAt &&
    left.outcome === right.outcome &&
    (left.outcome === "running" || left.endedAt === right.endedAt)
  )
}

function sameUserRow(left: UserRow, right: UserRow) {
  return (
    left.id === right.id &&
    left.text === right.text &&
    left.timestamp === right.timestamp &&
    sameImages(left.images, right.images)
  )
}

function sameAssistantRow(left: AssistantRow, right: AssistantRow) {
  return (
    left.id === right.id &&
    left.text === right.text &&
    left.streaming === right.streaming &&
    left.error === right.error &&
    left.aborted === right.aborted &&
    left.timestamp === right.timestamp &&
    left.showTimestamp === right.showTimestamp &&
    left.errorMessage === right.errorMessage &&
    left.retryCount === right.retryCount
  )
}

function sameToolRow(left: ToolRow, right: ToolRow) {
  if (
    left.id !== right.id ||
    left.mode !== right.mode ||
    left.turnStreaming !== right.turnStreaming ||
    left.aborted !== right.aborted ||
    left.error !== right.error ||
    !sameTiming(left.timing, right.timing) ||
    left.steps.length !== right.steps.length
  ) {
    return false
  }
  return left.steps.every((step, index) => {
    const other = right.steps[index]
    if (!other || step.id !== other.id || step.type !== other.type) return false
    if (step.type === "thought" && other.type === "thought") {
      return (
        step.text === other.text &&
        step.streaming === other.streaming &&
        step.startedAt === other.startedAt &&
        step.endedAt === other.endedAt
      )
    }
    if (step.type !== "tools" || other.type !== "tools") return false
    if (step.key !== other.key || step.items.length !== other.items.length) return false
    return step.items.every((item, itemIndex) => {
      const nextItem = other.items[itemIndex]
      return (
        nextItem != null &&
        item.id === nextItem.id &&
        item.running === nextItem.running &&
        item.isError === nextItem.isError &&
        item.outputText === nextItem.outputText
      )
    })
  })
}

function sameRow(left: TimelineRow, right: TimelineRow) {
  if (left.role !== right.role) return false
  if (left.role === "user" && right.role === "user") return sameUserRow(left, right)
  if (left.role === "assistant" && right.role === "assistant") return sameAssistantRow(left, right)
  if (left.role === "tools" && right.role === "tools") return sameToolRow(left, right)
  return false
}

/** 正文增量只换变化的行，未变化行保持同一对象。 */
export function reuseTimelineRows(
  previous: readonly TimelineRow[],
  next: readonly TimelineRow[],
): TimelineRow[] {
  if (previous.length === 0) return next as TimelineRow[]
  const prevById = new Map(previous.map((row) => [row.id, row]))
  let changed = previous.length !== next.length
  const rows = next.map((row, index) => {
    const prev = prevById.get(row.id)
    const reused = prev && sameRow(prev, row) ? prev : row
    if (reused !== previous[index]) changed = true
    return reused
  })
  return changed ? rows : (previous as TimelineRow[])
}

const TOOL_ROW_ORDER = ["read", "write", "edit", "command", "search", "tool"] as const
const TOOL_ROW_LABEL = {
  read: (n) => `读${n}次文件`,
  write: (n) => `写${n}次文件`,
  edit: (n) => `编辑${n}次文件`,
  command: (n) => `运行${n}条命令`,
  search: (n) => `搜${n}次`,
  tool: (n) => `调用工具${n}次`,
} as const satisfies Record<ToolGroupKey, (count: number) => string>

export function toolRowLabel(row: ToolRow): string {
  const counts = new Map<ToolGroupKey, number>()
  let thoughts = 0
  for (const step of row.steps) {
    if (step.type === "thought") thoughts += 1
    else counts.set(step.key, (counts.get(step.key) ?? 0) + step.items.length)
  }

  const summary = [
    thoughts ? `思考 ${thoughts}轮` : "",
    ...TOOL_ROW_ORDER.map((key) => {
      const count = counts.get(key)
      return count ? TOOL_ROW_LABEL[key](count) : ""
    }),
  ]
    .filter(Boolean)
    .join(" · ")

  if (row.aborted) return summary ? `已停止 · ${summary}` : "已停止"
  return summary || (row.mode === "live" ? "执行中" : "执行过程")
}
