import { afterEach, describe, expect, it, vi } from "vitest"
import { effectScope, nextTick, ref } from "vue"
import type { SessionCard } from "@/types/session-type.js"

const { listSessionCardsMock } = vi.hoisted(() => ({
  listSessionCardsMock: vi.fn(async (): Promise<SessionCard[]> => []),
}))

vi.mock("@client/platform.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@client/platform.js")>()
  return { ...actual, listSessionCards: listSessionCardsMock }
})

import { useSessionCards } from "@features/session-nav/hooks/use-session-cards.js"

describe("useSessionCards", () => {
  afterEach(() => {
    listSessionCardsMock.mockReset()
    listSessionCardsMock.mockResolvedValue([])
  })

  it("连上后全量拉一次；未连接不打", async () => {
    const connected = ref(false)
    const scope = effectScope()
    scope.run(() => {
      useSessionCards(connected)
    })
    await nextTick()
    expect(listSessionCardsMock).not.toHaveBeenCalled()

    connected.value = true
    await nextTick()
    expect(listSessionCardsMock).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it("卡片按 id 建表，只留条数、模型和结果", async () => {
    listSessionCardsMock.mockResolvedValue([
      {
        id: "s1",
        messageCount: 5,
        model: { provider: "anthropic", id: "claude" },
        outcome: "error",
      },
      { id: "s2", messageCount: 1 },
    ])
    const scope = effectScope()
    const cards = scope.run(() => useSessionCards(ref(true)))!

    await vi.waitFor(() => expect(cards.sessionCards.value.size).toBe(2))

    expect(cards.sessionCards.value.get("s1")).toEqual({
      messageCount: 5,
      model: { provider: "anthropic", id: "claude" },
      outcome: "error",
    })
    expect(cards.sessionCards.value.get("s2")).toEqual({ messageCount: 1 })
    expect(cards.sessionCards.value.get("s1")).not.toHaveProperty("id")
    scope.stop()
  })

  it("失败路径：卡片拉取失败不抛、表保持空", async () => {
    listSessionCardsMock.mockRejectedValue(new Error("boom"))
    const scope = effectScope()
    const cards = scope.run(() => useSessionCards(ref(true)))!

    await vi.waitFor(() => expect(listSessionCardsMock).toHaveBeenCalledTimes(1))
    await nextTick()

    expect(cards.sessionCards.value.size).toBe(0)
    scope.stop()
  })
})
