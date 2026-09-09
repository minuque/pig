import { onBeforeUnmount, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"

const NEAR_MARGIN = "480px 0px"

/** 进入滚动根附近后保持为真，不随滚出视口卸掉。 */
export function useNearViewport(
  target: MaybeRefOrGetter<HTMLElement | null>,
  root: MaybeRefOrGetter<HTMLElement | null>,
  always: MaybeRefOrGetter<boolean>,
) {
  const near = shallowRef(toValue(always))
  let observer: IntersectionObserver | undefined

  function disconnect() {
    observer?.disconnect()
    observer = undefined
  }

  function observe() {
    disconnect()
    if (toValue(always) || near.value) {
      near.value = true
      return
    }
    const el = toValue(target)
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      near.value = true
      return
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        near.value = true
        disconnect()
      },
      { root: toValue(root), rootMargin: NEAR_MARGIN, threshold: 0 },
    )
    observer.observe(el)
  }

  watch(() => [toValue(target), toValue(root), toValue(always)] as const, observe, {
    flush: "post",
    immediate: true,
  })

  onBeforeUnmount(disconnect)

  return near
}
