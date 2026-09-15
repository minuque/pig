import { nextTick, onMounted, shallowRef, watch, type Ref } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** 有行且贴底画出一帧后再揭开；已有行则不挡。 */
export function useTranscriptReveal(rows: Ref<readonly TimelineRow[]>, pinLatest: () => void) {
  const readyFrame = shallowRef(rows.value.length > 0)
  let token = 0

  async function reveal() {
    if (rows.value.length === 0) {
      readyFrame.value = false
      return
    }

    pinLatest()

    if (readyFrame.value) return
    const mine = ++token
    await nextTick()

    if (mine !== token) return
    pinLatest()
    await afterPaint()

    if (mine !== token || rows.value.length === 0) return
    readyFrame.value = true
  }

  onMounted(() => {
    void reveal()
  })

  watch(rows, (next, prev) => {
    if (next.length === 0) {
      readyFrame.value = false
      return
    }

    if ((prev?.length ?? 0) === 0) void reveal()
  })
  return { readyFrame }
}
