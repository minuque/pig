import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import type { TurnTiming } from "@/types/turn-type.js"
import type {
  AssistantRow,
  ThoughtStep,
  TimelineRow,
  ToolCallView,
  ToolGroupKey,
  ToolRow,
  ToolRowStep,
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

export function toolRowLabel(row: ToolRow, _now = Date.now()): string {
  const thoughtCount = row.steps.filter((step) => step.type === "thought").length
  const toolCounts = new Map<ToolGroupKey, number>()
  for (const step of row.steps) {
    if (step.type !== "tools") continue
    toolCounts.set(step.key, (toolCounts.get(step.key) ?? 0) + step.items.length)
  }
  const toolLabels = [...toolCounts].map(([key, count]) => {
    switch (key) {
      case "read":
        return `读${count}次文件`
      case "write":
        return `写${count}次文件`
      case "edit":
        return `编辑${count}次文件`
      case "command":
        return `运行${count}条命令`
      case "search":
        return `搜${count}次`
      case "tool":
        return `工具${count}次`
      default: {
        const _exhaustive: never = key
        return _exhaustive
      }
    }
  })
  const summary = [thoughtCount ? `思考 ${thoughtCount}轮` : "", toolLabels.join("、")]
    .filter(Boolean)
    .join(" · ")
  if (row.aborted) return summary ? `已停止 · ${summary}` : "已停止"
  return summary || (row.mode === "live" ? "执行中" : "执行过程")
}
