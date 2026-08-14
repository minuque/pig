import { describe, expect, it } from "vitest";
import { chatMarkdownProps } from "@features/session-workbench/components/ConversationTurn.vue";

describe("chatMarkdownProps", () => {
  it("keeps chat mode for streaming and finished rows", () => {
    expect(chatMarkdownProps(true)).toMatchObject({
      customId: "chat",
      mode: "chat",
      final: false,
      smoothStreaming: "auto",
      typewriter: "simple",
      fade: false,
    });
    expect(chatMarkdownProps(false)).toMatchObject({
      customId: "chat",
      mode: "chat",
      final: true,
      smoothStreaming: false,
      typewriter: false,
      fade: false,
    });
  });
});
