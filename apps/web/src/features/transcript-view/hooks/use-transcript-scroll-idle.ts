import {
  onBeforeUnmount,
  shallowRef,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  toValue,
} from "vue"

export const transcriptScrollIdleKey: InjectionKey<Ref<boolean>> = Symbol("transcriptScrollIdle")

const IDLE_MS = 120

/** 滚动中为 false；scrollend 或短超时后为 true。 */
export function useTranscriptScrollIdle(root: MaybeRefOrGetter<HTMLElement | null>) {
  const idle = shallowRef(true)
  let timer = 0
  let attached: HTMLElement | null = null

  function clearTimer() {
    if (!timer) return
    window.clearTimeout(timer)
    timer = 0
  }

  function markIdle() {
    clearTimer()
    idle.value = true
  }

  function markBusy() {
    idle.value = false
    clearTimer()
    timer = window.setTimeout(markIdle, IDLE_MS)
  }

  function bind(next: HTMLElement | null) {
    if (attached === next) return

    if (attached) {
      attached.removeEventListener("scroll", markBusy)
      attached.removeEventListener("scrollend", markIdle)
    }

    attached = next

    if (!next) return
    next.addEventListener("scroll", markBusy, { passive: true })
    next.addEventListener("scrollend", markIdle)
  }

  watch(
    () => toValue(root),
    (el) => bind(el),
    { flush: "post", immediate: true },
  )

  onBeforeUnmount(() => {
    bind(null)
    clearTimer()
  })
  return idle
}
