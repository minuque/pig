import type {
  ModelRef,
  SessionPhase,
  ThinkingLevel,
  UserTranscriptItem,
} from "@/types/common-type.js"

export interface OptimisticUserMessage {
  item: UserTranscriptItem
  knownItemIds: readonly string[]
}

/** 每 Session 的 UI 私有状态（草稿、乐观用户句），不进入任何 Agent Domain。 */
export interface SessionClientState {
  draft: string
  optimisticUser: OptimisticUserMessage | null
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
