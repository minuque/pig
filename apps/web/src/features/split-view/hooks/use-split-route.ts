import { watch, type Ref, type ShallowRef } from "vue"
import { openInFocused, type SplitState } from "@features/split-view/lib/split-state.js"

/** 路由只表示聚焦那一侧的会话：路由变了落到聚焦侧，聚焦侧变了路由跟过去。 */
export function useSplitRoute(
  state: ShallowRef<SplitState>,
  route: Readonly<Ref<string | undefined>>,
  go: (id: string | undefined) => void,
) {
  const focusedId = () => state.value[state.value.focused]

  // 启动时地址没带会话，以上次存下的分屏为准
  if (route.value === undefined && focusedId() !== undefined) go(focusedId())
  else state.value = openInFocused(state.value, route.value)

  watch(route, (id) => {
    state.value = openInFocused(state.value, id)
  })
  watch(focusedId, (id) => {
    if (id !== route.value) go(id)
  })
}
