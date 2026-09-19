import { onMounted, shallowRef, watch, type Ref } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"

/** 行到了就揭开；贴底交给底锚和 spacer，不在揭开时写 scrollTop。 */
export function useTranscriptReveal(rows: Ref<readonly TimelineRow[]>) {
  const readyFrame = shallowRef(rows.value.length > 0)

  function reveal() {
    if (rows.value.length === 0) {
      readyFrame.value = false
      return
    }

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
