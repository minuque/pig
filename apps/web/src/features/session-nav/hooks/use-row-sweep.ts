import { onBeforeUnmount, shallowRef, type ShallowRef } from "vue"
import {
  startPointerDrag,
  type PointerDragHandle,
} from "@features/session-nav/hooks/use-pointer-drag.js"
import { sweepIds } from "@features/session-nav/lib/drag-plan.js"
import type { SidebarSection } from "@features/session-nav/type.js"

const SWEEP_DISTANCE = 6

/** 按住行尾的归档/还原按钮上下扫：扫过的同段会话松手时一起处理。 */
export function useRowSweep(options: {
  list: ShallowRef<HTMLElement | undefined>
  sections: () => readonly SidebarSection[]
  apply: (ids: readonly string[], settled: boolean) => void
}) {
  const swept = shallowRef<ReadonlySet<string>>(new Set())
  let handle: PointerDragHandle | undefined

  function start(sectionKey: string, id: string, event: PointerEvent): void {
    const section = options.sections().find((item) => item.key === sectionKey)

    if (!section) return
    const order = section.sessions.map((session) => session.id)
    const drafts = new Set(section.sessions.filter((s) => s.draft).map((s) => s.id))
    const canApply = (key: string) => !drafts.has(key)
    let target = id

    function sweepTo(next: string): void {
      target = next
      swept.value = new Set(sweepIds(order, id, target, canApply))
    }

    /** 指针所在的那一行：取顶边在指针之上的最后一行，超出两端就停在端点。 */
    function rowAt(y: number): string {
      const rows = options.list.value?.querySelectorAll<HTMLElement>(
        `.session-section[data-key="${sectionKey}"] .session-row[data-id]`,
      )
      let hit = rows?.[0]?.dataset.id ?? target

      for (const row of rows ?? []) {
        if (row.getBoundingClientRect().top > y) break
        hit = row.dataset.id!
      }

      return hit
    }

    handle?.cancel()
    handle = startPointerDrag(event, {
      distance: SWEEP_DISTANCE,
      onStart: () => sweepTo(id),
      onMove: (point) => sweepTo(rowAt(point.y)),
      onDrop: () => {
        const ids = [...swept.value]
        swept.value = new Set()

        if (ids.length) options.apply(ids, section.kind === "settled")
      },
      onCancel: () => {
        swept.value = new Set()
      },
      onFinish: () => {
        handle = undefined
      },
    })
  }

  onBeforeUnmount(() => handle?.cancel())
  return { swept, start }
}
