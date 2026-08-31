import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import {
  isToolRow,
  toolCardOpen,
  thinkCardOpen,
  buildTimelineRows,
  type ToolCallView,
  toolRowLabel,
  toolRowSteps,
} from "@features/transcript-view/lib/transcript-rows.js"
import { assistantMarkdownFlags } from "@features/transcript-view/components/AssistantMessage.vue"
import { computeAdaptiveQueueStep } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import {
  isTranscriptAtBottom,
  isTranscriptVisuallyAtBottom,
  shouldReleaseFollowPin,
} from "@features/transcript-view/lib/transcript-scroll.js"

function item(partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] }): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem
}

describe("transcript rows", () => {
  it("用户行与助手正文按 role 分开", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "问" }] })
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    })
    const rows = buildTimelineRows([user, agent], false)
    expect(rows[0]?.role).toBe("user")
    expect(rows[1]?.role).toBe("assistant")
    expect(rows[1]).toMatchObject({ role: "assistant", text: "答", streaming: false })
  })

  it("流式助手行 streaming 为 true", () => {
    const streaming = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [{ type: "text", text: "…" }],
    })
    const rows = buildTimelineRows([streaming], false)
    expect(rows[0]).toMatchObject({ role: "assistant", text: "…", streaming: true })
  })
})

describe("transcript bottom thresholds", () => {
  it("离开精确底部后不再贴底，48px 内仍算视觉底部", () => {
    const sh = 1000
    const ch = 500
    expect(isTranscriptAtBottom(sh, 500, ch)).toBe(true)
    expect(isTranscriptAtBottom(sh, 490, ch)).toBe(false)
    expect(isTranscriptVisuallyAtBottom(sh, 490, ch)).toBe(true)
    expect(isTranscriptVisuallyAtBottom(sh, 451, ch)).toBe(false)
  })
})

describe("transcript follow pin", () => {
  it("贴底跟随中高度变高不解锁，上移才解锁", () => {
    expect(shouldReleaseFollowPin(true, 400, 400)).toBe(false)
    expect(shouldReleaseFollowPin(true, 390, 400)).toBe(true)
    expect(shouldReleaseFollowPin(false, 390, 400)).toBe(false)
  })
})

describe("assistant markdown stream flags", () => {
  it("流式关闭虚拟窗口，避免只停在文首", () => {
    const flags = assistantMarkdownFlags(true)
    expect(flags.maxLiveNodes).toBe(0)
    expect(flags.nodeVirtual).toBe(false)
    expect(flags.final).toBe(false)
  })
})

describe("transcript reveal queue", () => {
  it("积压越大单帧揭示越多，速度有上限", () => {
    const frameMs = 1000 / 60
    expect(computeAdaptiveQueueStep(8, frameMs, 0).revealChars).toBe(1)
    expect(computeAdaptiveQueueStep(32, frameMs, 0).revealChars).toBe(2)
    expect(computeAdaptiveQueueStep(128, frameMs, 0).revealChars).toBe(7)
    expect(computeAdaptiveQueueStep(512, frameMs, 0).revealChars).toBe(10)
    expect(computeAdaptiveQueueStep(0, frameMs, 0).revealChars).toBe(0)
  })
})

describe("assistant error rows", () => {
  it("连续空失败行合并为一条并带 errorMessage", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "ping" }] })
    const first = item({
      id: "e1",
      role: "assistant",
      status: "error",
      errorMessage: "Request timed out.",
      content: [],
    })
    const second = item({
      id: "e2",
      role: "assistant",
      status: "error",
      errorMessage: "Request timed out.",
      content: [],
    })
    const rows = buildTimelineRows([user, first, second], false)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      role: "assistant",
      error: true,
      errorMessage: "Request timed out.",
      retryCount: 2,
    })
  })
})

