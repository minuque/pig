import { shallowRef, watch } from "vue"

export interface TranscriptPositionOptions {
  sessionId: () => string
  ready: () => boolean
  readScrollTop: () => number | undefined
  restore: (top: number) => void
  pinLatest: () => void
  onSessionChange?: () => void
}

export function useTranscriptPosition(options: TranscriptPositionOptions) {
  const memory = new Map<string, number>()
  const pendingSession = shallowRef<string | undefined>(options.sessionId() || undefined)

  watch(
    options.sessionId,
    (id, prev) => {
      if (prev === id) return

      if (prev && pendingSession.value !== prev) {
        const top = options.readScrollTop()

        if (top !== undefined) memory.set(prev, top)
      }

      if (prev) options.onSessionChange?.()
      pendingSession.value = id || undefined
    },
    { flush: "pre" },
  )

  function applyIfReady() {
    const target = pendingSession.value

    if (!target || target !== options.sessionId() || !options.ready()) return
    pendingSession.value = undefined
    const saved = memory.get(target)

    if (saved !== undefined) options.restore(saved)
    else options.pinLatest()
  }

  watch([pendingSession, options.ready], applyIfReady, { flush: "post", immediate: true })
}
