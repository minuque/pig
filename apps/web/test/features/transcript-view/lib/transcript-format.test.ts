import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@/types/common-type.js"
import {
  isVisibleTranscriptItem,
  splitCommandStatus,
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
  it("用户有字、助手有正文才占行", () => {
    expect(
      isVisibleTranscriptItem(item({ role: "user", content: [{ type: "text", text: "问" }] })),
    ).toBe(true)
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
          content: [{ type: "text", text: "答" }],
        }),
      ),
    ).toBe(true)
  })
})

describe("splitCommandStatus", () => {
  it("拆出失败输出末尾的 exit 状态行", () => {
    expect(splitCommandStatus("out\n\nCommand exited with code 1", "error")).toEqual({
      body: "out",
      exitCode: 1,
      statusLine: "",
    })
    expect(splitCommandStatus("\n\nCommand aborted", "error").statusLine).toBe("Command aborted")
    expect(splitCommandStatus("out", "success").exitCode).toBe(0)
    expect(splitCommandStatus("out", "running").exitCode).toBeUndefined()
  })
})
