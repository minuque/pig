/** 时间线投影：磁盘底稿、live 覆盖、工具开始时刻、乐观用户句与 pending 占位一次算完，叠加规则只在本文件。 */
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  TurnTiming,
} from "@/types/common-type.js"
import type { OptimisticUserMessage } from "@features/session/type.js"
import { userMessageText } from "@features/session/lib/transcript-text.js"

/** 工具条目挂上客户端观测的开始时刻；只是本地附加字段，不进协议。 */
export type TimedToolItem = ToolTranscriptItem & { startedAt: number }

/** 还没有任何工具开始时刻。 */
export const NO_TOOL_STARTS: ReadonlyMap<string, number> = new Map()

export interface TimelineInput {
  /** 磁盘底稿：已加载窗口里网关给过的条目。 */
  persisted: readonly TranscriptItem[]
  /** 本次连接收到的 live 条目，按 id 存的最新版。 */
  liveOverlay: readonly TranscriptItem[]
  /** 发送时定死 id 的本地用户句，等服务端确认。 */
  optimisticSends: readonly OptimisticUserMessage[]
  /** 回合在跑：末尾留一行待写助手。 */
  turnPending: boolean
  /** toolCallId → 工具真正开始的时刻。 */
  toolStartedAt: ReadonlyMap<string, number>
}

/** 唯一入口：底稿 → live 对齐 → 工具开始时刻回填 → 乐观句对账 → pending 占位。 */
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

/** 记下工具条目的最早时间戳：完成条目到达时拿不到开始时刻，只能从 running 占位学。 */
export function recordToolStartedAt(times: Map<string, number>, item: TranscriptItem): void {
  if (item.role !== "tool") return
  const seen = times.get(item.id)

  if (seen === undefined || item.timestamp < seen) times.set(item.id, item.timestamp)
}

/** 磁盘历史为底，live 按 id 覆盖；当前回合的临时 id 对齐历史后缀，只追加还没落盘的尾巴。 */
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

/** 对账用展示文本：剥离网关追加的 @ 文件块，与服务端落盘条目一致比较。 */
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

/** 本地用户句 id 发送时定死；未确认则插入，确认后只换服务端条目的渲染 id。 */
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

/** 发送后、首条助手未到时占一行，避免时间线空一拍。 */
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

/** 已加载窗口只增不缩：最新页接到尾巴；空页不冲掉；hasMore 跟窗口第一条走。 */
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
