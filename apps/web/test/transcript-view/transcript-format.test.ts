import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import {
  isVisibleTranscriptItem,
  toolCallDetail,
  toolCallTitle,
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

describe("tool call title", () => {
  it("种类加路径或命令，命令工具优先用描述", () => {
    expect(toolCallTitle("read", { path: "src/app/page.tsx" })).toBe("Read src/app/page.tsx")
    expect(toolCallTitle("bash", { command: "git status" })).toBe("Run git status")
    expect(toolCallTitle("web_search", { query: "vue sfc" })).toBe("web_search vue sfc")
    const description = "检查 Web 类型与依赖"
    const command = "git status --short"
    expect(toolCallDetail("bash", { command, description })).toBe(description)
    expect(toolCallDetail("powershell", { cmd: command })).toBe(command)
    expect(toolCallTitle("powershell", { cmd: command, description })).toBe(`Pwsh ${description}`)
    expect(toolInputPretty({ command, description })).toBe(
      JSON.stringify({ command, description }, null, 2),
    )
  })
})
