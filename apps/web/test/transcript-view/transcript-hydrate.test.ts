import { describe, expect, it } from "vitest"
import {
  nextHydrateId,
  shouldHydrateHeavy,
} from "@features/transcript-view/lib/transcript-hydrate.js"

describe("shouldHydrateHeavy", () => {
  it("流式立刻画，历史等进视口且滚动停下", () => {
    expect(shouldHydrateHeavy(true, false, false)).toBe(true)
    expect(shouldHydrateHeavy(false, true, true)).toBe(true)
    expect(shouldHydrateHeavy(false, true, false)).toBe(false)
    expect(shouldHydrateHeavy(false, false, true)).toBe(false)
    expect(shouldHydrateHeavy(false, true, true, true)).toBe(false)
    expect(shouldHydrateHeavy(false, true, true, false, false)).toBe(false)
  })
})

describe("nextHydrateId", () => {
  const rows = [
    { id: "u1", role: "user" },
    { id: "a1", role: "assistant" },
    { id: "a2", role: "assistant", streaming: true },
    { id: "a3", role: "assistant" },
  ]

  it("滚动中不挂；停稳后只取下一条可见未挂的历史助手句", () => {
    const inView = new Set(["a1", "a3"])
    expect(nextHydrateId(rows, new Set(), inView, false)).toBeUndefined()
    expect(nextHydrateId(rows, new Set(), inView, true)).toBe("a1")
    expect(nextHydrateId(rows, new Set(["a1"]), inView, true)).toBe("a3")
    expect(nextHydrateId(rows, new Set(["a1", "a3"]), inView, true)).toBeUndefined()
    expect(nextHydrateId(rows, new Set(), inView, true, true)).toBeUndefined()
    expect(nextHydrateId(rows, new Set(), inView, true, false, false)).toBeUndefined()
  })
})
