import { nextTick, onBeforeUnmount, shallowRef, watch, type Ref } from "vue"
import type { ReplyJumpTarget } from "@features/transcript-view/index.js"
import { resolveCitationRange } from "@features/transcript-view/lib/citation-range.js"
import type { TimelineTurn } from "@features/transcript-view/type.js"

const HIGHLIGHT_NAME = "pig-reply-jump"
const CSS_OPACITY_VAR = "--citation-highlight-opacity"
const PULSE_DURATION_MS = 650
const HOLD_MS = 1575
const FADE_MS = 450
const HIGHLIGHT_TOTAL_MS = 1.5 * PULSE_DURATION_MS + HOLD_MS + FADE_MS
const HIGHLIGHT_PEAK = 0.45

export interface HighlightedEntry {
  entryId: string
  mode: "range" | "block"
}

export interface UseTranscriptJumpOptions {
  sessionId: () => string
  historyReady: () => boolean
  turns: Readonly<Ref<readonly TimelineTurn[]>>
  shownTurns: Readonly<Ref<Set<string>>>
  column: Readonly<Ref<HTMLElement | null>>
  jumpTarget: () => ReplyJumpTarget | null | undefined
  scrollToElement(el: HTMLElement, block?: ScrollLogicalPosition): void
  scrollToRange(range: Range): void
  pinLatest(): void
  onSettled(seq: number): void
}

export function useTranscriptJump(options: UseTranscriptJumpOptions) {
  const forcedTurnId = shallowRef<string>()
  const highlightedEntry = shallowRef<HighlightedEntry | null>(null)
  let highlightTimer = 0
  let pulseAnimation: Animation | null = null
  let jumpingSeq = 0

  function clearRangeHighlight() {
    pulseAnimation?.cancel()
    pulseAnimation = null

    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete(HIGHLIGHT_NAME)
    }
  }

  function clearHighlight() {
    if (highlightTimer) window.clearTimeout(highlightTimer)
    highlightTimer = 0
    clearRangeHighlight()
    highlightedEntry.value = null
  }

  function resetJump() {
    forcedTurnId.value = undefined
    clearHighlight()
  }

  function highlightRange(source: HTMLElement, entryId: string, range: Range) {
    clearHighlight()
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range))
    highlightedEntry.value = { entryId, mode: "range" }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const at = (ms: number) => ms / HIGHLIGHT_TOTAL_MS
    const holdEnd = at(HIGHLIGHT_TOTAL_MS - FADE_MS)
    const keyframes: Keyframe[] = reducedMotion
      ? [
          { offset: 0, [CSS_OPACITY_VAR]: HIGHLIGHT_PEAK },
          { offset: holdEnd, [CSS_OPACITY_VAR]: HIGHLIGHT_PEAK },
          { offset: 1, [CSS_OPACITY_VAR]: 0 },
        ]
      : [
          { offset: 0, [CSS_OPACITY_VAR]: 0 },
          { offset: at(PULSE_DURATION_MS * 0.5), [CSS_OPACITY_VAR]: HIGHLIGHT_PEAK },
          { offset: at(PULSE_DURATION_MS), [CSS_OPACITY_VAR]: 0 },
          { offset: at(PULSE_DURATION_MS * 1.5), [CSS_OPACITY_VAR]: HIGHLIGHT_PEAK },
          { offset: holdEnd, [CSS_OPACITY_VAR]: HIGHLIGHT_PEAK },
          { offset: 1, [CSS_OPACITY_VAR]: 0 },
        ]

    if (typeof source.animate === "function") {
      pulseAnimation = source.animate(keyframes, {
        duration: HIGHLIGHT_TOTAL_MS,
        easing: "ease-in-out",
      })
      void pulseAnimation.finished.then(
        () => {
          if (highlightedEntry.value?.entryId === entryId) clearHighlight()
        },
        () => {},
      )
      return
    }

    highlightTimer = window.setTimeout(() => {
      if (highlightedEntry.value?.entryId === entryId) clearHighlight()
    }, HIGHLIGHT_TOTAL_MS)
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
      const source = el.querySelector<HTMLElement>("[data-assistant-citation-source]") ?? el
      const canHighlight =
        typeof Highlight !== "undefined" && typeof CSS !== "undefined" && Boolean(CSS.highlights)
      const range =
        canHighlight && target.text?.trim() ? resolveCitationRange(source, target.text) : null

      if (range) {
        options.scrollToRange(range)
        highlightRange(source, target.entryId, range)
      } else {
        options.scrollToElement(el, "center")
        clearHighlight()
        highlightedEntry.value = { entryId: target.entryId, mode: "block" }
        highlightTimer = window.setTimeout(() => {
          if (highlightedEntry.value?.entryId === target.entryId) highlightedEntry.value = null
        }, 1800)
      }
    }

    options.onSettled(target.seq)
  }

  watch(
    [options.jumpTarget, options.sessionId, options.historyReady, options.turns],
    () => void tryJump(),
    { flush: "post", immediate: true },
  )

  onBeforeUnmount(clearHighlight)
  return { forcedTurnId, highlightedEntry, resetJump }
}
