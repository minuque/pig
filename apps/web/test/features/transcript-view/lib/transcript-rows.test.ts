import { describe, expect, it } from "vitest"
import { formatContextReference, projectContextForAgent, sessionReference } from "@pig/protocol"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import type { TurnTiming } from "@/types/common-type.js"
import {
  createTimelineRowsBuilder,
  isToolRow,
  reuseTimelineRows,
} from "@features/transcript-view/lib/transcript-rows.js"
import { thoughtStepLabel } from "@features/transcript-view/lib/transcript-row-label.js"

const user: UserTranscriptItem = {
  id: "u1",
  role: "user",
  timestamp: 1000,
  content: [{ type: "text", text: "问" }],
}

function buildRows(
  items: readonly TranscriptItem[],
  running: boolean,
  timings: readonly TurnTiming[] = [],
) {
  return createTimelineRowsBuilder().build(items, running, timings)
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
    expect(buildRows([], false)).toEqual([])
    expect(buildRows([user, text(1, "答")], false)).toMatchObject([
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
    const live = buildRows(messages, true)
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
    const done = buildRows(messages, false)
    expect(done.filter((row) => row.role === "assistant").map((row) => row.showTimestamp)).toEqual([
      undefined,
      undefined,
      true,
    ])

    const descriptors = assistant(1, [call("t1"), call("t2")])
    const first = buildRows([user, descriptors], true)
    const initialRow = first.find(isToolRow)
    expect(initialRow).toMatchObject({ mode: "live", turnStreaming: true })
    expect(
      initialRow?.steps.flatMap((step) => (step.type === "tools" ? step.items : [])),
    ).toMatchObject([
      { id: "t1", running: true, outputText: "" },
      { id: "t2", running: true, outputText: "" },
    ])

    const afterResult = buildRows(
      [user, descriptors, text(2, "阶段结果"), tool("t2", "read", "complete", "第二项")],
      true,
    )

    expect(afterResult.map((row) => row.role)).toEqual(["user", "tools", "assistant"])
    expect(afterResult.find(isToolRow)?.id).toBe(initialRow?.id)
  })

  it("完成的思考使用持久 Turn 结束时间计算耗时", () => {
    const thinking = assistant(1, [{ type: "thinking", thinking: "逐步分析" }])
    const work = buildRows([user, thinking], false, [
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

  it("工具耗时取 running 占位记下的开始时刻，不把生成时间算进去", () => {
    const descriptors = assistant(1, [call("t1")])
    const running = { ...tool("t1", "read", "running"), timestamp: 5000, startedAt: 5000 }
    const live = buildRows([user, descriptors, running as TranscriptItem], true).find(isToolRow)
    const liveItem = live?.steps.flatMap((step) => (step.type === "tools" ? step.items : []))[0]

    expect(liveItem).toMatchObject({ startedAt: 5000 })

    const done = { ...tool("t1"), timestamp: 5300, startedAt: 5000 }
    const finished = buildRows([user, descriptors, done as TranscriptItem], false).find(isToolRow)
    const finishedItem = finished?.steps.flatMap((step) =>
      step.type === "tools" ? step.items : [],
    )[0]

    expect(finishedItem).toMatchObject({ startedAt: 5000, endedAt: 5300 })
  })

  it("失败路径：工具失败单列，重试全失败留一条带次数的报错", () => {
    const work = buildRows([user, tool("t1"), tool("bad", "read", "error"), tool("t2")], false, [
      { userId: "u1", startedAt: 1000, endedAt: 27000, outcome: "error" },
    ]).find(isToolRow)

    expect(work?.steps).toHaveLength(3)

    const errors = buildRows([user, assistant(1, [], "error"), assistant(2, [], "error")], false)

    expect(errors.at(-1)).toMatchObject({
      role: "alert",
      source: "request",
      retries: 1,
      message: "请求超时",
    })
  })

  it("重试后恢复：失败收成一条可展开的恢复记录，回答照常显示，不留报错", () => {
    const rows = buildRows([user, assistant(1, [], "error"), text(2, "好了")], false)

    expect(rows.map((row) => row.role)).toEqual(["user", "event", "assistant"])
    expect(rows[1]).toMatchObject({
      parts: [{ kind: "retry_recovered", attempts: [{ errorMessage: "请求超时" }] }],
    })
  })

  it("重试中途夹带扩展通知或事件时，最终成功恢复仍收为恢复记录而不是红卡报错", () => {
    const notice = {
      id: "n1",
      role: "system",
      event: { kind: "extension_notice", level: "warning", message: "正在重试" },
      timestamp: 1500,
    } as const
    const rows = buildRows([user, assistant(1, [], "error"), notice, text(2, "好了")], false)

    expect(rows.some((row) => row.role === "alert" && row.source === "request")).toBe(false)
    expect(
      rows.some((row) => row.role === "event" && row.parts[0]?.kind === "retry_recovered"),
    ).toBe(true)
    expect(rows.at(-1)).toMatchObject({ role: "assistant", text: "好了" })
  })

  it("两次发送之间来回切换模型不留记录，真正的切换与压缩合成一条", () => {
    const sonnet = { provider: "anthropic", id: "sonnet" }
    const gpt = { provider: "openai", id: "gpt-5" }
    const system = (id: string, event: Extract<TranscriptItem, { role: "system" }>["event"]) =>
      ({ id, role: "system", event, timestamp: 1100 }) as const
    const rows = buildRows(
      [
        user,
        text(1, "答"),
        system("m1", { kind: "model_change", previous: sonnet, model: gpt }),
        system("m2", { kind: "model_change", previous: gpt, model: sonnet }),
        system("m3", { kind: "model_change", previous: sonnet, model: gpt }),
        system("c1", { kind: "compaction", tokensBefore: 1000, summary: "摘要" }),
      ],
      false,
    )

    expect(rows.at(-1)).toMatchObject({
      role: "event",
      parts: [
        { kind: "model", from: { model: sonnet }, to: { model: gpt } },
        { kind: "compaction" },
      ],
    })
    expect(rows.filter((row) => row.role === "event")).toHaveLength(1)
  })

  it("失败路径：中止后显示已停止，残留工具与思考不再显示运行态", () => {
    const rows = buildRows(
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
    expect(rows.at(-1)).toMatchObject({ role: "event", parts: [{ kind: "aborted" }] })
  })

  it("用户行解析上下文引用供气泡渲染，助手 entryId 替换后不复用旧行", () => {
    const ref = sessionReference("s-ref", "设计讨论")
    const refUser: UserTranscriptItem = {
      id: "u-ref",
      role: "user",
      timestamp: 1000,
      content: [
        { type: "text", text: projectContextForAgent(`看 ${formatContextReference(ref)}`) },
      ],
    }
    const previous = buildRows([refUser, { ...text(1, "答"), id: "m1" }], false)

    expect(previous[0]).toMatchObject({
      role: "user",
      parts: [
        { kind: "text", text: "看 " },
        { kind: "reference", reference: ref },
      ],
    })

    const next = buildRows([refUser, { ...text(1, "答"), id: "entry-1" }], false)
    const reused = reuseTimelineRows(previous, next)

    expect(reused[0]).toBe(previous[0])
    expect(reused[1]).not.toBe(previous[1])
    expect(reused[1]).toMatchObject({ role: "assistant", entryId: "entry-1" })
  })
})
