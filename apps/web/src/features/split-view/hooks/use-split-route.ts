import { watch, type Ref, type ShallowRef } from "vue"
import { openInFocused, type SplitState } from "@features/split-view/lib/split-state.js"

/**
 * 路由只表示聚焦那一侧的会话：路由变了落到聚焦侧，聚焦侧变了路由跟过去。
 * route 为 null 表示不是工作台页（如启动出错页），这时不动分屏。
 */
export function useSplitRoute(
  state: ShallowRef<SplitState>,
  route: Readonly<Ref<string | undefined | null>>,
  go: (id: string | undefined) => void,
) {
  const focusedId = () => state.value[state.value.focused]

  // 启动时地址没带会话，以上次存下的分屏为准
  if (route.value === undefined && focusedId() !== undefined) go(focusedId())
  else if (route.value !== null) state.value = openInFocused(state.value, route.value)

  watch(route, (id, previous) => {
    if (id === null) return

    // 从出错页回到首页：和启动时一样，回到聚焦侧的会话
    if (previous === null && id === undefined && focusedId() !== undefined) return go(focusedId())
    state.value = openInFocused(state.value, id)
  })
  watch(focusedId, (id) => {
    if (route.value !== null && id !== route.value) go(id)
  })
}
