import { describe, expect, it } from "vitest"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import {
  buildTimelineRows,
  isToolRow,
  thoughtStepLabel,
  toolRowLabel,
} from "@features/transcript-view/lib/transcript-rows.js"
import { toolSummary } from "@features/transcript-view/lib/tool-summary.js"

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
function tool(
  id: string,
  name = "read",
  status: "complete" | "running" | "error" = "complete",
): ToolTranscriptItem {
  const base = {
    id,
    role: "tool",
    timestamp: 2000,
    toolCallId: id,
    toolName: name,
    input: {},
    content: [],
  } as const
  if (status === "running") return { ...base, content: [], status, isError: false }
  if (status === "error") return { ...base, content: [], status, isError: true }
  return { ...base, content: [], status, isError: false }
}

describe("一轮工作 → 执行过程与最终回答", () => {
  it("历史替换流式 id 时保留展示身份，同毫秒消息互不覆盖，连续文本块保持完整", () => {
    const first = assistant(1, [{ type: "thinking", thinking: "分析" }])
    const second = {
      ...assistant(2, [
        { type: "text", text: "完整" },
        { type: "text", text: "回答" },
      ]),
      timestamp: first.timestamp,
    }
    const messages = [
      user,
      first,
      second,
      { ...user, id: "u2" },
      { ...first, id: "a3" },
      tool("t1"),
    ]
    const rows = buildTimelineRows(messages, true)
    const ids = rows.flatMap((row) =>
      isToolRow(row) ? [row.id, ...row.steps.map((step) => step.id)] : [row.id],
    )
    expect(new Set(ids).size).toBe(ids.length)
    expect(rows.filter((row) => row.role === "assistant")).toMatchObject([{ text: "完整回答" }])
    const persisted = messages.map((item) =>
      item.role === "tool" ? item : { ...item, id: `persisted-${item.id}` },
    )
    expect(
      buildTimelineRows(persisted, true)
        .filter(isToolRow)
        .map((row) => [row.id, row.steps.map((step) => step.id)]),
    ).toEqual(rows.filter(isToolRow).map((row) => [row.id, row.steps.map((step) => step.id)]))
  })
  it("普通回答不增加过程壳，空闲空会话不占行", () => {
    expect(buildTimelineRows([], false)).toEqual([])
    expect(buildTimelineRows([user, text(1, "答")], false)).toMatchObject([
      { role: "user", text: "问" },
      { role: "assistant", text: "答" },
    ])
  })

  it("每段助手正文切开工具过程，当前等待态独立留在末尾", () => {
    const waiting = buildTimelineRows([user], true).find(isToolRow)
    const messages = [
      user,
      text(1, "先读取"),
      tool("t1"),
      text(2, "继续"),
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
      "tools",
    ])
    expect(live.filter(isToolRow).map((row) => row.mode)).toEqual(["fold", "fold", "live"])
    expect(live.filter(isToolRow).at(-1)).toMatchObject({ waiting: true, steps: [] })
    const done = buildTimelineRows(messages, false)
    expect(done.map((row) => row.role)).toEqual([
      "user",
      "assistant",
      "tools",
      "assistant",
      "tools",
      "assistant",
    ])
    expect(done.at(-1)).toMatchObject({ text: "结论" })
    expect(waiting).toMatchObject({ mode: "live", waiting: true })
  })

  it("同段工具统一进一行但每次调用保持独立，助手正文切开两行", () => {
    const rows = buildTimelineRows(
      [
        user,
        tool("t1"),
        tool("t2"),
        text(1, "继续"),
        tool("t3"),
        tool("t4", "extension-a"),
        tool("t5", "extension-b"),
      ],
      true,
    )
    const work = rows.filter(isToolRow)
    expect(rows.map((row) => row.role)).toEqual(["user", "tools", "assistant", "tools"])
    expect(
      work.map((row) =>
        row.steps.map((step) =>
          step.type === "tools" ? step.items.map((item) => item.id) : step.type,
        ),
      ),
    ).toEqual([
      [["t1"], ["t2"]],
      [["t3"], ["t4"], ["t5"]],
    ])
    expect(work[0] && toolRowLabel(work[0])).toBe("读2次文件")
  })

  it("思考按内容块顺序展示，正文开始时结束思考预览", () => {
    const thinking = assistant(1, [{ type: "thinking", thinking: "逐步分析" }], "streaming")
    expect(buildTimelineRows([user, thinking], true).find(isToolRow)?.steps[0]).toMatchObject({
      type: "thought",
      streaming: true,
      startedAt: thinking.timestamp,
    })
    const withText = assistant(
      1,
      [...thinking.content, { type: "text", text: "开始读取" }],
      "streaming",
    )
    const rows = buildTimelineRows([user, withText, tool("t1", "read", "running")], true)
    const work = rows.filter(isToolRow)
    expect(rows.map((row) => row.role)).toEqual(["user", "tools", "assistant", "tools"])
    expect(work.map((row) => row.steps.map((step) => step.type))).toEqual([["thought"], ["tools"]])
    expect(work[0]?.steps[0]).toMatchObject({ streaming: false, endedAt: 2000 })
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

  it("历史与当前轮次分开，摘要按各自工具段统计", () => {
    const nextUser = { ...user, id: "u2", timestamp: 9000 }
    const rows = buildTimelineRows(
      [user, tool("t1"), text(1, "完成"), nextUser, tool("t2", "bash", "running")],
      true,
      [
        { userId: "u1", startedAt: 1000, endedAt: 66000, outcome: "complete" },
        { userId: "u2", startedAt: 9000, outcome: "running" },
      ],
    )
    const work = rows.filter(isToolRow)
    expect(work.map((row) => row.mode)).toEqual(["fold", "live"])
    expect(work[0] && toolRowLabel(work[0], 999999)).toBe("读1次文件")
    expect(work[1] && toolRowLabel(work[1], 12000)).toBe("运行1条命令")
  })

  it("失败路径：工具失败单列，行摘要汇总工作，重试错误信息不丢失", () => {
    const work = buildTimelineRows(
      [user, tool("t1"), tool("bad", "read", "error"), tool("t2")],
      false,
      [{ userId: "u1", startedAt: 1000, endedAt: 27000, outcome: "error" }],
    ).find(isToolRow)
    expect(work?.steps).toHaveLength(3)
    expect(work && toolRowLabel(work)).toBe("读3次文件")
    const failedGroup = work?.steps.find(
      (step) => step.type === "tools" && step.items.some((item) => item.isError),
    )
    expect(failedGroup?.type === "tools" && toolSummary(failedGroup.items)).toBe("已读取 1 个文件")
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
    expect(work && toolRowLabel(work)).toBe("已停止 · 思考 1轮 · 运行1条命令")
    expect(work?.steps[0]).toMatchObject({ type: "tools", items: [{ running: false }] })
    expect(work?.steps[1]).toMatchObject({ type: "thought", streaming: false })
    expect(rows.at(-1)).toMatchObject({ aborted: true })
  })

  it("失败路径：进程退出留下的开始记录仍显示实际工作摘要", () => {
    const work = buildTimelineRows([user, tool("t1")], false, [
      { userId: "u1", startedAt: 1000, outcome: "running" },
    ]).find(isToolRow)
    expect(work && toolRowLabel(work, 999999)).toBe("读1次文件")
  })

  it("思考与多类工具按参考样式汇总为一个标题", () => {
    const thinking = assistant(1, [
      { type: "thinking", thinking: "先分析" },
      { type: "thinking", thinking: "再确认" },
    ])
    const work = buildTimelineRows(
      [user, thinking, tool("r1"), tool("s1", "grep"), tool("s2", "find")],
      false,
    ).find(isToolRow)

    expect(work && toolRowLabel(work)).toBe("思考 2轮 · 读1次文件、搜2次")
  })

  it("同一内容流里的助手正文也会切开前后思考", () => {
    const rows = buildTimelineRows(
      [
        user,
        assistant(1, [
          { type: "thinking", thinking: "前置思考" },
          { type: "text", text: "阶段结论" },
          { type: "thinking", thinking: "后置思考" },
        ]),
      ],
      false,
    )

    expect(rows.map((row) => row.role)).toEqual(["user", "tools", "assistant", "tools"])
    expect(rows.filter(isToolRow).map((row) => toolRowLabel(row))).toEqual(["思考 1轮", "思考 1轮"])
  })
})
