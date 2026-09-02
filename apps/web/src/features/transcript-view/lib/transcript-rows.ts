import type {
  AssistantTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import type { TurnTiming } from "@client/platform.js"
import {
  isAssistantItem,
  isToolItem,
  isUserItem,
  isVisibleTranscriptItem,
  transcriptImages,
  transcriptText,
} from "./transcript-format.js"
import { toolGroupKey } from "./tool-summary.js"

export type TranscriptImage = { data: string; mimeType: string }
export type UserRow = { id: string; role: "user"; text: string; images: TranscriptImage[] }
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
export type ToolGroup = { type: "tools"; id: string; key: string; items: ToolCallView[] }
export type ThoughtStep = {
  type: "thought"
  id: string
  text: string
  streaming: boolean
  startedAt: number
  endedAt?: number
}
export type ToolRowStep =
  ThoughtStep | { type: "assistant"; id: string; item: AssistantRow } | ToolGroup
export type ToolRow = {
  id: string
  role: "tools"
  mode: "live" | "fold"
  steps: ToolRowStep[]
  waiting: boolean
  aborted: boolean
  error: boolean
  timing?: TurnTiming
}
export type TimelineRow = UserRow | AssistantRow | ToolRow

export function isToolRow(row: TimelineRow): row is ToolRow {
  return row.role === "tools"
}

function assistantRow(item: AssistantTranscriptItem, text = transcriptText(item)): AssistantRow {
  return {
    id: item.id,
    role: "assistant",
    text,
    streaming: item.status === "streaming",
    error: item.status === "error",
    aborted: item.status === "aborted",
    ...("errorMessage" in item && item.errorMessage ? { errorMessage: item.errorMessage } : {}),
  }
}

function addAssistant(steps: ToolRowStep[], item: AssistantRow) {
  const last = steps.at(-1)
  if (
    !item.text &&
    item.error &&
    last?.type === "assistant" &&
    last.item.error &&
    !last.item.text
  ) {
    last.item = { ...item, retryCount: (last.item.retryCount ?? 1) + 1 }
    return
  }
  steps.push({ type: "assistant", id: item.id, item })
}

function orderedSteps(
  items: readonly TranscriptItem[],
  live: boolean,
  anchor: string,
  timing: TurnTiming | undefined,
) {
  const steps: ToolRowStep[] = []
  let lastTool = -1
  let aborted = false
  let error = false
  for (const [itemIndex, item] of items.entries()) {
    if (isToolItem(item)) {
      const tool: ToolCallView = {
        id: item.id,
        toolName: item.toolName,
        running: live && item.status === "running",
        isError: item.isError,
        input: item.input,
        outputText: transcriptText(item),
        outputImages: transcriptImages(item),
      }
      const key = toolGroupKey(tool.toolName)
      const last = steps.at(-1)
      if (
        !tool.isError &&
        last?.type === "tools" &&
        last.key === key &&
        !last.items.some((call) => call.isError)
      ) {
        last.items.push(tool)
      } else {
        steps.push({ type: "tools", id: `group:${item.id}`, key, items: [tool] })
      }
      lastTool = steps.length - 1
      error ||= item.isError
      continue
    }
    if (!isAssistantItem(item)) continue
    aborted ||= item.status === "aborted"
    error ||= item.status === "error"
    for (const [index, block] of item.content.entries()) {
      const id = `${anchor}:${item.timestamp}:${itemIndex}:${index}`
      if (block.type === "thinking" && block.thinking) {
        const streaming = live && item.status === "streaming" && index === item.content.length - 1
        const nextTimestamp = items
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
      } else if (block.type === "text" && block.text) {
        const previous = steps.at(-1)
        if (item.content[index - 1]?.type === "text" && previous?.type === "assistant") {
          previous.item.text += block.text
        } else addAssistant(steps, { ...assistantRow(item, block.text), id: `text:${id}` })
      } else if (block.type === "toolCall") {
        lastTool = steps.length - 1
      }
    }
    if (!transcriptText(item) && (item.status === "error" || item.status === "aborted")) {
      addAssistant(steps, assistantRow(item))
    }
  }
  return { steps, lastTool, aborted, error }
}

function appendTurn({
  rows,
  user,
  rest,
  live,
  timings,
  turnIndex,
}: {
  rows: TimelineRow[]
  user: UserTranscriptItem | undefined
  rest: TranscriptItem[]
  live: boolean
  timings: readonly TurnTiming[]
  turnIndex: number
}) {
  if (user)
    rows.push({
      id: user.id,
      role: "user",
      text: transcriptText(user),
      images: transcriptImages(user),
    })
  const anchor = `tools:${user?.timestamp ?? "orphan"}:${turnIndex}`
  const timing = timings.find((value) => value.userId === user?.id)
  const { steps, lastTool, aborted, error } = orderedSteps(rest, live, anchor, timing)
  const last = rest.at(-1)
  const waiting =
    live &&
    !(
      isAssistantItemSafe(last) &&
      last.status === "streaming" &&
      last.content.some((part) => part.type === "text" && part.text)
    ) &&
    !(last && isToolItem(last) && last.status === "running") &&
    !steps.some((step) => step.type === "thought" && step.streaming)
  const work: ToolRowStep[] = []
  const answers: AssistantRow[] = []
  const hasTools = rest.some(
    (item) =>
      isToolItem(item) ||
      (isAssistantItem(item) && item.content.some((block) => block.type === "toolCall")),
  )
  for (const [index, step] of steps.entries()) {
    if (step.type === "assistant" && (!hasTools || (!live && index > lastTool)))
      answers.push(step.item)
    else work.push(step)
  }
  if (work.length || waiting) {
    rows.push({
      id: anchor,
      role: "tools",
      mode: live ? "live" : "fold",
      steps: work,
      waiting,
      aborted: aborted || timing?.outcome === "aborted",
      error: error || timing?.outcome === "error",
      ...(timing ? { timing } : {}),
    })
  }
  rows.push(...answers)
}

export function thoughtStepLabel(step: ThoughtStep, completedAt = step.endedAt): string {
  if (step.streaming) return "思考中"
  const seconds = Math.max(1, Math.round(((completedAt ?? step.startedAt) - step.startedAt) / 1000))
  return `思考了 ${seconds}秒`
}

function isAssistantItemSafe(item: TranscriptItem | undefined): item is AssistantTranscriptItem {
  return item?.role === "assistant"
}

export function buildTimelineRows(
  items: readonly TranscriptItem[],
  running: boolean,
  timings: readonly TurnTiming[] = [],
): TimelineRow[] {
  const rows: TimelineRow[] = []
  let user: UserTranscriptItem | undefined
  let rest: TranscriptItem[] = []
  let turnIndex = 0
  for (const item of items) {
    if (isUserItem(item) && isVisibleTranscriptItem(item)) {
      if (user || rest.length) {
        appendTurn({ rows, user, rest, live: false, timings, turnIndex })
        turnIndex += 1
      }
      user = item
      rest = []
    } else rest.push(item)
  }
  if (user || rest.length || running)
    appendTurn({ rows, user, rest, live: running, timings, turnIndex })
  return rows
}

export function toolRowLabel(row: ToolRow, now = Date.now()): string {
  const status = row.aborted ? "已停止" : row.mode === "live" ? "执行中" : "执行过程"
  if (!row.timing || (row.timing.endedAt === undefined && row.mode !== "live")) return status
  const seconds = Math.max(
    0,
    Math.floor(((row.timing.endedAt ?? now) - row.timing.startedAt) / 1000),
  )
  const duration =
    seconds >= 60 ? `${Math.floor(seconds / 60)}分钟 ${seconds % 60}秒` : `${seconds}秒`
  return row.aborted || row.mode === "live" ? `${status} · 用时 ${duration}` : `用时 ${duration}`
}
