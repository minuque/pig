import { onBeforeUnmount, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"

const REVEAL_MAX_FRAME_MS = 120
const QUEUE_BASE_SPEED_CPS = 90
const QUEUE_ACCEL_EXPONENT = 1.25
const QUEUE_PRESSURE = 0.85
const QUEUE_MAX_SPEED_CPS = 600

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  )
}

function canAnimate() {
  return typeof requestAnimationFrame === "function"
}

function computeAdaptiveQueueStep(
  backlog: number,
  dtMs: number,
  debt: number,
): { revealChars: number; debt: number; speedCps: number } {
  if (backlog <= 0 || dtMs <= 0) return { revealChars: 0, debt: 0, speedCps: 0 }

  const speedCps = Math.min(
    QUEUE_MAX_SPEED_CPS,
    QUEUE_BASE_SPEED_CPS + backlog ** QUEUE_ACCEL_EXPONENT * QUEUE_PRESSURE,
  )
  const accumulated = Math.max(0, debt) + speedCps * (dtMs / 1000)
  const revealChars = Math.min(backlog, Math.floor(accumulated))

  return {
    revealChars,
    debt: revealChars >= backlog ? 0 : accumulated - revealChars,
    speedCps,
  }
}

/** 流式正文按积压节奏吐字；结束或减动效时一次对齐到全文。 */
export function useTranscriptReveal(
  source: MaybeRefOrGetter<string>,
  streaming: MaybeRefOrGetter<boolean>,
) {
  const displayed = shallowRef("")

  let target = ""
  let targetChars: string[] = []
  let shown = 0
  let debt = 0
  let raf = 0
  let lastTs = 0

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    lastTs = 0
    debt = 0
  }

  function flush(content: string) {
    stop()
    target = content
    targetChars = [...content]
    shown = targetChars.length
    displayed.value = content
  }

  function tick(now: number) {
    raf = 0
    if (!toValue(streaming) || prefersReducedMotion() || !canAnimate()) {
      flush(toValue(source))
      return
    }
    const backlog = targetChars.length - shown
    if (backlog <= 0) {
      lastTs = 0
      debt = 0
      return
    }
    if (lastTs === 0) {
      lastTs = now
      raf = requestAnimationFrame(tick)
      return
    }

    const dt = Math.min(REVEAL_MAX_FRAME_MS, Math.max(0, now - lastTs))
    lastTs = now
    const step = computeAdaptiveQueueStep(backlog, dt, debt)
    debt = step.debt
    if (step.revealChars > 0) {
      shown += step.revealChars
      displayed.value = targetChars.slice(0, shown).join("")
    }
    if (shown < targetChars.length) raf = requestAnimationFrame(tick)
    else {
      lastTs = 0
      debt = 0
    }
  }

  function start() {
    if (raf) return
    lastTs = 0
    raf = requestAnimationFrame(tick)
  }

  watch(
    () => [toValue(source), toValue(streaming)] as const,
    ([content, live]) => {
      if (!live || prefersReducedMotion() || !canAnimate()) {
        flush(content)
        return
      }
      if (content === target) {
        if (shown < targetChars.length) start()
        return
      }
      if (!content.startsWith(target)) {
        flush(content)
        return
      }
      targetChars.push(...content.slice(target.length))
      target = content
      start()
    },
    { immediate: true, flush: "sync" },
  )

  onBeforeUnmount(stop)

  return displayed
}
