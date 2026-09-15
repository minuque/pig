import { describe, expect, it } from "vitest"
import {
  SESSION_VIEW_CACHE,
  createSessionHistoryCache,
} from "@features/session-workbench/lib/session-history-cache.js"
import type { TranscriptItem } from "@/types/common-type.js"

const item = (id: string): TranscriptItem =>
  ({ id, role: "user", content: [{ type: "text", text: id }], timestamp: 1 }) as TranscriptItem

describe("session history cache", () => {
  it("切走不清掉，超出份数才丢掉最久未碰的", () => {
    expect(SESSION_VIEW_CACHE).toBe(5)
    const cache = createSessionHistoryCache(5)

    for (let index = 1; index <= 5; index += 1) {
      cache.write(`s${index}`, { items: [item(`u${index}`)], ready: true })
    }

    expect(cache.isReady("s1")).toBe(true)
    expect(cache.peek("s1")?.items[0]?.id).toBe("u1")
    cache.write("s6", { items: [item("u6")], ready: true })
    expect(cache.peek("s1")).toBeUndefined()
    expect(cache.isReady("s2")).toBe(true)
    expect(cache.peek("s6")?.items[0]?.id).toBe("u6")
    cache.touch("s2")
    cache.write("s7", { items: [item("u7")], ready: true })
    expect(cache.peek("s2")).toBeDefined()
    expect(cache.peek("s3")).toBeUndefined()
  })
})
