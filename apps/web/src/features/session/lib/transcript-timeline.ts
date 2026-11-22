import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  TurnTiming,
} from "@/types/common-type.js"
import type { OptimisticUserMessage } from "@features/session/type.js"
import { userMessageText } from "@features/session/lib/transcript-text.js"

export type TimedToolItem = ToolTranscriptItem & { startedAt: number }

export const NO_TOOL_STARTS: ReadonlyMap<string, number> = new Map()

export interface TimelineInput {
  persisted: readonly TranscriptItem[]
  liveOverlay: readonly TranscriptItem[]
  optimisticSends: readonly OptimisticUserMessage[]
  turnPending: boolean
  toolStartedAt: ReadonlyMap<string, number>
}

export function projectTranscriptTimeline(input: TimelineInput): readonly TranscriptItem[] {
  const aligned = withToolStarts(
    mergeLiveTranscript(input.persisted, input.liveOverlay),
    input.toolStartedAt,
  )
  return withPendingAssistant(
    projectClientTranscript(aligned, input.optimisticSends),
    input.turnPending,
  )
}

export function recordToolStartedAt(times: Map<string, number>, item: TranscriptItem): void {
  if (item.role !== "tool") return
  const seen = times.get(item.id)

  if (seen === undefined || item.timestamp < seen) times.set(item.id, item.timestamp)
}

function mergeLiveTranscript(
  persisted: readonly TranscriptItem[],
  live: readonly TranscriptItem[],
): TranscriptItem[] {
  if (live.length === 0) return [...persisted]

  if (persisted.length === 0) return [...live]

  const overlay = new Map(live.map((item) => [item.id, item]))
  const persistedIds = new Set(persisted.map((item) => item.id))
  const merged = persisted.map((item) => overlay.get(item.id) ?? item)
  const limit = Math.min(merged.length, live.length)
  let covered = 0

  for (let count = limit; count >= 1; count -= 1) {
    if (merged.slice(-count).every((item, index) => sameTranscriptItem(item, live[index]!))) {
      covered = count
      break
    }
  }

  return merged.concat(live.slice(covered).filter((item) => !persistedIds.has(item.id)))
}

function sameTranscriptItem(a: TranscriptItem, b: TranscriptItem): boolean {
  if (a.id === b.id) return true

  if (a.role === "tool" && b.role === "tool") return a.toolCallId === b.toolCallId

  if (a.role === "task" || b.role === "task")
    return a.role === "task" && b.role === "task" && a.task.id === b.task.id

  if (a.role === "system" || b.role === "system")
    return (
      a.role === "system" &&
      b.role === "system" &&
      JSON.stringify(a.event) === JSON.stringify(b.event)
    )
  return a.role === b.role && JSON.stringify(a.content) === JSON.stringify(b.content)
}

function withToolStarts(
  items: readonly TranscriptItem[],
  times: ReadonlyMap<string, number>,
): readonly TranscriptItem[] {
  if (times.size === 0) return items
  return items.map((item) => {
    if (item.role !== "tool") return item
    const startedAt = times.get(item.id)
    return startedAt === undefined ? item : ({ ...item, startedAt } as TimedToolItem)
  })
}

function userText(item: TranscriptItem): string {
  return item.role === "user" ? userMessageText(item) : ""
}

function sendAnchor(
  items: readonly TranscriptItem[],
  send: OptimisticUserMessage,
): { confirmedIndex: number; insertionIndex: number } {
  const known = new Set(send.knownItemIds)
  let insertionIndex = 0

  for (let index = 0; index < items.length; index += 1) {
    if (known.has(items[index]!.id)) insertionIndex = index + 1
  }

  const confirmedIndex = items.findIndex(
    (item, index) =>
      index >= insertionIndex && !known.has(item.id) && userText(item) === userText(send.item),
  )
  return { confirmedIndex, insertionIndex }
}

function projectClientTranscript(
  items: readonly TranscriptItem[],
  sends: readonly OptimisticUserMessage[],
): readonly TranscriptItem[] {
  if (sends.length === 0) return items

  const clientIdByServerId: Record<string, string> = {}
  const extras: { insertionIndex: number; item: TranscriptItem }[] = []

  for (const send of sends) {
    const { confirmedIndex, insertionIndex } = sendAnchor(items, send)

    if (confirmedIndex >= 0) {
      const serverId = items[confirmedIndex]!.id

      if (serverId !== send.item.id) clientIdByServerId[serverId] = send.item.id
      continue
    }

    extras.push({ insertionIndex, item: send.item })
  }

  const rewritten = Object.keys(clientIdByServerId).length
    ? items.map((item) => {
        const id = clientIdByServerId[item.id]
        return id && id !== item.id ? { ...item, id } : item
      })
    : items

  if (extras.length === 0) return rewritten

  let next = rewritten
  let inserted = 0

  for (const extra of extras) {
    const at = extra.insertionIndex + inserted
    next = [...next.slice(0, at), extra.item, ...next.slice(at)]
    inserted += 1
  }

  return next
}

const PENDING_ASSISTANT_ID = "pending-assistant"

function pendingAssistant(timestamp: number): AssistantTranscriptItem {
  return {
    id: PENDING_ASSISTANT_ID,
    role: "assistant",
    content: [],
    model: { provider: "pending", id: "pending" },
    timestamp,
    status: "streaming",
  }
}

function withPendingAssistant(
  items: readonly TranscriptItem[],
  pending: boolean,
): readonly TranscriptItem[] {
  if (!pending) return items
  const last = items.at(-1)

  if (last?.role !== "user") return items
  return [...items, pendingAssistant(last.timestamp)]
}

type HistorySlice = {
  items: readonly TranscriptItem[]
  timings: readonly TurnTiming[]
  hasMore: boolean
}

export function absorbTranscriptPage(loaded: HistorySlice | undefined, page: HistorySlice) {
  const base = loaded?.items.length ? loaded : { items: [], timings: [], hasMore: page.hasMore }
  return {
    items: mergeLiveTranscript(base.items, page.items),
    timings: [
      ...new Map([...base.timings, ...page.timings].map((item) => [item.userId, item])).values(),
    ],
    hasMore: base.hasMore,
  }
}
