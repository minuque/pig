import { computed, shallowRef, type MaybeRefOrGetter, toValue } from "vue"
import type { TimelineRow } from "@features/transcript-view/lib/transcript-rows.js"
import { isThinkingRow, isWorkRow } from "@features/transcript-view/lib/transcript-rows.js"
import {
  deriveTranscriptMinimapItems,
  resolveMinimapHasPersistentGutter,
  resolveMinimapHitStripWidth,
  sameIdList,
} from "@features/transcript-view/lib/transcript-minimap.js"

function previewText(row: TimelineRow): string {
  if (isThinkingRow(row) || isWorkRow(row)) return ""
  return row.text
}

export function useTranscriptMinimap(rows: MaybeRefOrGetter<readonly TimelineRow[]>) {
  const viewportWidth = shallowRef(0)
  const contentWidth = shallowRef(0)
  const inViewIds = shallowRef<readonly string[]>([])
  const items = computed(() =>
    deriveTranscriptMinimapItems(
      toValue(rows).map((row) => ({ id: row.id, role: row.role, text: previewText(row) })),
    ),
  )
  const hasPersistentGutter = computed(() =>
    resolveMinimapHasPersistentGutter(viewportWidth.value, contentWidth.value),
  )
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )

  function collectInViewIds(region: HTMLElement | null): string[] {
    if (!region) return []
    const viewport = region.getBoundingClientRect()
    const ids: string[] = []
    for (const el of region.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
      const box = el.getBoundingClientRect()
      if (box.bottom <= viewport.top || box.top >= viewport.bottom) continue
      const id = el.dataset.minimapRow
      if (id) ids.push(id)
    }
    return ids
  }

  function syncLayout(region: HTMLElement | null, scroller: HTMLElement | null) {
    viewportWidth.value = region?.clientWidth ?? 0
    contentWidth.value = scroller?.offsetWidth ?? 0
    const next = collectInViewIds(region)
    if (!sameIdList(inViewIds.value, next)) inViewIds.value = next
  }

  return { items, inViewIds, hasPersistentGutter, hitStripWidth, syncLayout }
}
