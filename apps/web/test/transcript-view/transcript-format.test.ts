import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol"
import {
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

describe("isVisibleTranscriptItem", () => {
  it("用户有字或图、助手有正文才占行", () => {
    expect(
      isVisibleTranscriptItem(item({ role: "user", content: [{ type: "text", text: "问" }] })),
    ).toBe(true)
    const imageUser = item({
      role: "user",
      content: [{ type: "image", data: "abc", mimeType: "image/png" }],
    })
    expect(isVisibleTranscriptItem(imageUser)).toBe(true)
    expect(transcriptImages(imageUser)).toEqual([{ data: "abc", mimeType: "image/png" }])
    expect(isVisibleTranscriptItem(item({ role: "user", content: [] }))).toBe(false)
    expect(
      isVisibleTranscriptItem(
        item({
          role: "assistant",
          status: "complete",
          content: [{ type: "thinking", thinking: "hmm" }],
        }),
      ),
    ).toBe(false)
    expect(
      isVisibleTranscriptItem(
        item({
          role: "assistant",
          status: "complete",
          content: [{ type: "toolCall", toolCallId: "c1", toolName: "bash", input: {} }],
        }),
      ),
    ).toBe(false)
    expect(
      isVisibleTranscriptItem(item({ role: "assistant", status: "streaming", content: [] })),
    ).toBe(false)
    expect(
      isVisibleTranscriptItem(
        item({ role: "assistant", status: "complete", content: [{ type: "text", text: "答" }] }),
      ),
    ).toBe(true)
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
    expect(
      toolCallSummary({
        isError: false,
        running: true,
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
