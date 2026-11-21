import { watch, type Ref, type ShallowRef } from "vue"
import { openInFocused, type SplitState } from "@features/split-view/lib/split-state.js"

export function useSplitRoute(
  state: ShallowRef<SplitState>,
  route: Readonly<Ref<string | undefined | null>>,
  go: (id: string | undefined) => void,
) {
  const focusedId = () => state.value[state.value.focused]

  if (route.value === undefined && focusedId() !== undefined) go(focusedId())
  else if (route.value !== null) state.value = openInFocused(state.value, route.value)

  watch(route, (id, previous) => {
    if (id === null) return

    if (previous === null && id === undefined && focusedId() !== undefined) return go(focusedId())
    state.value = openInFocused(state.value, id)
  })
  watch(focusedId, (id) => {
    if (route.value !== null && id !== route.value) go(id)
  })
}
