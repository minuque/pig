import { onBeforeUnmount, type Ref } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { prefersReducedMotion } from "@utils/motion.js"

const RESERVE_DEBOUNCE_MS = 120

export function useComposerReserve(
  bar: Readonly<Ref<HTMLElement | null>>,
  hero: () => boolean,
): void {
  let timer = 0

  useResizeObserver(
    bar,
    (entries) => {
      const element = bar.value
      const column = element?.closest(".conversation-column")
      const box = entries[0]?.borderBoxSize?.[0]
      const height = box?.blockSize ?? element?.getBoundingClientRect().height ?? 0

      if (!(column instanceof HTMLElement) || height <= 0) return
      const next = `${Math.ceil(height)}px`
      const prev = column.style.getPropertyValue("--composer-reserve")

      if (prev === next) return
      window.clearTimeout(timer)

      if (prev && !hero() && !prefersReducedMotion()) {
        timer = window.setTimeout(() => {
          timer = 0
          column.style.setProperty("--composer-reserve", next)
        }, RESERVE_DEBOUNCE_MS)
        return
      }

      column.style.setProperty("--composer-reserve", next)
    },
    { box: "border-box" },
  )

  onBeforeUnmount(() => window.clearTimeout(timer))
}
