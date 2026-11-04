import { describe, expect, it } from "vitest"
import { formatElapsed } from "@features/session-nav/lib/format.js"

describe("formatElapsed", () => {
  it("不足一分钟按秒，不足一小时按分，再往上按小时加分", () => {
    expect(formatElapsed(0)).toBe("0s")
    expect(formatElapsed(12_400)).toBe("12s")
    expect(formatElapsed(59_999)).toBe("59s")
    expect(formatElapsed(60_000)).toBe("1m")
    expect(formatElapsed(59 * 60_000)).toBe("59m")
    expect(formatElapsed(65 * 60_000)).toBe("1h 5m")
  })

  it("负数与非有限值归零", () => {
    expect(formatElapsed(-1)).toBe("0s")
    expect(formatElapsed(Number.NaN)).toBe("0s")
  })
})
