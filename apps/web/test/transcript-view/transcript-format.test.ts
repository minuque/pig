import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  conversationRows,
  isVisibleTranscriptItem,
  toolCallSummary,
  toolCallTitle,
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

function tool(partial: Partial<ToolTranscriptItem> & { toolName: string }): ToolTranscriptItem {
  return {
    id: "t1",
    role: "tool",
    toolCallId: "t1",
    input: {},
    content: [],
    timestamp: 0,
    status: "complete",
    isError: false,
    ...partial,
  } as ToolTranscriptItem
}

describe("conversationRows", () => {
  it("keeps user text, assistant text, and tool items", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] })
    const toolItem = item({
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
    expect(conversationRows([user, toolItem, agent]).map((row) => row.id)).toEqual([
      "u1",
      "t1",
      "a1",
    ])
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

  it("drops a streaming assistant that has no body yet", () => {
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [],
    })
    expect(conversationRows([agent])).toEqual([])
  })

  it("drops an assistant that only has thinking", () => {
    const agent = item({
      role: "assistant",
      status: "complete",
      content: [{ type: "thinking", thinking: "hmm" }],
    })
    expect(isVisibleTranscriptItem(agent)).toBe(false)
  })
})

describe("tool call title", () => {
  it("uses kind label and input object", () => {
    const running = tool({
      toolName: "read",
      status: "running",
      input: { path: "src/app/page.tsx" },
    })
    expect(toolCallTitle(running.toolName, running.input)).toBe("Read page.tsx")
    expect(toolCallTitle("bash", { command: "git status" })).toBe('Run "git status"')
    expect(toolCallTitle("web_search", { query: "vue sfc" })).toBe("web_search vue sfc")
  })
})

describe("tool call summary", () => {
  it("running has no summary, errors say 失败", () => {
    const running = tool({
      toolName: "bash",
      input: { path: "src/app/page.tsx" },
      status: "running",
    })
    expect(
      toolCallSummary({
        isError: running.isError,
        running: running.status === "running",
        outputText: "",
        outputImages: [],
      }),
    ).toBe("")
    expect(
      toolCallSummary({
        isError: true,
        running: false,
        outputText: "",
        outputImages: [],
      }),
    ).toBe("失败")
  })
})
