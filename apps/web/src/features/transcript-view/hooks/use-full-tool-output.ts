import { inject, shallowRef, watch, type InjectionKey, type Ref } from "vue"
import { transcriptItem } from "@client/platform.js"
import {
  transcriptImages,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

/** 当前时间线所属会话；工具行展开时据此取完整输出。 */
export const TRANSCRIPT_SESSION_ID: InjectionKey<Ref<string>> = Symbol("transcript-session-id")

/** 被截断的工具输出：第一次展开时取回完整条目，之后用它替换预览。 */
export function useFullToolOutput(call: () => ToolCallView, open: () => boolean) {
  const sessionId = inject(TRANSCRIPT_SESSION_ID, undefined)
  const full = shallowRef<ToolCallView>()

  watch(
    () => open() && call().truncated === true && !full.value,
    async (needed) => {
      const id = sessionId?.value

      if (!needed || !id) return
      const current = call()
      const item = await transcriptItem(id, current.id).catch(() => undefined)

      if (!item || item.role !== "tool") return
      full.value = {
        ...current,
        outputText: transcriptText(item),
        outputImages: transcriptImages(item),
        truncated: false,
      }
    },
    { immediate: true },
  )
  return () => full.value ?? call()
}
