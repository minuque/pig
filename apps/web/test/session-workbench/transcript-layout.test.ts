import { describe, expect, it } from "vitest";
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import {
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
