import { toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import type { SidebarPlacement } from "@features/session-nav/type.js"

export function useRevealNewSessions(
  listed: Readonly<Ref<readonly { id: string }[]>>,
  placements: Readonly<Ref<ReadonlyMap<string, SidebarPlacement>>>,
  expand: (section: string) => void,
  ready?: MaybeRefOrGetter<boolean>,
) {
  let known: ReadonlySet<string> | undefined
  const pending = new Set<string>()

  watch(
    [listed, placements, () => (ready ? toValue(ready) : true)] as const,
    ([list, map, isReady], prev) => {
      if (!isReady) return

      if (!known) {
        known = new Set(list.map((item) => item.id))
        return
      }

      if (list !== prev?.[0]) {
        const ids = new Set(list.map((item) => item.id))

        for (const id of ids) if (!known.has(id)) pending.add(id)
        known = ids
      }

      for (const id of pending) {
        const placement = map.get(id)

        if (!known.has(id)) pending.delete(id)
        else if (placement?.running || placement?.settled) {
          expand(placement.running ? "working" : "settled")
          pending.delete(id)
        }
      }
    },
    { immediate: Boolean(ready) },
  )
}
