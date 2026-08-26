import { reactive, watch, type MaybeRefOrGetter, toValue } from "vue"

/** 展开态只活在当前 Session 内存：虚拟卸载保留，切 Session 清空。 */
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

  function isFoldOpen(id: string): boolean {
    return expandedFolds.get(id) === true
  }

  function toggleFold(id: string) {
    expandedFolds.set(id, !isFoldOpen(id))
  }

  function toggleTool(id: string, open: boolean) {
    expandedTools.set(id, open)
  }

  return { expandedTools, isFoldOpen, toggleFold, toggleTool }
}
