import { useEventListener } from "@vueuse/core"
import type { Ref } from "vue"

const THRESHOLD = 80
const SETTLE_MS = 240

function scrollsFurther(from: EventTarget | null, root: HTMLElement, dx: number): boolean {
  for (let el = from instanceof Element ? from : null; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue
    const overflow = getComputedStyle(el).overflowX

    if (overflow !== "auto" && overflow !== "scroll") continue

    if (dx > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0)
      return true
  }

  return false
}

export function useSwipePager(
  root: Readonly<Ref<HTMLElement | null>>,
  step: (delta: 1 | -1) => void,
) {
  let total = 0
  let locked = false
  let timer: ReturnType<typeof setTimeout> | undefined

  useEventListener(
    root,
    "wheel",
    (event: WheelEvent) => {
      const el = root.value

      if (!el || event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.5) return

      if (!locked && scrollsFurther(event.target, el, event.deltaX)) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        total = 0
        locked = false
      }, SETTLE_MS)

      if (locked) return
      total += event.deltaX

      if (Math.abs(total) < THRESHOLD) return
      locked = true
      step(total > 0 ? 1 : -1)
    },
    { passive: true },
  )
}