describe("thinking placeholder", () => {
  it("运行中在用户句后补工作槽等待，首个工具沿用同一 id", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
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
    expect(buildTimelineRows([], false).some(isToolRow)).toBe(false)
    const idle = buildTimelineRows([], true)
    expect(idle[0]).toMatchObject({ role: "tools", id: "tools:orphan:0", mode: "live", tools: [] })
    const headed = buildTimelineRows([user], true)
    expect(headed[1]).toMatchObject({ role: "tools", id: "tools:u1:0", mode: "live", tools: [] })
    expect(buildTimelineRows([user, streaming], true)[1]).toMatchObject({ id: "tools:u1:0" })
    expect(buildTimelineRows([user, streamingBody], true).some(isToolRow)).toBe(false)
    const withTool = buildTimelineRows([user, tool], true)
    expect(withTool[1]).toMatchObject({ role: "tools", id: "tools:u1:0", mode: "live" })
    expect(isToolRow(withTool[1]!) && withTool[1].tools.map((row) => row.id)).toEqual(["t1"])
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
    expect(rows.map((row) => row.role)).toEqual(["user", "tools", "assistant"])
    const work = rows[1]!
    expect(isToolRow(work)).toBe(true)
    if (!isToolRow(work)) return
    expect(work.mode).toBe("fold")
    expect(work.id).toBe("tools:u1:0")
    expect(work.thinking).toEqual(["先看文件"])
    expect(work.tools.map((item) => item.id)).toEqual(["t1"])
    expect(toolRowLabel(work)).toBe("Ran 1 thought · 1 file read")
    expect(work.role).toBe("tools")
    expect(toolRowSteps(work).map((step) => step.type)).toEqual(["thought", "tool"])
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
    expect(rows.map((row) => row.role)).toEqual([
      "user",
      "tools",
      "assistant",
      "tools",
      "assistant",
    ])
    const firstWork = rows[1]!
    const secondWork = rows[3]!
    expect(isToolRow(firstWork)).toBe(true)
    expect(isToolRow(secondWork)).toBe(true)
    if (!isToolRow(firstWork) || !isToolRow(secondWork)) return
    expect(toolRowLabel(firstWork)).toBe("Ran 1 thought")
    expect(toolRowLabel(secondWork)).toBe("Ran 1 file read · 1 tool call · 1 command · 1 thought")
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
    expect(rows.map((row) => row.role)).toEqual(["user", "tools"])
    const work = rows[1]!
    expect(isToolRow(work)).toBe(true)
    if (!isToolRow(work)) return
    expect(work.mode).toBe("live")
    expect(work.id).toBe("tools:u1:0")
    expect(work.thinking).toEqual(["先看文件"])
    expect(work.tools.map((item) => item.id)).toEqual(["t1", "t2"])
    expect(work.role).toBe("tools")
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
      ["tools", "tools:orphan:0"],
      ["user", "u1"],
      ["assistant", "a1"],
    ])
    const work = rows[0]!
    expect(isToolRow(work)).toBe(true)
    if (!isToolRow(work)) return
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
    expect(rows.map((row) => row.role)).toEqual(["user", "tools", "assistant", "tools"])
    const firstWork = rows[1]!
    const secondWork = rows[3]!
    expect(isToolRow(firstWork) && firstWork.mode).toBe("fold")
    expect(isToolRow(secondWork) && secondWork.mode).toBe("live")
  })

  it("进行中正文开始后上面的工具组收成折叠", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
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
      status: "streaming",
      content: [{ type: "text", text: "先说一句" }],
    })
    const rows = buildTimelineRows([user, tool, agent], true)
    expect(rows.map((row) => row.role)).toEqual(["user", "tools", "assistant"])
    const work = rows[1]!
    expect(isToolRow(work) && work.mode).toBe("fold")
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
    expect(isToolRow(work)).toBe(true)
    if (!isToolRow(work)) return
    expect(work.aborted).toBe(true)
    expect(work.mode).toBe("fold")
    expect(toolRowLabel(work)).toBe("已停止")
  })
})

describe("toolCardOpen", () => {
  it("展开态只按 id 记忆，运行和失败不强制展开", () => {
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
    expect(toolCardOpen(running, new Map())).toBe(false)
    expect(toolCardOpen(failed, new Map())).toBe(false)
    expect(toolCardOpen(done, new Map())).toBe(false)
    expect(toolCardOpen(done, expanded)).toBe(true)
    expect(toolCardOpen(running, expanded)).toBe(true)
    expect(thinkCardOpen("think:1", new Map())).toBe(false)
    expect(thinkCardOpen("think:1", new Map([["think:1", true]]))).toBe(true)
  })
})
