import { describe, expect, it } from "vitest"
import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import {
  createActivityLabelDisplay,
  formatOutputTokens,
  turnActivity,
  turnOutputTokens,
} from "@features/transcript-view/lib/transcript-activity.js"
import { createTimelineRowsBuilder } from "@features/transcript-view/lib/transcript-rows.js"
import type { TimelineRow } from "@features/transcript-view/type.js"

const user: UserTranscriptItem = {
  id: "u1",
  role: "user",
  timestamp: 1000,
  content: [{ type: "text", text: "问" }],
}

function assistant(
  id: number,
  content: AssistantTranscriptItem["content"],
  status: "complete" | "streaming" = "complete",
): AssistantTranscriptItem {
  const base = {
    id: "a" + id,
    role: "assistant",
    timestamp: 1000 + id,
    content,
    model: { provider: "test", id: "test" },
  } as const

  if (status === "streaming") return { ...base, status }
  return { ...base, status, stopReason: "stop" }
}

function call(id: string, name = "read"): AssistantTranscriptItem["content"][number] {
  return { type: "toolCall", toolCallId: id, toolName: name, input: {} }
}

function tool(id: string, status: "complete" | "running" = "complete"): ToolTranscriptItem {
  return {
    id,
    role: "tool",
    timestamp: 2000,
    toolCallId: id,
    toolName: "read",
    input: {},
    content: [],
    status,
    isError: false,
  }
}

function buildRows(items: readonly TranscriptItem[], running: boolean): TimelineRow[] {
  return createTimelineRowsBuilder().build(items, running)
}

function activityFor(
  rows: TimelineRow[],
  overrides: Partial<Parameters<typeof turnActivity>[0]> = {},
) {
  return turnActivity({
    rows,
    phase: "turn",
    sending: false,
    stopping: false,
    elapsedSeconds: 0,
    now: 100_000,
    ...overrides,
  })
}

describe("turnActivity", () => {
  it("工具在跑 → statusRunningTools", () => {
    const rows = buildRows([user, assistant(1, [call("t1")])], true)
    const activity = activityFor(rows)
    expect(activity).toMatchObject({ kind: "tools", label: "正在调用工具" })
  })

  it("思考 streaming + 不同 elapsed 阶梯", () => {
    const rows = buildRows(
      [user, assistant(1, [{ type: "thinking", thinking: "想" }], "streaming")],
      true,
    )

    expect(activityFor(rows, { elapsedSeconds: 0 })).toMatchObject({
      kind: "thinking",
      label: "思考中",
    })
    expect(activityFor(rows, { elapsedSeconds: 20 })).toMatchObject({
      kind: "thinking",
      label: "还在思考",
    })
    expect(activityFor(rows, { elapsedSeconds: 35 })).toMatchObject({
      kind: "thinking",
      label: "继续思考中",
    })
    expect(activityFor(rows, { elapsedSeconds: 50 })).toMatchObject({
      kind: "thinking",
      label: "再思考一下",
    })
    expect(activityFor(rows, { elapsedSeconds: 70 })).toMatchObject({
      kind: "thinking",
      label: "马上完成思考",
    })
  })

  it("思考刚结束 → thoughtFor 秒数", () => {
    const thinking = assistant(1, [{ type: "thinking", thinking: "想" }])
    const rows = buildRows([user, thinking, assistant(2, [{ type: "text", text: "答" }])], true)
    const toolRow = rows.find((row) => row.role === "tools")
    const thought = toolRow?.steps.find((step) => step.type === "thought")
    const now = (thought?.type === "thought" ? (thought.endedAt ?? 0) : 0) + 500
    const activity = activityFor(rows, { now })
    expect(activity).toMatchObject({ kind: "thinking" })
    expect(activity?.label).toMatch(/^思考了 \d+ 秒$/)
  })

  it("compaction → compressing", () => {
    const activity = activityFor([], { phase: "compaction" })
    expect(activity).toMatchObject({ kind: "compacting", label: "压缩中" })
  })

  it("sending 且 phase idle → statusSending", () => {
    const activity = activityFor([], { phase: "idle", sending: true })
    expect(activity).toMatchObject({ kind: "tools", label: "发送中" })
  })

  it("stopping 优先返回 null", () => {
    const activity = activityFor([], { phase: "turn", stopping: true })
    expect(activity).toBeNull()
  })
})

