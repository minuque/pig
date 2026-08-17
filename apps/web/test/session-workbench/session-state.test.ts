import { computed, reactive } from "vue";
import { describe, expect, it } from "vitest";
import type { MarkstreamThreadVirtualState } from "markstream-vue";
import { sessionState } from "@features/session-workbench/lib/session-state.js";
import type { SessionClientState } from "@features/session-workbench/lib/session-state.js";

function mockThreadState(threadKey = "s"): MarkstreamThreadVirtualState {
  return { threadKey, itemHeights: {}, markdownStates: {} };
}

describe("workbench state", () => {
  it("keeps thread state isolated by session", () => {
    const states = new Map();
    const first = sessionState(states, "session-a");
    first.threadState = mockThreadState("session-a");

    expect(sessionState(states, "session-a")).toBe(first);
    expect(sessionState(states, "session-b")).toMatchObject({ draft: "", threadState: null });
  });

  it("state mutations are reactive (draft and threadState writes are tracked)", () => {
    const states = reactive(new Map<string, SessionClientState>());
    const draft = computed(() => sessionState(states, "s1").draft);
    const threadState = computed(() => sessionState(states, "s1").threadState);
    expect(draft.value).toBe("");
    expect(threadState.value).toBeNull();
    sessionState(states, "s1").draft = "草稿";
    sessionState(states, "s1").threadState = mockThreadState("s1");
    expect(draft.value).toBe("草稿");
    expect(threadState.value?.threadKey).toBe("s1");
    // 各 Session 状态隔离：写入 s2 不影响 s1
    sessionState(states, "s2").draft = "另一份";
    expect(draft.value).toBe("草稿");
  });
});
