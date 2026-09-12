import { describe, expect, it } from "vitest"
import { shouldHydrateHeavy } from "@features/transcript-view/lib/transcript-hydrate.js"

describe("shouldHydrateHeavy", () => {
  it("流式立刻画，历史等进视口且滚动停下", () => {
    expect(shouldHydrateHeavy(true, false, false)).toBe(true)
    expect(shouldHydrateHeavy(false, true, true)).toBe(true)
    expect(shouldHydrateHeavy(false, true, false)).toBe(false)
    expect(shouldHydrateHeavy(false, false, true)).toBe(false)
  })
})