describe("turnOutputTokens", () => {
  function assistantWithUsage(id: string, output?: number): AssistantTranscriptItem {
    const base = assistant(Number(id.slice(1)), [{ type: "text", text: "答" }])
    const usage =
      output === undefined
        ? undefined
        : {
            input: 10,
            output,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 10 + output,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          }
    return { ...base, id, usage } as AssistantTranscriptItem
  }

  it("汇总 turn 内多个 assistant 的 usage.output", () => {
    const items: TranscriptItem[] = [
      user,
      assistantWithUsage("a1", 100),
      tool("t1"),
      assistantWithUsage("a2", 250),
    ]

    expect(turnOutputTokens(items, "u1")).toBe(350)
  })

  it("无 usage 的 item 跳过；全缺返回 null", () => {
    const items: TranscriptItem[] = [
      user,
      assistantWithUsage("a1", undefined),
      assistantWithUsage("a2", undefined),
    ]

    expect(turnOutputTokens(items, "u1")).toBeNull()
  })

  it("部分缺 usage 时只加有的", () => {
    const items: TranscriptItem[] = [
      user,
      assistantWithUsage("a1", undefined),
      assistantWithUsage("a2", 42),
    ]

    expect(turnOutputTokens(items, "u1")).toBe(42)
  })

  it("turnStartId 定位：只数该 user 之后的 assistant", () => {
    const items: TranscriptItem[] = [
      user,
      assistantWithUsage("a1", 100),
      { ...user, id: "u2" },
      assistantWithUsage("a2", 200),
    ]

    expect(turnOutputTokens(items, "u2")).toBe(200)
    expect(turnOutputTokens(items, "u1")).toBe(100)
  })

  it("turnStartId 找不到时回退到最后一条 user", () => {
    const items: TranscriptItem[] = [
      user,
      assistantWithUsage("a1", 100),
      { ...user, id: "u2" },
      assistantWithUsage("a2", 200),
    ]

    expect(turnOutputTokens(items, "missing")).toBe(200)
  })

  it("没有任何 user 时从头扫到尾", () => {
    const items: TranscriptItem[] = [assistantWithUsage("a1", 30), assistantWithUsage("a2", 70)]
    expect(turnOutputTokens(items, undefined)).toBe(100)
  })

  it("turnStartId 之后遇到下一条 user 即停", () => {
    const items: TranscriptItem[] = [
      user,
      assistantWithUsage("a1", 100),
      { ...user, id: "u2" },
      assistantWithUsage("a2", 200),
    ]

    expect(turnOutputTokens(items, "u1")).toBe(100)
  })
})

describe("formatOutputTokens", () => {
  it("小于 1k 直接返回整数", () => {
    expect(formatOutputTokens(0)).toBe("0")
    expect(formatOutputTokens(999)).toBe("999")
  })

  it("k 档带 1 位小数", () => {
    expect(formatOutputTokens(1200)).toBe("1.2k")
    expect(formatOutputTokens(999949)).toBe("999.9k")
  })

  it("进位到下一档", () => {
    expect(formatOutputTokens(999950)).toBe("1.0M")
    expect(formatOutputTokens(999_950_000)).toBe("1.0B")
  })

  it("M 档带 1 位小数", () => {
    expect(formatOutputTokens(1_500_000)).toBe("1.5M")
  })
})

describe("createActivityLabelDisplay", () => {
  it("候选 debounce + minHold 后才换", () => {
    let nowValue = 0
    const timers: { fn: () => void; at: number }[] = []
    const display = createActivityLabelDisplay({
      debounceMs: 150,
      minHoldMs: 650,
      now: () => nowValue,
      setTimeout: (fn, ms) => {
        const entry = { fn, at: nowValue + ms }
        timers.push(entry)
        return entry
      },
      clearTimeout: (id) => {
        const index = timers.findIndex((entry) => entry === id)

        if (index >= 0) timers.splice(index, 1)
      },
    })

    display.update("甲", "thinking", true)
    expect(display.displayed()).toBe("甲")

    nowValue += 100
    display.update("乙", "thinking", true)
    expect(display.displayed()).toBe("甲")

    nowValue += 150
    timers.splice(0).forEach((entry) => entry.fn())
    expect(display.displayed()).toBe("甲")

    nowValue += 550
    timers.splice(0).forEach((entry) => entry.fn())
    expect(display.displayed()).toBe("乙")

    display.destroy()
  })

  it("busy 切 false 立即重置", () => {
    const display = createActivityLabelDisplay({})
    display.update("甲", "thinking", true)
    display.update("", null, false)
    expect(display.displayed()).toBe("")
    display.destroy()
  })
})
