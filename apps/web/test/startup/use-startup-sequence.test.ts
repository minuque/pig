import { beforeEach, describe, expect, it, vi } from "vitest"

const replace = vi.fn(async () => undefined)
const currentRoute = { value: { name: undefined as string | undefined } }

vi.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute, replace }),
}))

import { setStartupError, useStartupError } from "@features/startup/hooks/use-startup-error.js"
import { useStartupSequence } from "@features/startup/hooks/use-startup-sequence.js"

describe("startup sequence", () => {
  beforeEach(() => {
    setStartupError("")
    currentRoute.value = { name: undefined }
    replace.mockClear()
  })

  it("connect 后 initialize；从 /error 成功启动则回到 /", async () => {
    currentRoute.value = { name: "error" }
    const order: string[] = []
    const { start, ready, visible, settled } = useStartupSequence({
      connect: async () => {
        order.push("connect")
      },
      initialize: async () => {
        order.push("initialize")
      },
      connectTimeoutMs: 0,
    })
    await start()
    expect(order).toEqual(["connect", "initialize"])
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
    expect(useStartupError().value).toBe("请求失败。请检查本地服务后重试。")
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
    expect(replace).toHaveBeenCalledWith({ name: "error" })
  })
})
