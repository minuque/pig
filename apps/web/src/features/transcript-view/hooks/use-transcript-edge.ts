import { onMounted, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"

/** 行到了就贴底并揭开，不等 rAF。 */
export function useTranscriptReveal(
  rows: MaybeRefOrGetter<readonly TimelineRow[]>,
  pinLatest: () => void,
) {
  const readyFrame = shallowRef(toValue(rows).length > 0)

  function reveal() {
    if (toValue(rows).length === 0) {
      readyFrame.value = false
      return
    }

    pinLatest()
    readyFrame.value = true
  }

  onMounted(reveal)

  watch(
    () => toValue(rows),
    (next, prev) => {
      if (next.length === 0) {
        readyFrame.value = false
        return
      }

      if ((prev?.length ?? 0) === 0 || !readyFrame.value) reveal()
    },
  )
  return { readyFrame }
}

/** 更早一页只由按钮触发：滚到顶不自动拉，避免误加载。 */
export function useTranscriptOlder(options: {
  hasMore: () => boolean
  loading: () => boolean
  load: () => void
}) {
  function request() {
    if (!options.hasMore() || options.loading()) return
    options.load()
  }

  return { request }
}
