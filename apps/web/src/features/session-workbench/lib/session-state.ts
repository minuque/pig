import { reactive } from "vue"
import type {
  ModelRef,
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import type { MarkstreamThreadVirtualState } from "markstream-vue"
import { sessionTitle, UNTITLED_SESSION } from "@features/session-nav/index.js"

export interface OptimisticUserMessage {
  item: UserTranscriptItem
  knownItemIds: readonly string[]
}

/** 每 Session 的 UI 私有状态（草稿、乐观用户句、滚动位置恢复），不进入任何 Agent Domain。 */
export interface SessionClientState {
  draft: string
  optimisticUser: OptimisticUserMessage | null
  /** 上次离开会话时的虚拟滚动状态（滚动锚点 + 行高缓存），切回时恢复 */
  threadState: MarkstreamThreadVirtualState | null
}

export function sessionState(states: Map<string, SessionClientState>, sessionId: string) {
  let state = states.get(sessionId)
  if (!state) {
    // reactive：UI 私有状态写入必须被响应式追踪（如 draft 清空后 PromptEditor 同步）
    state = reactive({ draft: "", optimisticUser: null, threadState: null })
    states.set(sessionId, state)
  }
  return state
}

function userText(item: TranscriptItem): string {
  if (item.role !== "user") return ""
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
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
  const known = new Set(optimistic.knownItemIds)
  let insertionIndex = 0
  for (let index = 0; index < items.length; index += 1) {
    if (known.has(items[index]!.id)) insertionIndex = index + 1
  }

  const confirmedIndex = items.findIndex(
    (item, index) =>
      index >= insertionIndex &&
      !known.has(item.id) &&
      userText(item) === userText(optimistic.item),
  )
  if (confirmedIndex >= 0) return items

  return [...items.slice(0, insertionIndex), optimistic.item, ...items.slice(insertionIndex)]
}

/** SessionSnapshot 的 UI 展示投影：以快照为权威，重连后整体覆盖，不增量修补。 */
export interface SessionProjection {
  id: string
  name: string
  cwd: string
  model: ModelRef
  thinkingLevel: ThinkingLevel
  phase: SessionPhase
  running: boolean
  updatedAt: number
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
