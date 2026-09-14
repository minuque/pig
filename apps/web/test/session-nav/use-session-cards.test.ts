import { afterEach, describe, expect, it, vi } from "vitest"
import { effectScope, nextTick, ref } from "vue"

const { listSessionCardsMock } = vi.hoisted(() => ({
  listSessionCardsMock: vi.fn(async () => []),
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
})
