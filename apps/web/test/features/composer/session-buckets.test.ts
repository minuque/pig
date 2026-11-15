import { describe, expect, it } from "vitest"
import {
  createSharedBuckets,
  useSessionBuckets,
} from "@features/composer/hooks/use-session-buckets.js"

function twoSides() {
  const store = createSharedBuckets()
  const side = () => useSessionBuckets(() => ({ items: [] as string[] }), undefined, "queue", store)
  return { left: side(), right: side() }
}

describe("两侧共用的按会话暂存", () => {
  it("两侧都在新会话页时各用各的暂存", () => {
    const { left, right } = twoSides()

    left.current().items.push("左侧附件")

    expect(right.current().items).toEqual([])
  })

  it("新会话页的暂存交给新会话后，另一侧打开这个会话也拿得到", () => {
    const { left, right } = twoSides()

    left.current().items.push("待发")
    left.handOff("s1")
    right.setKey("s1")

    expect(right.current().items).toEqual(["待发"])
    expect(left.forKey(undefined).items).toEqual([])
  })
})
