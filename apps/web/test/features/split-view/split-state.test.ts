import { describe, expect, it } from "vitest"
import { computed, shallowRef } from "vue"
import { focusedSession } from "@features/split-view/index.js"
import {
  closeSide,
  emptySplit,
  fitsSplit,
  focusSide,
  newOnRight,
  openInFocused,
  openToSide,
  parseSplit,
  serializeSplit,
  setRatio,
} from "@features/split-view/lib/split-state.js"

describe("分屏状态", () => {
  it("未分屏时在另一侧打开：出现右侧并聚焦右侧", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), "b")

    expect(state).toMatchObject({ left: "a", right: "b", split: true, focused: "right" })
  })

  it("要打开的会话已在另一侧：只改聚焦，不重复打开", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), "b")

    expect(openInFocused(focusSide(state, "left"), "b")).toMatchObject({
      left: "a",
      right: "b",
      focused: "right",
    })
    expect(openToSide(state, "a")).toMatchObject({ left: "a", right: "b", focused: "left" })
  })

  it("已分屏时在另一侧打开：替换未聚焦的那一侧并聚焦它", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), "b")

    expect(openToSide(state, "c")).toMatchObject({ left: "c", right: "b", focused: "left" })
  })

  it("普通打开落在聚焦的一侧", () => {
    const state = focusSide(openToSide(openInFocused(emptySplit, "a"), "b"), "left")

    expect(openInFocused(state, "c")).toMatchObject({ left: "c", right: "b", focused: "left" })
  })

  it("关闭一侧：另一侧占满，成为唯一的左侧", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), "b")

    expect(closeSide(state, "left")).toMatchObject({ left: "b", split: false, focused: "left" })
    expect(closeSide(state, "right")).toMatchObject({ left: "a", split: false, focused: "left" })
  })

  it("右侧新建会话：分屏且右侧是空白新会话页", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), undefined)

    expect(state).toMatchObject({ left: "a", right: undefined, split: true, focused: "right" })
  })

  it("右侧新建会话：已分屏且聚焦右侧时，替换的仍是右侧，不动左侧", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), "b")

    expect(newOnRight(state)).toMatchObject({ left: "a", right: undefined, focused: "right" })
    expect(newOnRight(openInFocused(emptySplit, "a"))).toMatchObject({
      left: "a",
      right: undefined,
      split: true,
      focused: "right",
    })
  })

  it("比例限制在两侧都能放下的范围内", () => {
    expect(setRatio(emptySplit, 0.05).ratio).toBe(0.2)
    expect(setRatio(emptySplit, 0.95).ratio).toBe(0.8)
  })

  it("按主区宽度限制比例，两侧对话都不低于 480px", () => {
    expect(setRatio(emptySplit, 0.2, 1200).ratio).toBe(0.4)
    expect(setRatio(emptySplit, 0.9, 1200).ratio).toBe(0.6)
  })

  it("持久化往返，损坏的存档回落到未分屏", () => {
    const state = openToSide(openInFocused(emptySplit, "a"), "b")

    expect(parseSplit(serializeSplit(state))).toEqual(state)
    expect(parseSplit("{bad")).toEqual(emptySplit)
    expect(parseSplit(JSON.stringify({ split: true, focused: "up" }))).toEqual(emptySplit)
  })

  it("主区放不下两侧各 480px 时不能并排", () => {
    expect(fitsSplit(959)).toBe(false)
    expect(fitsSplit(960)).toBe(true)
  })
})

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
      () => undefined,
    )

    expect([...view.backgroundRunningIds.value].sort()).toEqual(["a", "z"])
    expect(view.shownIds.value).toEqual(["b", "a"])
  })
})
