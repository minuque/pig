import { describe, expect, it, vi } from "vitest"
import { effectScope, nextTick, shallowRef } from "vue"
import { useRevealNewSessions } from "@features/session-nav/hooks/use-reveal-new-sessions.js"
import type { SidebarPlacement } from "@features/session-nav/type.js"

function setup() {
  const listed = shallowRef<{ id: string }[]>([])
  const placements = shallowRef(new Map<string, SidebarPlacement>())
  const expand = vi.fn()
  effectScope().run(() => useRevealNewSessions(listed, placements, expand))
  return { listed, placements, expand }
}

describe("新建会话落进收着的分段时自动展开", () => {
  it("新会话出现时已经在跑：同一次更新里展开「工作中」", async () => {
    const { listed, placements, expand } = setup()
    listed.value = []
    await nextTick()

    listed.value = [{ id: "a" }]
    placements.value = new Map([["a", { running: true, settled: false }]])
    await nextTick()

    expect(expand).toHaveBeenCalledWith("working")
  })

  it("新会话先出现、之后才在跑：在跑时展开「工作中」", async () => {
    const { listed, placements, expand } = setup()
    listed.value = []
    await nextTick()

    listed.value = [{ id: "a" }]
    await nextTick()
    expect(expand).not.toHaveBeenCalled()

    placements.value = new Map([["a", { running: true, settled: false }]])
    await nextTick()
    expect(expand).toHaveBeenCalledWith("working")
  })
})
