import { describe, expect, it } from "vitest"

import { useTaskStopping } from "@features/session-rail/hooks/use-task-stopping.js"

describe("停止任务：请求在飞时按钮置灰，失败后能再点", () => {
  it("请求成功：一直置灰，等任务自己结束", async () => {
    const { stopping, stopTask } = useTaskStopping(async () => undefined)

    await stopTask("t")

    expect(stopping.value.has("t")).toBe(true)
  })

  it("请求失败：不再置灰", async () => {
    const { stopping, stopTask } = useTaskStopping(async () => {
      throw new Error("网关拒绝")
    })
    const pending = stopTask("t")

    expect(stopping.value.has("t")).toBe(true)
    await pending
    expect(stopping.value.has("t")).toBe(false)
  })
})
