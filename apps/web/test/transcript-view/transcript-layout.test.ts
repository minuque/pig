import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import {
  EARLIER_ROW_ID,
  THINKING_ROW_ID,
  estimateTranscriptRowHeight,
  isEarlierRow,
  isMarkdownStreamReady,
  isThinkingRow,
  isTranscriptAtBottom,
  isTranscriptVisuallyAtBottom,
  needsThinkingPlaceholder,
  shouldHoldProgrammaticBottom,
  threadStatePinnedToBottom,
  shouldShowScrollToLatest,
  unpinBottomScrollTop,
  transcriptRowContent,
  transcriptRowFinal,
  transcriptRowKind,
  withEarlierRow,
  withThinkingRow,
} from "@features/transcript-view/index.vue"

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
    expect(withEarlierRow([user], false)).toEqual([user])
    const headed = withEarlierRow([user], true)
    expect(headed[0]).toEqual({ id: EARLIER_ROW_ID, role: "earlier" })
    expect(headed[1]).toEqual(user)
    expect(isEarlierRow(headed[0]!)).toBe(true)
    expect(transcriptRowKind(headed[0]!)).toBe("load-earlier")
    expect(transcriptRowContent(headed[0]!)).toBe("")
    expect(transcriptRowFinal(headed[0]!)).toBe(true)
    expect(estimateTranscriptRowHeight(headed[0]!)).toBe(48)
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

describe("estimateTranscriptRowHeight", () => {
  it("工具行固定矮，短助手行不低于 160，避免视口塞进过多未测行", () => {
    const tool = item({ id: "t1", role: "tool", toolName: "bash", content: [] })
    const short = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    })
    expect(estimateTranscriptRowHeight(tool)).toBe(48)
    expect(estimateTranscriptRowHeight(short)).toBe(160)
  })

  it("助手正文按约 48 字一行估高，长文封顶 960，思考摘要另加 36", () => {
    const tenLines = item({
      id: "a2",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "字".repeat(480) }],
    })
    const long = item({
      id: "a3",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "字".repeat(5000) }],
    })
    const withThink = item({
      id: "a4",
      role: "assistant",
      status: "complete",
      content: [
        { type: "thinking", thinking: "先想" },
        { type: "text", text: "字".repeat(480) },
      ],
    })
    expect(estimateTranscriptRowHeight(tenLines)).toBe(296)
    expect(estimateTranscriptRowHeight(long)).toBe(960)
    expect(estimateTranscriptRowHeight(withThink)).toBe(332)
  })

  it("流式思考估高加展开高度，空流式助手只占思考占位", () => {
    const streamingThink = item({
      id: "a5",
      role: "assistant",
      status: "streaming",
      content: [
        { type: "thinking", thinking: "先想" },
        { type: "text", text: "字".repeat(480) },
      ],
    })
    const streamingEmpty = item({
      id: "a6",
      role: "assistant",
      status: "streaming",
      content: [],
    })
    expect(estimateTranscriptRowHeight(streamingThink)).toBe(496)
    expect(estimateTranscriptRowHeight(streamingEmpty)).toBe(36)
    expect(estimateTranscriptRowHeight({ id: THINKING_ROW_ID, role: "thinking" })).toBe(36)
  })

  it("用户行按约 36 字一行，硬换行分段折行", () => {
    const brief = item({ role: "user", content: [{ type: "text", text: "问" }] })
    const wrapped = item({ role: "user", content: [{ type: "text", text: "字".repeat(72) }] })
    const broken = item({
      role: "user",
      content: [{ type: "text", text: "甲\n乙\n丙" }],
    })
    expect(estimateTranscriptRowHeight(brief)).toBe(78)
    expect(estimateTranscriptRowHeight(wrapped)).toBe(100)
    expect(estimateTranscriptRowHeight(broken)).toBe(122)
  })
})

describe("transcript edge thresholds", () => {
  it("离底 2px 内才与 Markstream 一起视为精确贴底", () => {
    expect(isTranscriptAtBottom(1000, 398, 600)).toBe(true)
    expect(isTranscriptAtBottom(1000, 397, 600)).toBe(false)
  })

  it("有内容且视觉上离开底部才显示回到底部按钮", () => {
    expect(shouldShowScrollToLatest(3, false)).toBe(true)
    expect(shouldShowScrollToLatest(3, true)).toBe(false)
    expect(shouldShowScrollToLatest(0, false)).toBe(false)
  })

  it("上翻解锁的 3px 仍算视觉贴底，不弹出回到底部", () => {
    expect(isTranscriptVisuallyAtBottom(1000, 397, 600)).toBe(true)
    expect(isTranscriptVisuallyAtBottom(1000, 352, 600)).toBe(true)
    expect(isTranscriptVisuallyAtBottom(1000, 351, 600)).toBe(false)
    expect(shouldShowScrollToLatest(3, isTranscriptVisuallyAtBottom(1000, 397, 600))).toBe(false)
  })

  it("程序化滚底后，未贴底读数在 hold 窗口内不能把按钮打回来", () => {
    expect(shouldHoldProgrammaticBottom(false, 100, 99)).toBe(true)
    expect(shouldHoldProgrammaticBottom(false, 100, 100)).toBe(false)
    expect(shouldHoldProgrammaticBottom(true, 100, 99)).toBe(false)
  })

  it("贴底只有明显上翻才解锁，1px 惯性不抢走触底", () => {
    expect(unpinBottomScrollTop(1000, 400, 600, -1)).toBeNull()
    expect(unpinBottomScrollTop(1000, 400, 600, -8)).toBe(392)
    expect(unpinBottomScrollTop(1000, 400, 600, 8)).toBeNull()
    expect(unpinBottomScrollTop(1000, 397, 600, -8)).toBeNull()
  })

  it("运行中在用户句后补思考占位，流式助手或进行中的工具不重复", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "问" }] })
    const streaming = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [],
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
    expect(needsThinkingPlaceholder("turn", [user, streaming])).toBe(false)
    expect(needsThinkingPlaceholder("turn", [user, tool])).toBe(false)
    const headed = withThinkingRow(withEarlierRow([user], false), "turn", [user])
    expect(isThinkingRow(headed[1]!)).toBe(true)
    expect(transcriptRowKind(headed[1]!)).toBe("thinking-wait")
    expect(transcriptRowContent(headed[1]!)).toBe("")
    expect(transcriptRowFinal(headed[1]!)).toBe(true)
  })

  it("恢复会话时只保留行高，锚点强制贴底", () => {
    expect(threadStatePinnedToBottom(null)).toBeNull()
    expect(
      threadStatePinnedToBottom({
        threadKey: "s1",
        itemHeights: { a: 40 },
        markdownStates: {},
        outerAnchor: { type: "item", itemKey: "a", offsetWithinItemPx: 12 },
      }),
    ).toEqual({
      threadKey: "s1",
      itemHeights: { a: 40 },
      markdownStates: {},
      outerAnchor: { type: "bottom", distanceFromBottomPx: 0 },
    })
  })
})
