import { describe, expect, it } from "vitest"
import { effectScope, shallowRef } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { useSessionMarkers } from "@features/session-nav/hooks/use-session-markers.js"

const meta = (id: string, updatedAt: number) =>
  ({ id, cwd: "/w", createdAt: 1, updatedAt }) as unknown as SessionMetadata

describe("单会话未读标记", () => {
  it("当前打开的会话算已读，未打开的会话更新后出现未读点", () => {
    const later = Date.now() + 60_000
    const sessions = shallowRef([meta("a", later), meta("b", later)])
    const scope = effectScope()
    const markers = scope.run(() => useSessionMarkers(sessions, () => "a"))!

    sessions.value = [meta("a", later + 1), meta("b", later + 1)]

    expect(markers.isUnread(sessions.value[0]!)).toBe(false)
    expect(markers.isUnread(sessions.value[1]!)).toBe(true)
    scope.stop()
  })
})
