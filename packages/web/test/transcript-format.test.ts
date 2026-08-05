import { describe, expect, it } from "vitest";
import { createFoldKey } from "../src/features/sessions/TranscriptView.vue";
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

  it("classifies tool results with name, error flag and text", () => {
    const ok = parseTranscriptEntry(
      messageEntry({ role: "toolResult", toolName: "bash", isError: false }),
    );
    const failed = parseTranscriptEntry(
      messageEntry({ role: "toolResult", toolName: "bash", isError: true }),
    );
    expect(ok).toEqual({ kind: "tool", name: "bash", isError: false, text: "" });
    expect(failed).toEqual({ kind: "tool", name: "bash", isError: true, text: "" });
  });

  it("extracts tool result text from string or block content", () => {
    const string = parseTranscriptEntry(
      messageEntry({ role: "toolResult", toolName: "bash", content: "ok" }),
    );
    const blocks = parseTranscriptEntry(
      messageEntry({
        role: "toolResult",
        toolName: "bash",
        content: [{ type: "text", text: "a" }, { type: "thinking", thinking: "x" }, { text: "b" }],
      }),
    );
    expect(string).toMatchObject({ kind: "tool", text: "ok" });
    expect(blocks).toMatchObject({ kind: "tool", text: "ab" });
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

describe("createFoldKey", () => {
  it("优先使用条目自带非空字符串 id", () => {
    const key = createFoldKey();
    expect(key({ id: "a" })).toBe("id:a");
    expect(key({ id: "b" })).toBe("id:b");
  });

  it("无字符串 id 的条目按对象身份获得稳定且彼此独立的键", () => {
    const key = createFoldKey();
    const noId = { type: "message" };
    const numericId = { id: 42 };
    const emptyId = { id: "" };
    const k = key(noId);

    expect(k).not.toBe("");
    expect(key(noId)).toBe(k);
    expect(key(numericId)).not.toBe(k);
    expect(key(emptyId)).not.toBe(k);
    expect(key(numericId)).not.toBe(key(emptyId));
  });

  it("追加新条目不改变既有条目的键（索引错位回归）", () => {
    const key = createFoldKey();
    const first = { type: "message" };
    const k1 = key(first);

    key({ type: "message" });
    key({ type: "message" });
    expect(key(first)).toBe(k1);
  });
});
