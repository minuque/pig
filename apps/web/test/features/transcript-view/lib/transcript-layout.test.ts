import { describe, expect, it } from "vitest"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import {
  buildTimelineRows,
  isToolRow,
  reuseTimelineRows,
  thoughtStepLabel,
  timelineRowKeys,
} from "@features/transcript-view/lib/transcript-rows.js"
import {
  restoreScrollAfterPrepend,
  shouldLoadOlderTranscript,
  transcriptOverflows,
} from "@features/transcript-view/lib/transcript-scroll.js"

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

function manyTurns(count: number) {
  return Array.from({ length: count }, (_, i) => [
    {
      id: `u${i}`,
      role: "user" as const,
      timestamp: 1000 + i * 10,
      content: [{ type: "text" as const, text: `问${i}` }],
    },
    text(200 + i, `答${i}`),
  ]).flat()
}

describe("一轮工作 → 执行过程与最终回答", () => {
  it("普通回答不增加过程壳，空闲空会话不占行", () => {
    expect(buildTimelineRows([], false)).toEqual([])
    expect(buildTimelineRows([user, text(1, "答")], false)).toMatchObject([
      { role: "user", text: "问", timestamp: 1000 },
      { role: "assistant", text: "答", timestamp: 1001, showTimestamp: true },
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
    expect(
      live.filter(isToolRow).map((row) => ({ mode: row.mode, turnStreaming: row.turnStreaming })),
    ).toEqual([
      { mode: "done", turnStreaming: true },
      { mode: "done", turnStreaming: true },
    ])
    expect(live.at(-1)).toMatchObject({ text: "结论" })
    expect(live.filter((row) => row.role === "assistant").map((row) => row.showTimestamp)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    const done = buildTimelineRows(messages, false)
    expect(done.filter((row) => row.role === "assistant").map((row) => row.showTimestamp)).toEqual([
      undefined,
      undefined,
      true,
    ])

    const descriptors = assistant(1, [call("t1"), call("t2")])
    const first = buildTimelineRows([user, descriptors], true)
    const initialRow = first.find(isToolRow)
    expect(initialRow).toMatchObject({ mode: "live", turnStreaming: true })
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

  it("流式正文增量复用未变化的行对象", () => {
    const messages = [user, textAndCalls(1, "先读取", "t1"), tool("t1"), text(2, "结论")]
    const live = buildTimelineRows(messages, true)

    const streamed = reuseTimelineRows(
      live,
      buildTimelineRows([...messages.slice(0, -1), text(2, "结论。")], true),
    )

    expect(streamed[0]).toBe(live[0])
    expect(streamed.find(isToolRow)).toBe(live.find(isToolRow))
    expect(streamed.at(-1)).not.toBe(live.at(-1))
    expect(streamed.at(-1)).toMatchObject({ text: "结论。" })
  })

  it("失败路径：工具输出变化不复用该行", () => {
    const descriptors = assistant(1, [call("t1"), call("t2")])
    const first = buildTimelineRows([user, descriptors], true)
    const initialRow = first.find(isToolRow)

    const afterResult = buildTimelineRows(
      [user, descriptors, text(2, "阶段结果"), tool("t2", "read", "complete", "第二项")],
      true,
    )

    const reused = reuseTimelineRows(first, afterResult)
    expect(reused[0]).toBe(first[0])
    expect(reused.find(isToolRow)).not.toBe(initialRow)
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
    expect(thought?.type === "thought" && thoughtStepLabel(thought)).toBe("思考了 5 秒")
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

    expect(errors.at(-1)).toMatchObject({
      error: true,
      retryCount: 2,
      errorMessage: "请求超时",
      showTimestamp: true,
    })
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
    expect(rows.at(-1)).toMatchObject({ aborted: true, showTimestamp: true })
  })
})

describe("打开已有会话 → 长列表尾部先挂载", () => {
  it("贴底、加载中或未溢出不上翻拉取", () => {
    expect(shouldLoadOlderTranscript(true, false, true, 0)).toBe(false)
    expect(shouldLoadOlderTranscript(true, true, false, 0)).toBe(false)
    expect(shouldLoadOlderTranscript(false, false, false, 0)).toBe(false)
    expect(shouldLoadOlderTranscript(true, false, false, 0, { overflow: false })).toBe(false)
    expect(shouldLoadOlderTranscript(true, false, false, 0)).toBe(true)
    expect(transcriptOverflows(884, 884)).toBe(false)
    expect(transcriptOverflows(1000, 884)).toBe(true)
  })

  it("上翻 prepend 不改已有行 id", () => {
    const all = manyTurns(2)
    const tail = buildTimelineRows(all.slice(-2), false)
    const full = buildTimelineRows(all, false)
    expect(full.map((row) => row.id).slice(-tail.length)).toEqual(tail.map((row) => row.id))
    expect(timelineRowKeys(full).slice(-tail.length)).toEqual(timelineRowKeys(tail))
  })

  it("上翻回填时补偿 scrollTop，视口不跟着跳", () => {
    const root = { scrollTop: 400, scrollHeight: 1000 }
    restoreScrollAfterPrepend(root, 1000, 400)
    expect(root.scrollTop).toBe(400)
    root.scrollHeight = 1300
    restoreScrollAfterPrepend(root, 1000, 400)
    expect(root.scrollTop).toBe(700)
  })
})
