import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import {
  EARLIER_ROW_ID,
  isEarlierRow,
  isMarkdownStreamReady,
  isThinkingRow,
  needsThinkingPlaceholder,
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
})
