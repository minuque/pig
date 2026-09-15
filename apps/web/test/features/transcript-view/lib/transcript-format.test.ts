import { describe, expect, it } from "vitest"
import type { TranscriptItem } from "@/types/common-type.js"
import { isVisibleTranscriptItem } from "@features/transcript-view/lib/transcript-format.js"

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
