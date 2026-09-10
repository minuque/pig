import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue"

/** 历史助手句先纯文字上屏，paint 后再 hydrate Markdown。 */
export function useDeferredMarkdown(streaming: MaybeRefOrGetter<boolean>) {
  const rich = shallowRef(toValue(streaming))
  let idle = 0
  let raf = 0

  function cancel() {
    if (idle) {
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle)
      idle = 0
    }
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  function hydrate() {
    cancel()
    rich.value = true
  }

  function arm() {
    cancel()
    if (toValue(streaming)) {
      rich.value = true
      return
    }
    rich.value = false
    void nextTick(() => {
      if (toValue(streaming)) {
        rich.value = true
        return
      }
      if (typeof requestIdleCallback === "function") {
        idle = requestIdleCallback(() => hydrate(), { timeout: 200 })
        return
      }
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => hydrate())
      })
    })
  }

  onMounted(arm)

  watch(
    () => toValue(streaming),
    (live) => {
      if (live) hydrate()
    },
  )

  onBeforeUnmount(cancel)

  return rich
}
