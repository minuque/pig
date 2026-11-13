import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@/types/common-type.js"
import { latestToolTasks, toolTasks } from "@features/transcript-view/lib/tool-tasks.js"

const task = (id: string, status = "running") => ({
  id,
  kind: "agent",
  description: "scout",
  prompt: "摸清协议层",
  status,
  steps: ["read a.ts"],
  tokens: 12,
})
const tool = (id: string, toolName: string, details: unknown) =>
  ({ id, role: "tool", toolCallId: id, toolName, details }) as unknown as TranscriptItem

describe("工具结果里的任务：只认形状，不认工具名", () => {
  it("任何工具的 details.tasks 都读得出来", () => {
    expect(toolTasks({ tasks: [task("agent:1:0")] })).toEqual([task("agent:1:0")])
  })

  it("形状不对的条目丢掉，不抛错", () => {
    const details = { tasks: [task("agent:1:0"), { id: "x" }, task("agent:1:1", "done"), null] }

    expect(toolTasks(details).map((item) => item.id)).toEqual(["agent:1:0"])
    expect(toolTasks({ results: [task("old")] })).toEqual([])
    expect(toolTasks(undefined)).toEqual([])
  })

  it("摘要面板取最近一次带任务的工具调用，跳过没有任务的工具", () => {
    const transcript = [
      tool("a", "subagent", { tasks: [task("agent:a:0", "completed")] }),
      tool("b", "anything", { tasks: [task("agent:b:0")] }),
      tool("c", "bash", { exitCode: 0 }),
    ]

    expect(latestToolTasks(transcript).map((item) => item.id)).toEqual(["agent:b:0"])
  })
})
