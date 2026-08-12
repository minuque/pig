import { describe, expect, it } from "vitest";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import { projectTranscriptItem } from "../src/features/sessions/transcript-format.js";

function item(partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] }): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem;
}

describe("projectTranscriptItem", () => {
  it("classifies user messages with string content", () => {
    const part = projectTranscriptItem(
      item({ role: "user", content: [{ type: "text", text: "你好" }] }),
    );
    expect(part).toEqual({ kind: "user", text: "你好" });
  });

  it("splits assistant content into text and thinking blocks", () => {
    const part = projectTranscriptItem(
      item({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "内部推理" },
          { type: "text", text: "最终回答" },
        ],
      }),
    );
    expect(part).toEqual({ kind: "agent", text: "最终回答", thinking: ["内部推理"] });
  });

  it("drops items without visible content", () => {
    expect(projectTranscriptItem(item({ role: "assistant", content: [] }))).toBeUndefined();
  });

  it("classifies tool items with error flag", () => {
    const part = projectTranscriptItem(
      item({
        role: "tool",
        toolName: "bash",
        isError: true,
        content: [{ type: "text", text: "failed" }],
      }),
    );
    expect(part).toEqual({ kind: "tool", name: "bash", isError: true, text: "failed" });
  });
});
