import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol"
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
    expect(toolCallTitle(running.toolName, running.input)).toBe("Read src/app/page.tsx")
    const filename = "pi-powershell-transcript-check-with-complete-filename.log"
    expect(
      toolCallTitle("read", { path: `C:\\Users\\10537\\AppData\\Local\\Temp\\${filename}` }),
    ).toBe(`Read C:\\Users\\10537\\AppData\\Local\\Temp\\${filename}`)
    expect(toolCallTitle("read", { path: `/tmp/transcript-check/${filename}` })).toBe(
      `Read /tmp/transcript-check/${filename}`,
    )
    expect(toolCallTitle("bash", { command: "git status" })).toBe("Run git status")
    expect(toolCallTitle("web_search", { query: "vue sfc" })).toBe("web_search vue sfc")
  })

  it("命令摘要优先描述，完整命令与路径交给布局省略而不丢失原文", () => {
    const description = "检查 Web 类型与依赖"
    const shortCommand = "git status --short"
    const longCommand = `echo ${"x".repeat(200)}`
    for (const name of ["bash", "powershell", "pwsh"]) {
      expect(toolCallDetail(name, { command: shortCommand, description })).toBe(description)
      expect(toolCallDetail(name, { command: longCommand, description })).toBe(description)
      expect(toolCallDetail(name, { command: longCommand })).toBe(longCommand)
    }
    expect(toolCallDetail("powershell", { cmd: longCommand, description: "  " })).toBe(longCommand)
    expect(toolCallDetail("bash", shortCommand)).toBe(shortCommand)
    expect(toolCallDetail("bash", { path: "workdir", command: longCommand, description })).toBe(
      description,
    )
    expect(toolCallDetail("powershell", { cmd: shortCommand, description })).toBe(description)
    expect(toolCallTitle("powershell", { cmd: shortCommand, description })).toBe(
      `Pwsh ${description}`,
    )
    const boundaryText = "界".repeat(80)
    expect(toolCallDetail("ffgrep", { query: boundaryText })).toBe(boundaryText)
    expect(toolCallDetail("ffgrep", { query: `${boundaryText}界` })).toBe(`${boundaryText}界`)
    expect(toolCallDetail("bash", { command: longCommand, description: "💡".repeat(81) })).toBe(
      "💡".repeat(81),
    )
    const input = { command: longCommand, description, timeout: 30 }
    expect(toolInputPretty(input)).toBe(JSON.stringify(input, null, 2))
  })
})
