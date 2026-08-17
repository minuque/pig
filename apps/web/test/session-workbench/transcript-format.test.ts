import { describe, expect, it } from "vitest";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import {
  conversationRows,
  projectTranscriptItem,
  toolStatusLabel,
} from "@features/session-workbench/lib/transcript-format.js";

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

describe("conversationRows", () => {
  it("keeps user/agent messages and collapses tools to one-line summaries", () => {
    const user = item({ id: "u1", role: "user", content: [{ type: "text", text: "问" }] });
    const tool = item({
      id: "t1",
      role: "tool",
      toolName: "bash",
      status: "complete",
      isError: false,
      content: [{ type: "text", text: "lots of output" }],
    });
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    });
    const rows = conversationRows([user, tool, agent]);
    expect(rows.map((row) => row.kind)).toEqual(["message", "tool-summary", "message"]);
    expect(rows[1]).toMatchObject({
      kind: "tool-summary",
      part: { kind: "tool", name: "bash" },
    });
    expect(rows[0]?.kind === "message" && rows[0].part.kind).toBe("user");
  });

  it("skips items without a visible projection", () => {
    expect(conversationRows([item({ role: "assistant", content: [] })])).toEqual([]);
  });
});

describe("toolStatusLabel", () => {
  it("maps official status, with isError winning over complete", () => {
    expect(toolStatusLabel("running")).toBe("运行中");
    expect(toolStatusLabel("streaming")).toBe("运行中");
    expect(toolStatusLabel("complete")).toBe("完成");
    expect(toolStatusLabel("complete", true)).toBe("出错");
    expect(toolStatusLabel("error")).toBe("出错");
    expect(toolStatusLabel("aborted")).toBe("已中止");
  });
});
