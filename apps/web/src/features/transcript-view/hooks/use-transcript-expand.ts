import { reactive, watch, type MaybeRefOrGetter, toValue } from "vue"

/** 展开态只活在当前 Session 内存，切 Session 清空。 */
export function useTranscriptExpand(sessionId: MaybeRefOrGetter<string>) {
  const expandedTools = reactive(new Map<string, boolean>())
  const expandedFolds = reactive(new Map<string, boolean>())

  watch(
    () => toValue(sessionId),
    () => {
      expandedTools.clear()
      expandedFolds.clear()
    },
  )

  function isFoldOpen(id: string): boolean | undefined {
    return expandedFolds.get(id)
  }

  function toggleFold(id: string, open: boolean) {
    expandedFolds.set(id, open)
  }

  function toggleTool(id: string, open: boolean) {
    expandedTools.set(id, open)
  }

  return { expandedTools, isFoldOpen, toggleFold, toggleTool }
}
