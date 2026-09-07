import { describe, expect, it } from "vitest"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import {
  buildTimelineRows,
  isToolRow,
  thoughtStepLabel,
} from "@features/transcript-view/lib/transcript-rows.js"

const user: UserTranscriptItem = {
  id: "u1",
  role: "user",
  timestamp: 1000,
  content: [{ type: "text", text: "问" }],
}

function assistant(
  id: number,
  content: AssistantTranscriptItem["content"],
  status: "complete" | "streaming" | "error" | "aborted" = "complete",
): AssistantTranscriptItem {
  const base = {
    id: "a" + id,
    role: "assistant",
    timestamp: 1000 + id,
    content,
    model: { provider: "test", id: "test" },
  } as const
  if (status === "streaming") return { ...base, status }
  if (status === "error") return { ...base, status, stopReason: "error", errorMessage: "请求超时" }
  if (status === "aborted") return { ...base, status, stopReason: "aborted" }
  return { ...base, status, stopReason: "stop" }
}

function text(id: number, value: string) {
  return assistant(id, [{ type: "text", text: value }])
}

function call(id: string, name = "read"): AssistantTranscriptItem["content"][number] {
  return { type: "toolCall", toolCallId: id, toolName: name, input: { path: `${id}.ts` } }
}

function textAndCalls(id: number, value: string, ...calls: string[]) {
  return assistant(id, [{ type: "text", text: value }, ...calls.map((value) => call(value))])
}

function tool(
  id: string,
  name = "read",
  status: "complete" | "running" | "error" = "complete",
  output = "",
): ToolTranscriptItem {
  const base = {
    id,
    role: "tool",
    timestamp: 2000,
    toolCallId: id,
    toolName: name,
    input: {},
    content: output ? [{ type: "text" as const, text: output }] : [],
  } as const
  if (status === "running") return { ...base, status, isError: false }
  if (status === "error") return { ...base, status, isError: true }
  return { ...base, status, isError: false }
}

describe("一轮工作 → 执行过程与最终回答", () => {
  it("普通回答不增加过程壳，空闲空会话不占行", () => {
    expect(buildTimelineRows([], false)).toEqual([])
    expect(buildTimelineRows([user, text(1, "答")], false)).toMatchObject([
      { role: "user", text: "问" },
      { role: "assistant", text: "答" },
    ])
  })

  it("每段助手正文切开工具过程，live 骨架按描述顺序原位更新", () => {
    const messages = [
      user,
      textAndCalls(1, "先读取", "t1"),
      tool("t1"),
      textAndCalls(2, "继续", "t2"),
      tool("t2"),
      text(3, "结论"),
    ]
    const live = buildTimelineRows(messages, true)
    expect(live.map((row) => row.role)).toEqual([
      "user",
      "assistant",
      "tools",
      "assistant",
      "tools",
      "assistant",
    ])
    expect(live.at(-1)).toMatchObject({ text: "结论" })

    const descriptors = assistant(1, [call("t1"), call("t2")])
    const first = buildTimelineRows([user, descriptors], true)
    const initialRow = first.find(isToolRow)
    expect(
      initialRow?.steps.flatMap((step) => (step.type === "tools" ? step.items : [])),
    ).toMatchObject([
      { id: "t1", running: true, outputText: "" },
      { id: "t2", running: true, outputText: "" },
    ])
    const afterResult = buildTimelineRows(
      [user, descriptors, text(2, "阶段结果"), tool("t2", "read", "complete", "第二项")],
      true,
    )
    expect(afterResult.map((row) => row.role)).toEqual(["user", "tools", "assistant"])
    expect(afterResult.find(isToolRow)?.id).toBe(initialRow?.id)
  })

  it("完成的思考使用持久 Turn 结束时间计算耗时", () => {
    const thinking = assistant(1, [{ type: "thinking", thinking: "逐步分析" }])
    const work = buildTimelineRows([user, thinking], false, [
      { userId: "u1", startedAt: 500, endedAt: 6001, outcome: "complete" },
    ]).find(isToolRow)

    expect(work?.steps[0]).toMatchObject({
      type: "thought",
      startedAt: 1001,
      endedAt: 6001,
    })
    const thought = work?.steps[0]
    expect(thought?.type === "thought" && thoughtStepLabel(thought)).toBe("思考了 5秒")
  })

  it("失败路径：工具失败单列，重试错误信息不丢失", () => {
    const work = buildTimelineRows(
      [user, tool("t1"), tool("bad", "read", "error"), tool("t2")],
      false,
      [{ userId: "u1", startedAt: 1000, endedAt: 27000, outcome: "error" }],
    ).find(isToolRow)
    expect(work?.steps).toHaveLength(3)
    const errors = buildTimelineRows(
      [user, assistant(1, [], "error"), assistant(2, [], "error")],
      false,
    )
    expect(errors.at(-1)).toMatchObject({ error: true, retryCount: 2, errorMessage: "请求超时" })
  })

  it("失败路径：中止后显示已停止，残留工具与思考不再显示运行态", () => {
    const rows = buildTimelineRows(
      [
        user,
        tool("t1", "bash", "running"),
        assistant(1, [{ type: "thinking", thinking: "半路" }], "aborted"),
      ],
      false,
    )
    const work = rows.find(isToolRow)
    expect(work?.steps[0]).toMatchObject({ type: "tools", items: [{ running: false }] })
    expect(work?.steps[1]).toMatchObject({ type: "thought", streaming: false })
    expect(rows.at(-1)).toMatchObject({ aborted: true })
  })
})
