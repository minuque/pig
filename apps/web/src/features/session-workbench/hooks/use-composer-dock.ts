import { nextTick, watch, type Ref, type WatchSource } from "vue"
import { flipMotion } from "@features/composer/lib/composer-flip.js"

/** 首屏↔会话切换时输入条从旧底边滑到新底边；中途反向从当前可见位置接着走。 */
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
      const { duration, easing } = flipMotion(el, next ? "out" : "in")

      glide = el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration,
        easing,
      })
    })
  })
}
