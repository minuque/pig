import type {
  ModelRef,
  SessionPhase,
  ThinkingLevel,
  UserTranscriptItem,
} from "@/types/common-type.js"

export interface PresetPort {
  createModel(): { model: ModelRef; thinkingLevel: ThinkingLevel } | undefined
  consumeDetachedEdit(): { model: ModelRef; thinkingLevel: string } | undefined
}

export interface OptimisticUserMessage {
  item: UserTranscriptItem
  knownItemIds: readonly string[]
}

export interface SessionClientState {
  draft: string
  sends: OptimisticUserMessage[]
  submitting: boolean
  aborting: boolean
  epoch: number
}

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
