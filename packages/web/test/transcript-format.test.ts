import { describe, expect, it } from "vitest";
import { parseTranscriptEntry } from "../src/features/sessions/transcript-format.js";

function messageEntry(message: unknown) {
  return { type: "message", id: "e1", parentId: null, timestamp: "t", message };
}

describe("parseTranscriptEntry", () => {
  it("classifies user messages with string content", () => {
    const part = parseTranscriptEntry(messageEntry({ role: "user", content: "你好" }));
    expect(part).toEqual({ kind: "user", text: "你好" });
  });

  it("splits assistant content into text and thinking blocks", () => {
    const part = parseTranscriptEntry(
      messageEntry({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "内部推理" },
          { type: "text", text: "最终回答" },
        ],
      }),
    );
    expect(part).toEqual({ kind: "agent", text: "最终回答", thinking: ["内部推理"] });
  });

  it("classifies tool results with name and error flag", () => {
    const ok = parseTranscriptEntry(
      messageEntry({ role: "toolResult", toolName: "bash", isError: false }),
    );
    const failed = parseTranscriptEntry(
      messageEntry({ role: "toolResult", toolName: "bash", isError: true }),
    );
    expect(ok).toEqual({ kind: "tool", name: "bash", isError: false });
    expect(failed).toEqual({ kind: "tool", name: "bash", isError: true });
  });

  it("drops entries without visible content", () => {
    expect(parseTranscriptEntry(messageEntry({ role: "assistant", content: [] }))).toBeUndefined();
    expect(parseTranscriptEntry(messageEntry({ role: "system", content: "x" }))).toBeUndefined();
  });

  it("classifies non-message entries as other", () => {
    expect(parseTranscriptEntry({ type: "compaction", summary: "s" })).toEqual({
      kind: "other",
      label: "compaction",
      detail: "",
    });
  });
});
