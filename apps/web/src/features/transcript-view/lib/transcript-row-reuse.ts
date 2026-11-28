import type { TurnTiming } from "@/types/common-type.js"
import type {
  AssistantRow,
  TimelineRow,
  ToolRow,
  TranscriptImage,
  UserRow,
} from "@features/transcript-view/type.js"
import { sameContextSegments } from "@features/session/lib/transcript-text.js"

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
    sameContextSegments(left.parts, right.parts) &&
    sameImages(left.images, right.images)
  )
}

function sameAssistantRow(left: AssistantRow, right: AssistantRow) {
  return (
    left.id === right.id &&
    left.entryId === right.entryId &&
    left.text === right.text &&
    left.streaming === right.streaming &&
    left.error === right.error &&
    left.aborted === right.aborted &&
    left.timestamp === right.timestamp &&
    left.showTimestamp === right.showTimestamp &&
    left.errorMessage === right.errorMessage
  )
}

function sameToolRow(left: ToolRow, right: ToolRow) {
  if (
    left.id !== right.id ||
    left.mode !== right.mode ||
    left.turnStreaming !== right.turnStreaming ||
    left.aborted !== right.aborted ||
    left.error !== right.error ||
    left.startedAt !== right.startedAt ||
    left.endedAt !== right.endedAt ||
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
        item.toolName === nextItem.toolName &&
        item.running === nextItem.running &&
        item.isError === nextItem.isError &&
        item.input === nextItem.input &&
        item.outputText === nextItem.outputText &&
        item.details === nextItem.details &&
        sameImages(item.outputImages, nextItem.outputImages)
      )
    })
  })
}

function sameRow(left: TimelineRow, right: TimelineRow) {
  if (left === right) return true

  if (left.role !== right.role) return false

  if (left.role === "user" && right.role === "user") return sameUserRow(left, right)

  if (left.role === "assistant" && right.role === "assistant") return sameAssistantRow(left, right)

  if (left.role === "tools" && right.role === "tools") return sameToolRow(left, right)

  if (
    left.role === "event" ||
    left.role === "alert" ||
    left.role === "extension" ||
    left.role === "ask"
  )
    return JSON.stringify(left) === JSON.stringify(right)
  return false
}

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
