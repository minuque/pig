import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@/types/common-type.js"
import {
  isVisibleTranscriptItem,
  toolCallDetail,
  toolInputPretty,
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

describe("tool call detail", () => {
  it("命令工具优先用描述", () => {
    const description = "检查 Web 类型与依赖"
    const command = "git status --short"
    expect(toolCallDetail("bash", { command, description })).toBe(description)
    expect(toolCallDetail("powershell", { cmd: command })).toBe(command)
    expect(toolCallDetail("read", { path: "src/app/page.tsx" })).toBe("src/app/page.tsx")
    expect(toolInputPretty({ command, description })).toBe(
      JSON.stringify({ command, description }, null, 2),
    )
  })
})
