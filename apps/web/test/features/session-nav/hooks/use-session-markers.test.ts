import { describe, expect, it } from "vitest"
import { effectScope, shallowRef } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { useSessionMarkers } from "@features/session-nav/hooks/use-session-markers.js"

const meta = (id: string, updatedAt: number) =>
  ({ id, cwd: "/w", createdAt: 1, updatedAt }) as unknown as SessionMetadata

describe("分屏时的未读标记", () => {
  it("两侧开着的会话都算已读，更新后也不冒未读点", () => {
    const later = Date.now() + 60_000
    const sessions = shallowRef([meta("a", later), meta("b", later), meta("c", later)])
    const scope = effectScope()
    const markers = scope.run(() => useSessionMarkers(sessions, () => ["a", "b"]))!

    sessions.value = [meta("a", later + 1), meta("b", later + 1), meta("c", later + 1)]

    expect(markers.isUnread(sessions.value[0]!)).toBe(false)
    expect(markers.isUnread(sessions.value[1]!)).toBe(false)
    expect(markers.isUnread(sessions.value[2]!)).toBe(true)
    scope.stop()
  })
})
