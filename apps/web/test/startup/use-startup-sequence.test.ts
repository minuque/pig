import { beforeEach, describe, expect, it, vi } from "vitest"

const replace = vi.fn(async () => undefined)
const currentRoute = {
  value: { name: undefined as string | undefined, params: {} as Record<string, unknown> },
}

vi.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute, replace }),
}))

import { setStartupError, useStartupError } from "@features/startup/hooks/use-startup-error.js"
import { useStartupSequence } from "@features/startup/hooks/use-startup-sequence.js"

describe("startup sequence", () => {
  beforeEach(() => {
    setStartupError("")
    currentRoute.value = { name: undefined, params: {} }
    replace.mockClear()
  })

  it("connect 与 initialize 并行；从 /error 成功启动则回到 /", async () => {
    currentRoute.value = { name: "error", params: {} }
    let inFlight = 0
    let overlapped = false
    const { start, ready, visible, settled } = useStartupSequence({
      connect: async () => {
        inFlight += 1
        if (inFlight > 1) overlapped = true
        await new Promise((resolve) => {
          setTimeout(resolve, 20)
        })
        inFlight -= 1
      },
      initialize: async () => {
        inFlight += 1
        if (inFlight > 1) overlapped = true
        await new Promise((resolve) => {
          setTimeout(resolve, 20)
        })
        inFlight -= 1
      },
      connectTimeoutMs: 0,
    })
    await start()
    expect(overlapped).toBe(true)
    expect(ready.value).toBe(true)
    expect(settled.value).toBe(true)
    expect(visible.value).toBe(true)
    expect(replace).toHaveBeenCalledWith("/")
  })

  it("失败路径：connect 抛错或超时都进 /error，不拆 overlay", async () => {
    const thrown = useStartupSequence({
      connect: async () => {
        throw new Error("连接失败")
      },
      initialize: async () => undefined,
      connectTimeoutMs: 0,
    })
    await thrown.start()
    expect(thrown.ready.value).toBe(false)
    expect(thrown.failed.value).toBe(true)
    expect(thrown.settled.value).toBe(true)
    expect(thrown.visible.value).toBe(true)
    expect(useStartupError().value).toBe("连接失败")
    expect(replace).toHaveBeenCalledWith({ name: "error" })

    replace.mockClear()
    setStartupError("")
    const hung = useStartupSequence({
      connect: () => new Promise(() => {}),
      initialize: async () => undefined,
      connectTimeoutMs: 20,
    })
    await hung.start()
    expect(hung.failed.value).toBe(true)
    expect(hung.visible.value).toBe(true)
    expect(useStartupError().value).toBe("连接网关超时")
    expect(replace).toHaveBeenCalledWith({ name: "error" })
  })

  it("欢迎页 initialize 先完成不揭开遮罩", async () => {
    let releaseConnect = () => {}
    const connecting = new Promise<void>((resolve) => {
      releaseConnect = resolve
    })
    let initializeDone = false
    const seq = useStartupSequence({
      connect: () => connecting,
      initialize: async () => {
        initializeDone = true
      },
      connectTimeoutMs: 0,
    })
    const started = seq.start()
    await vi.waitFor(() => expect(initializeDone).toBe(true))
    expect(seq.settled.value).toBe(false)
    expect(seq.ready.value).toBe(false)
    releaseConnect()
    await started
    expect(seq.settled.value).toBe(true)
    expect(seq.ready.value).toBe(true)
  })

  it("有 sessionId 时 initialize 完成即可揭开遮罩", async () => {
    currentRoute.value = { name: "session", params: { sessionId: "s1" } }
    let releaseConnect = () => {}
    const connecting = new Promise<void>((resolve) => {
      releaseConnect = resolve
    })
    const seq = useStartupSequence({
      connect: () => connecting,
      initialize: async () => undefined,
      connectTimeoutMs: 0,
    })
    const started = seq.start()
    await vi.waitFor(() => expect(seq.settled.value).toBe(true))
    expect(seq.ready.value).toBe(false)
    releaseConnect()
    await started
    expect(seq.ready.value).toBe(true)
  })
})
