import { describe, expect, it } from "vitest"
import {
  moveSessionTab,
  openSessionTab,
  sessionTabAfterClose,
  sessionTabAfterCloseMany,
  sessionTabsInCloseScope,
} from "@features/session-workbench/lib/session-tabs.js"

describe("openSessionTab", () => {
  it("把新会话追加到末尾", () => {
    expect(openSessionTab(["a"], "b")).toEqual(["a", "b"])
  })

  it("已打开的会话保持原位", () => {
    expect(openSessionTab(["a", "b"], "a")).toEqual(["a", "b"])
  })
})

describe("moveSessionTab", () => {
  it("插入到目标标签之前", () => {
    expect(moveSessionTab(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"])
  })

  it("拖到自身时顺序不变", () => {
    expect(moveSessionTab(["a", "b"], "a", "a")).toEqual(["a", "b"])
  })

  it("目标不存在时顺序不变", () => {
    expect(moveSessionTab(["a", "b"], "a", "missing")).toEqual(["a", "b"])
  })

  it("没有目标时落到末尾", () => {
    expect(moveSessionTab(["a", "b", "c"], "a", undefined)).toEqual(["b", "c", "a"])
  })
})

describe("sessionTabAfterClose", () => {
  it("优先落到右侧标签", () => {
    expect(sessionTabAfterClose(["a", "b", "c"], "b")).toBe("c")
  })

  it("没有右侧时落到左侧", () => {
    expect(sessionTabAfterClose(["a", "b"], "b")).toBe("a")
  })

  it("只剩被关的标签时返回空", () => {
    expect(sessionTabAfterClose(["a"], "a")).toBeUndefined()
  })
})

describe("sessionTabAfterCloseMany", () => {
  it("锚点还在时留在锚点", () => {
    expect(sessionTabAfterCloseMany(["a", "b", "c"], ["a", "c"], "b")).toBe("b")
  })

  it("锚点被关时取剩余第一项", () => {
    expect(sessionTabAfterCloseMany(["a", "b", "c"], ["b"], "b")).toBe("a")
  })
})

describe("sessionTabsInCloseScope", () => {
  it("分别给出左侧、右侧和其余", () => {
    expect(sessionTabsInCloseScope(["a", "b", "c"], "b", "left")).toEqual(["a"])
    expect(sessionTabsInCloseScope(["a", "b", "c"], "b", "right")).toEqual(["c"])
    expect(sessionTabsInCloseScope(["a", "b", "c"], "b", "others")).toEqual(["a", "c"])
  })

  it("锚点不在条上时为空", () => {
    expect(sessionTabsInCloseScope(["a"], "missing", "others")).toEqual([])
  })
})
