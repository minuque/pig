import { describe, expect, it } from "vitest"
import { computed, shallowRef } from "vue"
import { focusedSession } from "@features/split-view/index.js"

function side(id: string | undefined, running: boolean, pool: string[] = []) {
  return {
    sessionId: computed(() => id),
    projection: computed(() => (id ? { running } : undefined)),
    transcript: computed(() => []),
    prompt: shallowRef(""),
    backgroundRunningIds: shallowRef<ReadonlySet<string>>(new Set(pool)),
    loadHistory: async () => {},
  }
}

describe("给侧栏的聚焦侧视图", () => {
  it("另一侧在跑的会话也算在跑，两侧开着的会话都算在显示", () => {
    const left = side("a", true, ["z"])
    const right = side("b", false, ["z"])
    const view = focusedSession(
      () => right as never,
      () => left as never,
    )

    expect([...view.backgroundRunningIds.value].sort()).toEqual(["a", "z"])
    expect(view.shownIds.value).toEqual(["b", "a"])
  })
})
