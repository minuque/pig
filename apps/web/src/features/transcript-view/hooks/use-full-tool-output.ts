import { inject, shallowRef, watch, type InjectionKey, type Ref } from "vue"
import { transcriptItem } from "@client/platform.js"
import { transcriptText } from "@features/session/lib/transcript-text.js"
import { transcriptImages } from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

export const TRANSCRIPT_SESSION_ID: InjectionKey<Ref<string>> = Symbol("transcript-session-id")

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
