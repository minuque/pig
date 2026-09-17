import { reactive } from "vue"
import type {
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
  TranscriptItem,
} from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { sessionTitle, UNTITLED_SESSION } from "@features/session-nav/index.js"
import { transcriptText } from "@features/transcript-view/index.js"
import type {
  OptimisticUserMessage,
  SessionClientState,
  SessionProjection,
} from "@features/session-workbench/type.js"

export function sessionState(states: Map<string, SessionClientState>, sessionId: string) {
  let state = states.get(sessionId)

  if (!state) {
    state = reactive<SessionClientState>({ draft: "", sends: [] })
    states.set(sessionId, state)
  }

  return state
}

export function optimisticUserMessage(
  text: string,
  knownItemIds: readonly string[] = [],
): OptimisticUserMessage {
  return {
    item: {
      id: `user-${Date.now()}`,
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    },
    knownItemIds,
  }
}

/** 欢迎页本地句交给真 Session；已有 sends 则不覆盖。 */
export function bindIdleSends(
  states: Map<string, SessionClientState>,
  sessionId: string,
  idle: SessionClientState,
): void {
  if (idle.sends.length === 0) return
  const state = sessionState(states, sessionId)

  if (state.sends.length === 0) {
    state.sends = idle.sends
    idle.sends = []
  }
}

function userText(item: TranscriptItem): string {
  return item.role === "user" ? transcriptText(item) : ""
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
export function projectClientTranscript(
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

/** 路由已有 session，但 lease 未齐或历史 HTTP 未落地。 */
export function isSessionOpening(
  sessionId: string | undefined,
  remoteId: string | undefined,
  historySessionId: string | undefined,
): boolean {
  if (!sessionId) return false
  return sessionId !== remoteId || historySessionId !== sessionId
}

/** 磁盘历史为底，live 按 id 覆盖；当前回合的临时 id 对齐历史后缀，只追加还没落盘的尾巴。 */
export function mergeLiveTranscript(
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

type HistorySlice = {
  items: readonly TranscriptItem[]
  timings: readonly TurnTiming[]
  hasMore: boolean
}

/** 已加载窗口只增不缩：最新页接到尾巴；空页不冲掉；hasMore 跟窗口第一条走。 */
export function absorbLatestTranscriptPage(loaded: HistorySlice | undefined, page: HistorySlice) {
  const base = loaded?.items.length ? loaded : { items: [], timings: [], hasMore: page.hasMore }
  return {
    items: mergeLiveTranscript(base.items, page.items),
    timings: [
      ...new Map([...base.timings, ...page.timings].map((item) => [item.userId, item])).values(),
    ],
    hasMore: base.hasMore,
  }
}

function sameTranscriptItem(a: TranscriptItem, b: TranscriptItem): boolean {
  if (a.id === b.id) return true

  if (a.role === "tool" && b.role === "tool") return a.toolCallId === b.toolCallId
  return a.role === b.role && JSON.stringify(a.content) === JSON.stringify(b.content)
}

export function projectSessionSnapshot(snapshot: SessionSnapshot): SessionProjection {
  return {
    id: snapshot.id,
    name: snapshot.name?.trim() || UNTITLED_SESSION,
    cwd: snapshot.cwd,
    model: snapshot.model,
    thinkingLevel: snapshot.thinkingLevel,
    phase: snapshot.phase,
    running: snapshot.phase !== "idle",
    updatedAt: snapshot.updatedAt,
  }
}

/** phase 文案：对齐官方 SessionPhase。 */
export function phaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case "turn":
      return "运行中"
    case "compaction":
      return "压缩中"
    case "retry":
      return "重试中"
    case "branch_summary":
      return "分支摘要"
    default:
      return "空闲"
  }
}

/** 顶栏标题：列表名优先（改名后随 listSessions 更新），否则 snapshot 名。 */
export function workbenchHeaderTitle(input: {
  sessionId: string | undefined
  listed: readonly Pick<SessionMetadata, "id" | "sessionName">[]
  projectionName: string | undefined
}): string {
  if (!input.sessionId) return ""
  const meta = input.listed.find((session) => session.id === input.sessionId)

  if (meta) return sessionTitle(meta)
  return input.projectionName?.trim() || UNTITLED_SESSION
}
