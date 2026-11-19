import { reactive } from "vue"
import type { SessionPhase, SessionSnapshot } from "@/types/common-type.js"
import { t } from "@i18n/index.js"
import { untitledSession } from "@features/session/lib/session-title.js"
import type {
  OptimisticUserMessage,
  SessionClientState,
  SessionProjection,
} from "@features/session/type.js"

export function emptyClientState(): SessionClientState {
  return reactive<SessionClientState>({
    draft: "",
    sends: [],
    submitting: false,
    aborting: false,
    epoch: 0,
  })
}

export function sessionState(states: Map<string, SessionClientState>, sessionId: string) {
  let state = states.get(sessionId)

  if (!state) {
    state = emptyClientState()
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

/** 欢迎页建出会话：草稿、本地句与在飞的发送整体交给新会话，欢迎页回到空白。 */
export function handOffIdle(
  states: Map<string, SessionClientState>,
  sessionId: string,
  idle: SessionClientState,
): SessionClientState {
  const state = sessionState(states, sessionId)

  if (state.sends.length === 0) state.sends = idle.sends

  if (!state.draft) state.draft = idle.draft
  state.submitting = idle.submitting
  state.aborting = idle.aborting
  state.epoch = idle.epoch
  Object.assign(idle, { draft: "", sends: [], submitting: false, aborting: false })
  return state
}

export function projectSessionSnapshot(snapshot: SessionSnapshot): SessionProjection {
  return {
    id: snapshot.id,
    name: snapshot.name?.trim() || untitledSession(),
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
      return t("session.running")
    case "compaction":
      return t("transcript.compressing")
    case "retry":
      return t("transcript.retrying")
    case "branch_summary":
      return t("transcript.branchSummary")
    default:
      return t("composer.contextIdle")
  }
}
