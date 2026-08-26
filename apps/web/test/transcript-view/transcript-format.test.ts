import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  conversationRows,
  isVisibleTranscriptItem,
  toolCallSummary,
  toolInputHint,
  toolInputPretty,
  transcriptImageSrc,
  transcriptImages,
  transcriptText,
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

describe("transcript text helpers", () => {
  it("joins text blocks and builds a data URL", () => {
    const user = item({
      role: "user",
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ],
    })
    expect(transcriptText(user)).toBe("ab")
    expect(transcriptImageSrc("xyz", "image/png")).toBe("data:image/png;base64,xyz")
    expect(transcriptImageSrc("data:image/png;base64,xyz", "image/png")).toBe(
      "data:image/png;base64,xyz",
    )
  })
})

function tool(
  partial: Partial<ToolTranscriptItem> & Pick<ToolTranscriptItem, "status" | "isError">,
): ToolTranscriptItem {
  return {
    id: "t1",
    role: "tool",
    toolCallId: "t1",
    toolName: "bash",
    input: {},
    content: [],
    timestamp: 0,
    ...partial,
  } as ToolTranscriptItem
}

describe("tool call summary", () => {
  it("picks path / query / cmd from input, ignores empty objects", () => {
    expect(toolInputHint({ path: "src/app/page.tsx" })).toBe("src/app/page.tsx")
    expect(toolInputHint({ query: "spring physics easing" })).toBe("spring physics easing")
    expect(toolInputHint({ cmd: "pnpm test" })).toBe("pnpm test")
    expect(toolInputHint({ target_file: "a.ts" })).toBe("a.ts")
    expect(toolInputHint({ only: "value" })).toBe("value")
    expect(toolInputHint({})).toBe("")
    expect(toolInputHint([])).toBe("")
    expect(toolInputPretty({})).toBe("")
    expect(toolInputPretty({ q: 1 })).toBe('{\n  "q": 1\n}')
  })

  it("running uses the input hint, complete short lists become 条结果, errors say 失败", () => {
    expect(
      toolCallSummary(
        tool({
          status: "running",
          isError: false,
          input: { path: "src/app/page.tsx" },
          content: [{ type: "text", text: "a\nb\nc" }],
        }),
      ),
    ).toBe("src/app/page.tsx")
    expect(
      toolCallSummary(
        tool({
          status: "complete",
          isError: false,
          input: { cmd: "ls" },
          content: [{ type: "text", text: "a\nb" }],
        }),
      ),
    ).toBe("ls")
    expect(
      toolCallSummary(
        tool({
          status: "complete",
          isError: false,
          input: { query: "spring" },
          content: [{ type: "text", text: "a\nb\nc" }],
        }),
      ),
    ).toBe("3 条结果")
    expect(
      toolCallSummary(
        tool({
          status: "complete",
          isError: false,
          input: { path: "src/app/page.tsx" },
          content: [{ type: "text", text: "const x = 1\n".repeat(80) }],
        }),
      ),
    ).toBe("src/app/page.tsx")
    expect(
      toolCallSummary(tool({ status: "error", isError: true, input: { cmd: "pnpm test" } })),
    ).toBe("失败")
  })
})
