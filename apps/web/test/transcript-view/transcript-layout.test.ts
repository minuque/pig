import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import {
  isThinkingRow,
  isWorkRow,
  toolCardOpen,
  transcriptRowContent,
  transcriptRowFinal,
  transcriptRowKind,
  buildTimelineRows,
  type ToolCallView,
  workFoldLabel,
  workSteps,
} from "@features/transcript-view/lib/transcript-rows.js"
import { isMarkdownStreamReady } from "@features/transcript-view/lib/transcript-scroll.js"

function item(partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] }): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem
}

describe("transcript row markstream mapping", () => {
  it("maps only assistant body to assistant-markdown", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "问" }] })
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    })
    const rows = buildTimelineRows([user, agent], false)
    expect(transcriptRowKind(rows[0]!)).toBe("user-message")
    expect(transcriptRowKind(rows[1]!)).toBe("assistant-markdown")
    expect(transcriptRowContent(rows[0]!)).toBe("")
    expect(transcriptRowContent(rows[1]!)).toBe("答")
    expect(transcriptRowFinal(rows[1]!)).toBe(true)
  })

  it("keeps streaming assistant rows live so the timeline can grow in place", () => {
    const streaming = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [{ type: "text", text: "…" }],
    })
    const rows = buildTimelineRows([streaming], false)
    expect(transcriptRowFinal(rows[0]!)).toBe(false)
    expect(transcriptRowContent(rows[0]!)).toBe("…")
  })
})

describe("isMarkdownStreamReady", () => {
  it("没有助手正文时立刻就绪", () => {
    expect(isMarkdownStreamReady(false, 0, false)).toBe(true)
  })

  it("有助手正文时要等挂上且 pending 清零", () => {
    expect(isMarkdownStreamReady(true, 0, false)).toBe(false)
    expect(isMarkdownStreamReady(true, 2, true)).toBe(false)
    expect(isMarkdownStreamReady(true, 0, true)).toBe(true)
  })
})

describe("thinking placeholder", () => {
  it("运行中在用户句后补思考占位，流式正文或进行中的工具不重复", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "问" }] })
    const streaming = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [],
    })
    const streamingBody = item({
      id: "a2",
      role: "assistant",
      status: "streaming",
      content: [{ type: "text", text: "答" }],
    })
    const tool = item({
      id: "t1",
      role: "tool",
      toolName: "bash",
      status: "running",
      isError: false,
      content: [],
    })
    expect(buildTimelineRows([], false).some(isThinkingRow)).toBe(false)
    expect(buildTimelineRows([], true).some(isThinkingRow)).toBe(true)
    expect(buildTimelineRows([user], true).some(isThinkingRow)).toBe(true)
    expect(buildTimelineRows([user, streaming], true).some(isThinkingRow)).toBe(true)
    expect(buildTimelineRows([user, streamingBody], true).some(isThinkingRow)).toBe(false)
    expect(buildTimelineRows([user, tool], true).some(isThinkingRow)).toBe(false)
    const headed = buildTimelineRows([user], true)
    expect(transcriptRowKind(headed[1]!)).toBe("thinking-wait")
    expect(transcriptRowContent(headed[1]!)).toBe("")
    expect(transcriptRowFinal(headed[1]!)).toBe(true)
  })
})

