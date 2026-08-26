import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  conversationRows,
  isVisibleTranscriptItem,
  toolCallSummary,
  transcriptImages,
} from "@features/transcript-view/lib/transcript-format.js"

function item(partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] }): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem
}

describe("conversationRows", () => {
  it("keeps user text, assistant text, and tool items", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const tool = item({
      id: "t1",
      role: "tool",
      toolName: "bash",
      status: "complete",
      isError: false,
      content: [{ type: "text", text: "lots of output" }],
    })
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    })
    expect(conversationRows([user, tool, agent]).map((row) => row.id)).toEqual(["u1", "t1", "a1"])
  })

  it("keeps a user item that is only an image", () => {
    const user = item({
      role: "user",
      content: [{ type: "image", data: "abc", mimeType: "image/png" }],
    })
    expect(isVisibleTranscriptItem(user)).toBe(true)
    expect(transcriptImages(user)).toEqual([{ data: "abc", mimeType: "image/png" }])
  })

  it("drops assistant items that only contain toolCall blocks", () => {
    const agent = item({
      role: "assistant",
      status: "complete",
      content: [{ type: "toolCall", toolCallId: "c1", toolName: "bash", input: {} }],
    })
    expect(conversationRows([agent])).toEqual([])
  })

  it("drops items without visible user or assistant payload", () => {
    expect(conversationRows([item({ role: "assistant", content: [] })])).toEqual([])
    expect(conversationRows([item({ role: "user", content: [] })])).toEqual([])
  })

  it("keeps a streaming assistant before the first token", () => {
    const agent = item({
      role: "assistant",
      status: "streaming",
      content: [],
    })
    expect(conversationRows([agent])).toEqual([agent])
  })
})

describe("tool call summary", () => {
  it("running uses the input hint, errors say 失败", () => {
    const running = {
      id: "t1",
      role: "tool",
      toolCallId: "t1",
      toolName: "bash",
      input: { path: "src/app/page.tsx" },
      content: [],
      timestamp: 0,
      status: "running",
      isError: false,
    } as ToolTranscriptItem
    expect(toolCallSummary(running)).toBe("src/app/page.tsx")
    expect(toolCallSummary({ ...running, status: "error", isError: true })).toBe("失败")
  })
})
