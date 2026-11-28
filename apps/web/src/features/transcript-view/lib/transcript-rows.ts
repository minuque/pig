import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import type { TurnTiming } from "@/types/common-type.js"
import type {
  AssistantRow,
  TimelineRow,
  ToolCallView,
  ToolRow,
  ToolRowStep,
} from "@features/transcript-view/type.js"
import {
  isAssistantItem,
  isToolItem,
  isUserItem,
  isVisibleTranscriptItem,
  transcriptImages,
} from "@features/transcript-view/lib/transcript-format.js"
import {
  transcriptText,
  userMessageParts,
  userMessageText,
} from "@features/session/lib/transcript-text.js"
import { toolGroupKey } from "@features/transcript-view/lib/tool-summary.js"
import {
  askRecords,
  turnAsksKey,
  type AskRecords,
} from "@features/transcript-view/lib/ask-record.js"
import {
  appendSystemRow,
  settleTurnOutcome,
} from "@features/transcript-view/lib/transcript-events.js"

export function isToolRow(row: TimelineRow): row is ToolRow {
  return row.role === "tools"
}

function toolStartedAt(item: ToolTranscriptItem | undefined): number | undefined {
  if (!item) return undefined
  const value = (item as ToolTranscriptItem & { startedAt?: unknown }).startedAt
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function assistantRow(item: AssistantTranscriptItem, text = transcriptText(item)): AssistantRow {
  return {
    id: item.id,
    entryId: item.id,
    role: "assistant",
    text,
    streaming: item.status === "streaming",
    error: item.status === "error",
    aborted: item.status === "aborted",
    timestamp: item.timestamp,
    ...("errorMessage" in item && item.errorMessage ? { errorMessage: item.errorMessage } : {}),
  }
}

function appendTurn({
  rows,
  user,
  rest,
  live,
  timings,
  asks,
}: {
  rows: TimelineRow[]
  user: UserTranscriptItem | undefined
  rest: TranscriptItem[]
  live: boolean
  timings: readonly TurnTiming[]
  asks: AskRecords
}) {
  const turnStart = rows.length

  if (user && !asks.folded.has(user.id)) {
    const parts = userMessageParts(user)
    rows.push({
      id: user.id,
      role: "user",
      text: userMessageText(user),
      ...(parts.some((part) => part.kind === "reference") ? { parts } : {}),
      images: transcriptImages(user),
      timestamp: user.timestamp,
    })
  }

  const anchor = `tools:${user?.id ?? rest[0]?.id ?? "orphan"}`
  const timing = timings.find((value) => value.userId === user?.id)
  let steps: ToolRowStep[] = []
  let segmentIndex = 0
  let segmentAborted = false
  let segmentError = false
  let segmentStartedAt: number | undefined
  let segmentEndedAt: number | undefined
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

  function noteRange(start: number, end?: number) {
    segmentStartedAt = Math.min(segmentStartedAt ?? start, start)

    if (end != null) segmentEndedAt = Math.max(segmentEndedAt ?? end, end)
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
      ...(segmentStartedAt == null ? {} : { startedAt: segmentStartedAt }),
      ...(segmentEndedAt == null ? {} : { endedAt: segmentEndedAt }),
      ...(timing ? { timing } : {}),
    })
    steps = []
    segmentIndex += 1
    segmentAborted = false
    segmentError = false
    segmentStartedAt = undefined
    segmentEndedAt = undefined
  }

  function appendAsk(toolCallId: string) {
    const lines = asks.lines.get(toolCallId)

    if (!lines) return false
    flushTools("done")
    rows.push({ id: `ask:${toolCallId}`, role: "ask", lines })
    return true
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

  const nextTimestamps = new Array<number | undefined>(rest.length).fill(undefined)
  const candidates: number[] = []

  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const timestamp = rest[index]?.timestamp

    if (timestamp == null) continue

    while (candidates.length > 0 && (candidates.at(-1) ?? 0) < timestamp) candidates.pop()
    nextTimestamps[index] = candidates.at(-1)
    candidates.push(timestamp)
  }

  for (const [itemIndex, item] of rest.entries()) {
    if (item.role === "system") {
      flushTools("done")
      appendSystemRow(rows, item)
      continue
    }

    if (item.role === "task") {
      flushTools("done")
      rows.push({ id: `task:${item.id}`, role: "task", task: item.task, timestamp: item.timestamp })
      continue
    }

    if (isToolItem(item)) {
      if (describedToolCalls.has(item.toolCallId) || live || appendAsk(item.toolCallId)) continue
      appendTool({
        id: item.toolCallId,
        toolName: item.toolName,
        running: false,
        isError: item.isError,
        input: item.input,
        outputText: transcriptText(item),
        outputImages: transcriptImages(item),
        ...(item.truncated ? { truncated: true } : {}),
        ...(item.details === undefined ? {} : { details: item.details }),
      })
      noteRange(item.timestamp, item.timestamp)
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
          rows.push(pendingText)
          pendingText = undefined
        }

        const streaming = live && item.status === "streaming" && index === item.content.length - 1
        const nextTimestamp = nextTimestamps[itemIndex]
        const endedAt = streaming ? undefined : (nextTimestamp ?? timing?.endedAt)
        const thoughtEndedAt = endedAt === undefined ? undefined : Math.max(item.timestamp, endedAt)
        steps.push({
          type: "thought",
          id: `thought:${id}`,
          text: block.thinking,
          streaming,
          startedAt: item.timestamp,
          ...(thoughtEndedAt === undefined ? {} : { endedAt: thoughtEndedAt }),
        })
        noteRange(item.timestamp, thoughtEndedAt)
      } else if (block.type === "toolCall") {
        if (pendingText) {
          flushTools("done")
          rows.push(pendingText)
          pendingText = undefined
        }

        if (renderedToolCalls.has(block.toolCallId)) continue
        renderedToolCalls.add(block.toolCallId)

        if (appendAsk(block.toolCallId)) continue
        const result = toolResults.get(block.toolCallId)
        const settled = result !== undefined && result.status !== "running"
        appendTool({
          id: block.toolCallId,
          toolName: block.toolName,
          running: live && (result?.status ?? "running") === "running",
          isError: result?.isError ?? false,
          input: block.input,
          outputText: result ? transcriptText(result) : "",
          outputImages: result ? transcriptImages(result) : [],
          ...(result?.truncated ? { truncated: true } : {}),
          ...(result?.details === undefined ? {} : { details: result.details }),
          startedAt: toolStartedAt(result) ?? item.timestamp,
          ...(settled ? { endedAt: result.timestamp } : {}),
        })
        noteRange(
          item.timestamp,
          result && result.status !== "running" ? result.timestamp : undefined,
        )
      } else if (block.type === "text" && block.text) {
        if (pendingText) pendingText.text += block.text
        else pendingText = { ...assistantRow(item, block.text), id: `text:${id}` }
      } else if (pendingText) {
        flushTools("done")
        rows.push(pendingText)
        pendingText = undefined
      }
    }

    if (pendingText) {
      flushTools("done")
      rows.push(pendingText)
    } else if (!transcriptText(item) && (item.status === "error" || item.status === "aborted")) {
      flushTools("done")
      rows.push(assistantRow(item))
    }
  }

  flushTools(live ? "live" : "done")
  rows.splice(
    turnStart,
    rows.length - turnStart,
    ...settleTurnOutcome(rows.slice(turnStart), {
      live,
      abortedTurn: !live && timing?.outcome === "aborted",
    }),
  )

  if (!live) markLastAssistantTimestamp(rows, turnStart)
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

