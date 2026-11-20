import { nextTick, watch, type Ref, type WatchSource } from "vue"

export function useComposerDock(
  bar: Readonly<Ref<HTMLElement | null>>,
  hero: WatchSource<boolean>,
): void {
  let glide: Animation | undefined

  watch(hero, (next) => {
    const el = bar.value

    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const from = el.getBoundingClientRect().bottom

    void nextTick(() => {
      glide?.cancel()
      const dy = from - el.getBoundingClientRect().bottom

      if (Math.abs(dy) < 1) return
      const { duration, easing } = dockMotion(el, next ? "out" : "in")

      glide = el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration,
        easing,
      })
    })
  })
}

function dockMotion(el: Element, dock: "in" | "out"): { duration: number; easing: string } {
  const style = getComputedStyle(el)
  return {
    duration: Number.parseFloat(style.getPropertyValue(`--composer-dock-${dock}`)) || 0,
    easing: style.getPropertyValue("--ease-out").trim() || "ease-out",
  }
}
