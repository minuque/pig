import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  EARLIER_ROW_ID,
  isEarlierRow,
  isThinkingRow,
  isWorkRow,
  needsThinkingPlaceholder,
  toolCardOpen,
  transcriptRowContent,
  transcriptRowFinal,
  transcriptRowKind,
  buildTimelineRows,
  workFoldLabel,
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
    const tool = item({ id: "t1", role: "tool", toolName: "bash", content: [] })
    expect(transcriptRowKind(user)).toBe("user-message")
    expect(transcriptRowKind(agent)).toBe("assistant-markdown")
    expect(transcriptRowKind(tool)).toBe("tool-call")
    expect(transcriptRowContent(user)).toBe("")
    expect(transcriptRowContent(agent)).toBe("答")
    expect(transcriptRowContent(tool)).toBe("")
    expect(transcriptRowFinal(agent)).toBe(true)
  })

  it("keeps streaming assistant rows live so the timeline can grow in place", () => {
    const streaming = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [{ type: "text", text: "…" }],
    })
    expect(transcriptRowFinal(streaming)).toBe(false)
    expect(transcriptRowContent(streaming)).toBe("…")
  })

  it("加载更早行独占时间线首行，不是 Markdown", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "问" }] })
    expect(buildTimelineRows([user], "idle", false)).toEqual([user])
    const headed = buildTimelineRows([user], "idle", true)
    expect(headed[0]).toEqual({ id: EARLIER_ROW_ID, role: "earlier" })
    expect(headed[1]).toEqual(user)
    expect(isEarlierRow(headed[0]!)).toBe(true)
    expect(transcriptRowKind(headed[0]!)).toBe("load-earlier")
    expect(transcriptRowContent(headed[0]!)).toBe("")
    expect(transcriptRowFinal(headed[0]!)).toBe(true)
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
    expect(needsThinkingPlaceholder("idle", [])).toBe(false)
    expect(needsThinkingPlaceholder("turn", [])).toBe(true)
    expect(needsThinkingPlaceholder("turn", [user])).toBe(true)
    expect(needsThinkingPlaceholder("turn", [user, streaming])).toBe(true)
    expect(needsThinkingPlaceholder("turn", [user, streamingBody])).toBe(false)
    expect(needsThinkingPlaceholder("turn", [user, tool])).toBe(false)
    const headed = buildTimelineRows([user], "turn", false)
    expect(isThinkingRow(headed[1]!)).toBe(true)
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
    const rows = buildTimelineRows([user, thinking, tool, agent], "idle", false)
    expect(rows.map((row) => row.role)).toEqual(["user", "work", "assistant"])
    const work = rows[1]!
    expect(isWorkRow(work)).toBe(true)
    if (!isWorkRow(work)) return
    expect(work.mode).toBe("fold")
    expect(work.thinking).toEqual(["先看文件"])
    expect(work.tools.map((item) => item.id)).toEqual(["t1"])
    expect(workFoldLabel(work)).toBe("1 次思考 · 1 次读取")
    expect(transcriptRowKind(work)).toBe("work-fold")
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
      "idle",
      false,
    )
    expect(rows.map((row) => row.role)).toEqual(["user", "work", "assistant", "work", "assistant"])
    const firstWork = rows[1]!
    const secondWork = rows[3]!
    expect(isWorkRow(firstWork)).toBe(true)
    expect(isWorkRow(secondWork)).toBe(true)
    if (!isWorkRow(firstWork) || !isWorkRow(secondWork)) return
    expect(workFoldLabel(firstWork)).toBe("1 次思考")
    expect(workFoldLabel(secondWork)).toBe("1 次读取 · 1 次工具调用 · 1 次命令 · 1 次思考")
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
    const rows = buildTimelineRows([user, thinking, toolA, toolB], "turn", false)
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
    const rows = buildTimelineRows([tool, user, agent], "idle", false)
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
    const rows = buildTimelineRows([user, toolA, agent, toolB], "turn", false)
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
    const rows = buildTimelineRows([user, tool, aborted], "idle", false)
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
    const running = item({
      id: "t1",
      role: "tool",
      toolName: "read",
      status: "running",
      isError: false,
      content: [],
    }) as ToolTranscriptItem
    const done = { ...running, status: "complete", isError: false } as ToolTranscriptItem
    const failed = { ...running, status: "error", isError: true } as ToolTranscriptItem
    const expanded = new Map<string, boolean>([["t1", true]])
    expect(toolCardOpen(running, new Map())).toBe(true)
    expect(toolCardOpen(failed, new Map())).toBe(true)
    expect(toolCardOpen(done, new Map())).toBe(false)
    expect(toolCardOpen(done, expanded)).toBe(true)
  })
})
