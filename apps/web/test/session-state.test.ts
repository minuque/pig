import { computed, reactive } from "vue";
import { describe, expect, it } from "vitest";
import {
  clampPanelWidth,
  isNearBottom,
  scrollStateFrom,
  sessionState,
} from "@features/sessions/session-state.js";
import type { SessionClientState } from "@features/sessions/session-state.js";

describe("workbench state", () => {
  it("clamps panel widths and detects whether transcript should follow", () => {
    expect(clampPanelWidth(100)).toBe(240);
    expect(clampPanelWidth(340)).toBe(340);
    expect(clampPanelWidth(600)).toBe(420);
    expect(isNearBottom(820, 100, 1000)).toBe(true);
    expect(isNearBottom(700, 100, 1000)).toBe(false);
  });

  it("keeps scroll and follow state isolated by session", () => {
    const states = new Map();
    const first = sessionState(states, "session-a");
    first.scrollTop = 320;
    first.following = false;
    first.hasNewActivity = true;

    expect(sessionState(states, "session-a")).toBe(first);
    expect(sessionState(states, "session-b")).toMatchObject({
      scrollTop: 0,
      following: true,
      hasNewActivity: false,
    });
  });

  it("state mutations are reactive (draft writes are tracked)", () => {
    const states = reactive(new Map<string, SessionClientState>());
    const draft = computed(() => sessionState(states, "s1").draft);
    const scrollTop = computed(() => sessionState(states, "s1").scrollTop);
    expect(draft.value).toBe("");
    sessionState(states, "s1").draft = "草稿";
    sessionState(states, "s1").scrollTop = 42;
    expect(draft.value).toBe("草稿");
    expect(scrollTop.value).toBe(42);
    // 各 Session 状态隔离：写入 s2 不影响 s1
    sessionState(states, "s2").draft = "另一份";
    expect(draft.value).toBe("草稿");
  });
});

describe("transcript scroll state contract", () => {
  it("derives following from position and clears new activity when near bottom", () => {
    expect(scrollStateFrom(820, 100, 1000, true)).toEqual({
      scrollTop: 820,
      following: true,
      hasNewActivity: false,
    });
    expect(scrollStateFrom(700, 100, 1000, true)).toEqual({
      scrollTop: 700,
      following: false,
      hasNewActivity: true,
    });
    expect(scrollStateFrom(700, 100, 1000, false)).toEqual({
      scrollTop: 700,
      following: false,
      hasNewActivity: false,
    });
  });
});
