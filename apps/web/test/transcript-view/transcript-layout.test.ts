import { describe, expect, it } from "vitest"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import {
  buildTimelineRows,
  isToolRow,
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

  it("等待、工具运行、正文流式阶段复用同一过程，结束才把末次工具后的正文移出", () => {
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
    expect(live.map((row) => row.role)).toEqual(["user", "tools"])
    expect(live.find(isToolRow)).toMatchObject({ id: waiting?.id, mode: "live" })
    const done = buildTimelineRows(messages, false)
    expect(done.map((row) => row.role)).toEqual(["user", "tools", "assistant"])
    const work = done.find(isToolRow)
    expect(work?.steps.map((step) => step.type)).toEqual([
      "assistant",
      "tools",
      "assistant",
      "tools",
    ])
    expect(work).toMatchObject({ id: waiting?.id, mode: "fold" })
    expect(done.at(-1)).toMatchObject({ text: "结论" })
    expect(work && toolRowLabel(work)).toBe("执行过程")
  })

  it("工具按相邻种类合并，正文和不同未知工具断开分组", () => {
    const work = buildTimelineRows(
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
    ).find(isToolRow)
    expect(
      work?.steps.map((step) =>
        step.type === "tools" ? step.items.map((item) => item.id) : step.type,
      ),
    ).toEqual([["t1", "t2"], "assistant", ["t3"], ["t4"], ["t5"]])
  })

  it("思考按内容块顺序展示，正文开始时结束思考预览", () => {
    const thinking = assistant(1, [{ type: "thinking", thinking: "逐步分析" }], "streaming")
    expect(buildTimelineRows([user, thinking], true).find(isToolRow)?.steps[0]).toMatchObject({
      type: "thought",
      streaming: true,
    })
    const withText = assistant(
      1,
      [...thinking.content, { type: "text", text: "开始读取" }],
      "streaming",
    )
    const work = buildTimelineRows([user, withText, tool("t1", "read", "running")], true).find(
      isToolRow,
    )
    expect(work?.steps.map((step) => step.type)).toEqual(["thought", "assistant", "tools"])
    expect(work?.steps[0]).toMatchObject({ streaming: false })
  })

  it("历史与当前轮次分开，真实耗时不受刷新或展示时刻影响", () => {
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
    expect(work[0] && toolRowLabel(work[0], 999999)).toBe("用时 1分钟 5秒")
    expect(work[1] && toolRowLabel(work[1], 12000)).toBe("执行中 · 用时 3秒")
  })

  it("失败路径：工具失败单列，摘要只描述工作与耗时，重试错误信息不丢失", () => {
    const work = buildTimelineRows(
      [user, tool("t1"), tool("bad", "read", "error"), tool("t2")],
      false,
      [{ userId: "u1", startedAt: 1000, endedAt: 27000, outcome: "error" }],
    ).find(isToolRow)
    expect(work?.steps).toHaveLength(3)
    expect(work && toolRowLabel(work)).toBe("用时 26秒")
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
    expect(work && toolRowLabel(work)).toBe("已停止")
    expect(work?.steps[0]).toMatchObject({ type: "tools", items: [{ running: false }] })
    expect(work?.steps[1]).toMatchObject({ type: "thought", streaming: false })
    expect(rows.at(-1)).toMatchObject({ aborted: true })
  })

  it("失败路径：进程退出留下的开始记录不推算成历史耗时", () => {
    const work = buildTimelineRows([user, tool("t1")], false, [
      { userId: "u1", startedAt: 1000, outcome: "running" },
    ]).find(isToolRow)
    expect(work && toolRowLabel(work, 999999)).toBe("执行过程")
  })
})
