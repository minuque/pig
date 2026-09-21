import { onBeforeUnmount, shallowRef, watch, type MaybeRefOrGetter, toValue } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  canUpgradeHeavy,
  HEAVY_UPGRADE_PER_FRAME,
  pickHeavyUpgrades,
  streamingIds,
} from "@features/transcript-view/lib/transcript-heavy.js"

/**
 * 窗口层决定挂哪几行，这里决定挂着的行什么时候升到 Markdown。
 * 只认当前挂载的行：卸载就降级，滚回来重挂走纯文本，不再为同一行反复付重渲染。
 * 滚动中不升级，停稳后每帧补几行，展开和跳转的目标行不等停稳。
 */
export function useTranscriptHeavy(options: {
  mounted: MaybeRefOrGetter<readonly TimelineRow[]>
  idle: MaybeRefOrGetter<boolean>
}) {
  const heavy = shallowRef<ReadonlySet<string>>(new Set())
  const immediate = new Set<string>()
  let raf = 0

  /** 已挂的非助手行永远不会升级，标记留着会一直占位。 */
  function dropDeadMarks(rows: readonly TimelineRow[]) {
    if (immediate.size === 0) return
    const mounted = new Map(rows.map((row) => [row.id, row]))

    for (const id of immediate) {
      const row = mounted.get(id)

      if (row && !canUpgradeHeavy(row)) immediate.delete(id)
    }
  }

  function flush() {
    raf = 0
    const rows = toValue(options.mounted)
    const next = new Set(streamingIds(rows))

    for (const row of rows) if (heavy.value.has(row.id)) next.add(row.id)

    dropDeadMarks(rows)

    const picked = pickHeavyUpgrades(rows, {
      heavy: next,
      immediate,
      idle: toValue(options.idle),
    })

    for (const id of picked) {
      next.add(id)
      immediate.delete(id)
    }

    if (next.size !== heavy.value.size) heavy.value = next

    if (picked.length >= HEAVY_UPGRADE_PER_FRAME) schedule()
  }

  function schedule() {
    if (raf) return
    raf = requestAnimationFrame(flush)
  }

  /** 点名行下一帧就升级，用于展开和跳转，避免「点了没反应」。 */
  function upgradeNow(id: string) {
    if (!id || heavy.value.has(id)) return
    immediate.add(id)
    schedule()
  }

  watch([() => toValue(options.mounted), () => toValue(options.idle)], schedule, { flush: "post" })

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  })
  return { isHeavy: (id: string) => heavy.value.has(id), upgradeNow }
}
