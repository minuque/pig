import { reactive } from "vue"
import type {
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
  TranscriptItem,
} from "@/types/common-type.js"
import { sessionTitle, UNTITLED_SESSION } from "@features/session-nav/index.js"
import { transcriptText } from "@features/transcript-view/lib/transcript-format.js"
import type {
  OptimisticUserMessage,
  SessionClientState,
  SessionProjection,
} from "@features/session-workbench/type.js"

/** 欢迎页第一条 Prompt 还没有真实 sessionId 时的占位。 */
export const PENDING_SESSION_ID = "pending"

/** pending 投影升级成真 Session，仍是同一条对话。 */
export function isSessionIdUpgrade(prev: string | undefined, next: string | undefined): boolean {
  return prev === PENDING_SESSION_ID && Boolean(next) && next !== PENDING_SESSION_ID
}

export function sessionState(states: Map<string, SessionClientState>, sessionId: string) {
  let state = states.get(sessionId)
  if (!state) {
    state = reactive({ draft: "", optimisticUser: null, userRowIds: {} })
    states.set(sessionId, state)
  }
  return state
}

export function optimisticUserMessage(
  sessionKey: string,
  text: string,
  knownItemIds: readonly string[] = [],
): OptimisticUserMessage {
  return {
    item: {
      id: `optimistic-${sessionKey}-${Date.now()}`,
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    },
    knownItemIds,
  }
}

/** 交给真实 Session；已有乐观句则不覆盖，避免两条叠在一起。 */
export function adoptWelcomeOptimistic(
  states: Map<string, SessionClientState>,
  sessionId: string,
  welcome: OptimisticUserMessage | null,
): void {
  if (!welcome) return
  const state = sessionState(states, sessionId)
  if (!state.optimisticUser) state.optimisticUser = welcome
}

function userText(item: TranscriptItem): string {
  return item.role === "user" ? transcriptText(item) : ""
}

function confirmedUserIndex(
  items: readonly TranscriptItem[],
  optimistic: OptimisticUserMessage,
): number {
  const known = new Set(optimistic.knownItemIds)
  let insertionIndex = 0
  for (let index = 0; index < items.length; index += 1) {
    if (known.has(items[index]!.id)) insertionIndex = index + 1
  }

  return items.findIndex(
    (item, index) =>
      index >= insertionIndex &&
      !known.has(item.id) &&
      userText(item) === userText(optimistic.item),
  )
}

/** 乐观用户句被服务端同文确认时，记下渲染 id。 */
export function confirmedUserRowAlias(
  items: readonly TranscriptItem[],
  optimistic: OptimisticUserMessage | null,
): { serverId: string; clientId: string } | undefined {
  if (!optimistic) return undefined
  const confirmedIndex = confirmedUserIndex(items, optimistic)
  if (confirmedIndex < 0) return undefined
  const serverId = items[confirmedIndex]!.id
  if (serverId === optimistic.item.id) return undefined
  return { serverId, clientId: optimistic.item.id }
}

/** 把已确认用户句的渲染 id 钉在发送时那条上。 */
export function applyUserRowAliases(
  items: readonly TranscriptItem[],
  aliases: Readonly<Record<string, string>> | undefined,
): readonly TranscriptItem[] {
  if (!aliases || Object.keys(aliases).length === 0) return items
  let changed = false
  const next = items.map((item) => {
    const id = aliases[item.id]
    if (!id || id === item.id) return item
    changed = true
    return { ...item, id }
  })
  return changed ? next : items
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

function sameTranscriptItem(a: TranscriptItem, b: TranscriptItem): boolean {
  if (a.id === b.id) return true
  if (a.role === "tool" && b.role === "tool") return a.toolCallId === b.toolCallId
  return a.role === b.role && JSON.stringify(a.content) === JSON.stringify(b.content)
}

/** 服务端确认前把乐观用户句插在提交时的 Transcript 尾部；确认后只返回服务端真相。 */
export function projectOptimisticTranscript(
  items: readonly TranscriptItem[],
  optimistic: OptimisticUserMessage | null,
): readonly TranscriptItem[] {
  if (!optimistic) return items
  if (confirmedUserIndex(items, optimistic) >= 0) return items
  const known = new Set(optimistic.knownItemIds)
  let insertionIndex = 0
  for (let index = 0; index < items.length; index += 1) {
    if (known.has(items[index]!.id)) insertionIndex = index + 1
  }

  return [...items.slice(0, insertionIndex), optimistic.item, ...items.slice(insertionIndex)]
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