interface TurnRowsEntry {
  user: UserTranscriptItem | undefined
  rest: readonly TranscriptItem[]
  live: boolean
  timing: TurnTiming | undefined
  asksKey: string
  rows: TimelineRow[]
}

const TURN_CACHE_LIMIT = 200

export function createTimelineRowsBuilder() {
  const cache = new Map<string, TurnRowsEntry>()

  function build(
    items: readonly TranscriptItem[],
    running: boolean,
    timings: readonly TurnTiming[] = [],
  ): TimelineRow[] {
    const rows: TimelineRow[] = []
    const asks = askRecords(items)
    const timingByUser = new Map(timings.map((timing) => [timing.userId, timing]))
    let user: UserTranscriptItem | undefined
    let rest: TranscriptItem[] = []
    const flush = (live: boolean) => {
      if (!user && rest.length === 0) return
      const timing = user ? timingByUser.get(user.id) : undefined
      const key = user ? `u:${user.id}` : `o:${rest[0]?.id ?? "none"}`
      const cached = cache.get(key)
      const asksKey = turnAsksKey(user, rest, asks)
      const reusable =
        cached !== undefined &&
        cached.live === live &&
        cached.timing === timing &&
        cached.asksKey === asksKey &&
        cached.user === user &&
        cached.rest.length === rest.length &&
        cached.rest.every((item, index) => item === rest[index])

      if (reusable && cached) {
        rows.push(...cached.rows)
      } else {
        const turnRows: TimelineRow[] = []
        appendTurn({ rows: turnRows, user, rest, live, timings, asks })
        cache.delete(key)
        cache.set(key, { user, rest, live, timing, asksKey, rows: turnRows })
        rows.push(...turnRows)
      }

      while (cache.size > TURN_CACHE_LIMIT) {
        const oldest = cache.keys().next().value

        if (oldest === undefined || oldest === key) break
        cache.delete(oldest)
      }
    }

    for (const item of items) {
      if (isUserItem(item) && isVisibleTranscriptItem(item)) {
        flush(false)
        user = item
        rest = []
      } else rest.push(item)
    }

    flush(running)
    return rows
  }

  return { build, reset: () => cache.clear() }
}
