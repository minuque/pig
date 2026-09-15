import { onMounted, shallowRef, watch, type Ref } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"

/** 行到了就贴底并揭开，不等 rAF。 */
export function useTranscriptReveal(rows: Ref<readonly TimelineRow[]>, pinLatest: () => void) {
  const readyFrame = shallowRef(rows.value.length > 0)

  function reveal() {
    if (rows.value.length === 0) {
      readyFrame.value = false
      return
    }

    pinLatest()
    readyFrame.value = true
  }

  onMounted(reveal)

  watch(rows, (next, prev) => {
    if (next.length === 0) {
      readyFrame.value = false
      return
    }

    if ((prev?.length ?? 0) === 0 || !readyFrame.value) reveal()
  })
  return { readyFrame }
}
