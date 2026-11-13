import { watch, type Ref } from "vue"
import type { SidebarPlacement } from "@features/session-nav/type.js"

/** 新建的会话落进收着的分段时自动展开一次，免得刚建完就看不见。 */
export function useRevealNewSessions(
  listed: Readonly<Ref<readonly { id: string }[]>>,
  placements: Readonly<Ref<ReadonlyMap<string, SidebarPlacement>>>,
  expand: (section: string) => void,
) {
  let known: ReadonlySet<string> | undefined
  /** 刚出现、还没定段的会话：等它被标成在跑或已归档再展开。 */
  const pending = new Set<string>()

  // 列表与分段在一个 watch 里：新会话出现时已在跑，同一次更新里就要认出它
  watch([listed, placements], ([list, map], [previous]) => {
    // 第一次变化的列表只当底数，之后多出来的才算新建
    if (list !== previous) {
      const ids = new Set(list.map((item) => item.id))

      if (known) for (const id of ids) if (!known.has(id)) pending.add(id)
      known = ids
    }

    for (const id of pending) {
      const placement = map.get(id)

      if (!known?.has(id)) pending.delete(id)
      else if (placement?.running || placement?.settled) {
        expand(placement.running ? "working" : "settled")
        pending.delete(id)
      }
    }
  })
}
