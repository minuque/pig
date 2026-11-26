import { describe, expect, it } from "vitest"

import { useTaskStopping } from "@features/session-rail/hooks/use-task-stopping.js"
import { visibleSections } from "@features/session-rail/lib/task-list.js"
import type { Task } from "@/types/common-type.js"

const task = (id: string, status: Task["status"]) => ({ id, status }) as Task

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

describe("清除已结束的任务：摘要卡片和任务面板都不再算它们", () => {
  it("全部清除后两段都空，卡片据此收起", () => {
    const sections = visibleSections([task("a", "completed"), task("b", "failed")], ["a", "b"])

    expect([...sections.running, ...sections.finished]).toEqual([])
  })

  it("清除过又跑起来的任务照常显示", () => {
    const sections = visibleSections([task("a", "running"), task("b", "stopped")], ["a", "b"])

    expect(sections.running.map((item) => item.id)).toEqual(["a"])
    expect(sections.finished).toEqual([])
  })
})
