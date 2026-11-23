import { nextTick, onBeforeUnmount, shallowRef, watch, type Ref } from "vue"
import type { ReplyJumpTarget } from "@features/transcript-view/index.js"
import type { TimelineTurn } from "@features/transcript-view/type.js"

export interface UseTranscriptJumpOptions {
  sessionId: () => string
  historyReady: () => boolean
  turns: Readonly<Ref<readonly TimelineTurn[]>>
  shownTurns: Readonly<Ref<Set<string>>>
  column: Readonly<Ref<HTMLElement | null>>
  jumpTarget: () => ReplyJumpTarget | null | undefined
  scrollToElement(el: HTMLElement, block?: ScrollLogicalPosition): void
  pinLatest(): void
  onSettled(seq: number): void
}

export function useTranscriptJump(options: UseTranscriptJumpOptions) {
  const forcedTurnId = shallowRef<string>()
  const highlightedEntryId = shallowRef<string | null>(null)
  let highlightTimer = 0
  let jumpingSeq = 0

  function clearHighlight() {
    if (highlightTimer) window.clearTimeout(highlightTimer)
    highlightTimer = 0
    highlightedEntryId.value = null
  }

  function resetJump() {
    forcedTurnId.value = undefined
    clearHighlight()
  }

  async function tryJump() {
    const target = options.jumpTarget()
    const currentSession = options.sessionId()

    if (!target || target.sessionId !== currentSession || target.seq === jumpingSeq) return

    const match = options.turns.value.find((turn) =>
      turn.rows.some((row) => row.role === "assistant" && row.entryId === target.entryId),
    )

    if (!match) {
      if (options.historyReady()) {
        jumpingSeq = target.seq
        options.pinLatest()
        options.onSettled(target.seq)
      }

      return
    }

    jumpingSeq = target.seq
    forcedTurnId.value = match.id
    options.shownTurns.value.add(match.id)
    await nextTick()
    await nextTick()

    if (options.jumpTarget()?.seq !== target.seq || options.sessionId() !== currentSession) return

    const el = options.column.value?.querySelector<HTMLElement>(
      `[data-entry-id="${CSS.escape(target.entryId)}"]`,
    )

    if (el) {
      options.scrollToElement(el, "center")
      clearHighlight()
      highlightedEntryId.value = target.entryId
      highlightTimer = window.setTimeout(() => {
        if (highlightedEntryId.value === target.entryId) highlightedEntryId.value = null
      }, 1800)
    }

    options.onSettled(target.seq)
  }

  watch(
    [options.jumpTarget, options.sessionId, options.historyReady, options.turns],
    () => void tryJump(),
    { flush: "post", immediate: true },
  )

  onBeforeUnmount(clearHighlight)
  return { forcedTurnId, highlightedEntryId, resetJump }
}
