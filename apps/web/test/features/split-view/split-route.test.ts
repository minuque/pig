import { effectScope, nextTick, shallowRef } from "vue"
import { describe, expect, it } from "vitest"
import { useSplitRoute } from "@features/split-view/hooks/use-split-route.js"
import {
  emptySplit,
  focusSide,
  openInFocused,
  openToSide,
  type SplitState,
} from "@features/split-view/lib/split-state.js"

function setup(initial: SplitState, initialRoute: string | undefined) {
  const state = shallowRef(initial)
  const route = shallowRef(initialRoute)
  const pushed: (string | undefined)[] = []
  const scope = effectScope()

  scope.run(() =>
    useSplitRoute(state, route, (id) => {
      pushed.push(id)
      route.value = id
    }),
  )
  return { state, route, pushed, scope }
}

describe("路由只表示聚焦那一侧", () => {
  it("路由切到右侧已开着的会话：聚焦右侧，不替换左侧", async () => {
    const { state, route } = setup(openToSide(openInFocused(emptySplit, "a"), "b"), "b")

    state.value = focusSide(state.value, "left")
    await nextTick()
    route.value = "b"
    await nextTick()

    expect(state.value).toMatchObject({ left: "a", right: "b", focused: "right" })
  })

  it("路由换到新会话：落在聚焦的一侧", async () => {
    const { state, route } = setup(openToSide(openInFocused(emptySplit, "a"), "b"), "b")

    route.value = "c"
    await nextTick()

    expect(state.value).toMatchObject({ left: "a", right: "c", focused: "right" })
  })

  it("聚焦切换时路由跟到那一侧的会话", async () => {
    const { state, pushed } = setup(openToSide(openInFocused(emptySplit, "a"), "b"), "b")

    state.value = focusSide(state.value, "left")
    await nextTick()

    expect(pushed).toEqual(["a"])
  })

  it("启动时地址没带会话：恢复上次聚焦的会话", () => {
    const { route, state } = setup(openToSide(openInFocused(emptySplit, "a"), "b"), undefined)

    expect(route.value).toBe("b")
    expect(state.value).toMatchObject({ left: "a", right: "b", split: true })
  })
})
