import { reactive, watch, type MaybeRefOrGetter, toValue } from "vue"

const SESSION_SLOT_MAX = 5

/** 展开态按会话留着，切走再切回不丢。 */
export function useTranscriptExpand(sessionId: MaybeRefOrGetter<string>) {
  const expandedTools = reactive(new Map<string, boolean>())
  const expandedRows = reactive(new Map<string, boolean>())
  const cache = new Map<string, { tools: Map<string, boolean>; rows: Map<string, boolean> }>()

  watch(
    () => toValue(sessionId),
    (next, prev) => {
      if (!prev || !next || prev === next) return
      cache.delete(prev)
      cache.set(prev, { tools: new Map(expandedTools), rows: new Map(expandedRows) })

      while (cache.size > SESSION_SLOT_MAX) {
        const oldest = cache.keys().next().value

        if (oldest === undefined || oldest === next) break
        cache.delete(oldest)
      }

      expandedTools.clear()
      expandedRows.clear()
      const hit = cache.get(next)

      if (!hit) return

      for (const [id, open] of hit.tools) expandedTools.set(id, open)

      for (const [id, open] of hit.rows) expandedRows.set(id, open)
    },
  )

  function isExpand(id: string): boolean | undefined {
    return expandedRows.get(id)
  }

  function toggleExpand(id: string, open: boolean) {
    expandedRows.set(id, open)
  }

  function toggleTool(id: string, open: boolean) {
    expandedTools.set(id, open)
  }

  return { expandedTools, isExpand, toggleExpand, toggleTool }
}