describe("turn work fold", () => {
  it("历史把思考和工具收进正文前的折叠，标签按种类计数", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const thinking = item({
      id: "a0",
      role: "assistant",
      status: "complete",
      content: [{ type: "thinking", thinking: "先看文件" }],
    })
    const tool = item({
      id: "t1",
      role: "tool",
      toolName: "read",
      status: "complete",
      isError: false,
      content: [],
    })
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    })
    const rows = buildTimelineRows([user, thinking, tool, agent], false)
    expect(rows.map((row) => row.role)).toEqual(["user", "work", "assistant"])
    const work = rows[1]!
    expect(isWorkRow(work)).toBe(true)
    if (!isWorkRow(work)) return
    expect(work.mode).toBe("fold")
    expect(work.thinking).toEqual(["先看文件"])
    expect(work.tools.map((item) => item.id)).toEqual(["t1"])
    expect(workFoldLabel(work)).toBe("Ran 1 thought · 1 file read")
    expect(transcriptRowKind(work)).toBe("work-fold")
    expect(workSteps(work).map((step) => step.type)).toEqual(["thought", "tool"])
  })

  it("助手正文切开工作组，每段折叠条按出现顺序计数", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const thought = item({
      id: "a0",
      role: "assistant",
      status: "complete",
      content: [{ type: "thinking", thinking: "先摸清" }],
    })
    const first = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "先摸清项目目录。" }],
    })
    const read = item({
      id: "t1",
      role: "tool",
      toolName: "read",
      status: "complete",
      isError: false,
      content: [],
    })
    const other = item({
      id: "t2",
      role: "tool",
      toolName: "grep",
      status: "complete",
      isError: false,
      content: [],
    })
    const bash = item({
      id: "t3",
      role: "tool",
      toolName: "bash",
      status: "complete",
      isError: false,
      content: [],
    })
    const laterThought = item({
      id: "a2",
      role: "assistant",
      status: "complete",
      content: [{ type: "thinking", thinking: "接着读" }],
    })
    const second = item({
      id: "a3",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "接着读 workspace。" }],
    })
    const rows = buildTimelineRows(
      [user, thought, first, read, other, bash, laterThought, second],
      false,
    )
    expect(rows.map((row) => row.role)).toEqual(["user", "work", "assistant", "work", "assistant"])
    const firstWork = rows[1]!
    const secondWork = rows[3]!
    expect(isWorkRow(firstWork)).toBe(true)
    expect(isWorkRow(secondWork)).toBe(true)
    if (!isWorkRow(firstWork) || !isWorkRow(secondWork)) return
    expect(workFoldLabel(firstWork)).toBe("Ran 1 thought")
    expect(workFoldLabel(secondWork)).toBe("Ran 1 file read · 1 tool call · 1 command · 1 thought")
  })

  it("进行中不折叠，连续工具占一行，思考画在组上", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const thinking = item({
      id: "a0",
      role: "assistant",
      status: "complete",
      content: [{ type: "thinking", thinking: "先看文件" }],
    })
    const toolA = item({
      id: "t1",
      role: "tool",
      toolName: "read",
      status: "complete",
      isError: false,
      content: [],
    })
    const toolB = item({
      id: "t2",
      role: "tool",
      toolName: "read",
      status: "running",
      isError: false,
      content: [],
    })
    const rows = buildTimelineRows([user, thinking, toolA, toolB], true)
    expect(rows.map((row) => row.role)).toEqual(["user", "work"])
    const work = rows[1]!
    expect(isWorkRow(work)).toBe(true)
    if (!isWorkRow(work)) return
    expect(work.mode).toBe("live")
    expect(work.thinking).toEqual(["先看文件"])
    expect(work.tools.map((item) => item.id)).toEqual(["t1", "t2"])
    expect(transcriptRowKind(work)).toBe("tool-group")
  })

  it("窗口顶部没有用户句的残段不折叠", () => {
    const tool = item({
      id: "t1",
      role: "tool",
      toolName: "bash",
      status: "complete",
      isError: false,
      content: [],
    })
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "下一问" }] })
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    })
    const rows = buildTimelineRows([tool, user, agent], false)
    expect(rows.map((row) => [row.role, row.id])).toEqual([
      ["work", "work:t1"],
      ["user", "u1"],
      ["assistant", "a1"],
    ])
    const work = rows[0]!
    expect(isWorkRow(work)).toBe(true)
    if (!isWorkRow(work)) return
    expect(work.mode).toBe("live")
  })

  it("助手正文会切开连续工具组", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const toolA = item({
      id: "t1",
      role: "tool",
      toolName: "read",
      status: "complete",
      isError: false,
      content: [],
    })
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [{ type: "text", text: "先说一句" }],
    })
    const toolB = item({
      id: "t2",
      role: "tool",
      toolName: "read",
      status: "running",
      isError: false,
      content: [],
    })
    const rows = buildTimelineRows([user, toolA, agent, toolB], true)
    expect(rows.map((row) => row.role)).toEqual(["user", "work", "assistant", "work"])
  })

  it("Abort 的 Turn 折叠条写已停止", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const tool = item({
      id: "t1",
      role: "tool",
      toolName: "bash",
      status: "complete",
      isError: false,
      content: [],
    })
    const aborted = item({
      id: "a1",
      role: "assistant",
      status: "aborted",
      content: [{ type: "thinking", thinking: "半路" }],
    })
    const rows = buildTimelineRows([user, tool, aborted], false)
    const work = rows[1]!
    expect(isWorkRow(work)).toBe(true)
    if (!isWorkRow(work)) return
    expect(work.aborted).toBe(true)
    expect(work.mode).toBe("fold")
    expect(workFoldLabel(work)).toBe("已停止")
  })
})

describe("toolCardOpen", () => {
  it("running 和失败保持展开，完成态按 id 记忆", () => {
    const running: ToolCallView = {
      id: "t1",
      toolName: "read",
      running: true,
      isError: false,
      input: {},
      outputText: "",
      outputImages: [],
    }
    const done = { ...running, running: false, isError: false }
    const failed = { ...running, running: false, isError: true }
    const expanded = new Map<string, boolean>([["t1", true]])
    expect(toolCardOpen(running, new Map())).toBe(true)
    expect(toolCardOpen(failed, new Map())).toBe(true)
    expect(toolCardOpen(done, new Map())).toBe(false)
    expect(toolCardOpen(done, expanded)).toBe(true)
  })
})
