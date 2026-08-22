import { describe, expect, it } from "vitest";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import {
  estimateTranscriptRowHeight,
  isTranscriptAtTop,
  transcriptRowContent,
  transcriptRowFinal,
  transcriptRowKind,
} from "@features/session-workbench/components/TranscriptView.vue";

function item(partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] }): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem;
}

describe("transcript row markstream mapping", () => {
  it("maps only assistant body to assistant-markdown", () => {
    const user = item({ role: "user", content: [{ type: "text", text: "问" }] });
    const agent = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    });
    const tool = item({ id: "t1", role: "tool", toolName: "bash", content: [] });
    expect(transcriptRowKind(user)).toBe("user-message");
    expect(transcriptRowKind(agent)).toBe("assistant-markdown");
    expect(transcriptRowKind(tool)).toBe("tool-call");
    expect(transcriptRowContent(user)).toBe("");
    expect(transcriptRowContent(agent)).toBe("答");
    expect(transcriptRowContent(tool)).toBe("");
    expect(transcriptRowFinal(agent)).toBe(true);
  });

  it("keeps streaming assistant rows live so the timeline can grow in place", () => {
    const streaming = item({
      id: "a1",
      role: "assistant",
      status: "streaming",
      content: [{ type: "text", text: "…" }],
    });
    expect(transcriptRowFinal(streaming)).toBe(false);
    expect(transcriptRowContent(streaming)).toBe("…");
  });
});

describe("estimateTranscriptRowHeight", () => {
  it("工具行固定矮，短助手行不低于 160，避免视口塞进过多未测行", () => {
    const tool = item({ id: "t1", role: "tool", toolName: "bash", content: [] });
    const short = item({
      id: "a1",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "答" }],
    });
    expect(estimateTranscriptRowHeight(tool)).toBe(48);
    expect(estimateTranscriptRowHeight(short)).toBe(160);
  });

  it("助手正文按约 48 字一行估高，长文封顶 960，思考摘要另加 36", () => {
    const tenLines = item({
      id: "a2",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "字".repeat(480) }],
    });
    const long = item({
      id: "a3",
      role: "assistant",
      status: "complete",
      content: [{ type: "text", text: "字".repeat(5000) }],
    });
    const withThink = item({
      id: "a4",
      role: "assistant",
      status: "complete",
      content: [
        { type: "thinking", thinking: "先想" },
        { type: "text", text: "字".repeat(480) },
      ],
    });
    expect(estimateTranscriptRowHeight(tenLines)).toBe(296);
    expect(estimateTranscriptRowHeight(long)).toBe(960);
    expect(estimateTranscriptRowHeight(withThink)).toBe(332);
  });

  it("用户行按约 36 字一行，硬换行分段折行", () => {
    const brief = item({ role: "user", content: [{ type: "text", text: "问" }] });
    const wrapped = item({ role: "user", content: [{ type: "text", text: "字".repeat(72) }] });
    const broken = item({
      role: "user",
      content: [{ type: "text", text: "甲\n乙\n丙" }],
    });
    expect(estimateTranscriptRowHeight(brief)).toBe(78);
    expect(estimateTranscriptRowHeight(wrapped)).toBe(100);
    expect(estimateTranscriptRowHeight(broken)).toBe(122);
  });
});

describe("isTranscriptAtTop", () => {
  it("离顶 48px 内视为置顶", () => {
    expect(isTranscriptAtTop(0)).toBe(true);
    expect(isTranscriptAtTop(48)).toBe(true);
    expect(isTranscriptAtTop(49)).toBe(false);
  });
});
