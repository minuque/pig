import { describe, expect, it } from "vitest";
import type { SessionSnapshot, TranscriptItem } from "@earendil-works/pi-protocol";
import { projectSessionSnapshot } from "@features/session-workbench/lib/session-state.js";

function userItem(text: string): TranscriptItem {
  return {
    id: `u-${text}`,
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 1,
  };
}
describe("projectSessionSnapshot", () => {
  function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
    return {
      id: "s1",
      cwd: "/repo",
      createdAt: 1,
      updatedAt: 2,
      phase: "idle",
      model: { provider: "test", id: "model" },
      thinkingLevel: "medium",
      attached: true,
      locked: false,
      revision: 1,
      transcript: [userItem("hi")],
      queuedSteer: [],
      queuedSteerCount: 0,
      ...overrides,
    };
  }
  it("derives display fields and default name", () => {
    const projection = projectSessionSnapshot(snapshot());
    expect(projection.name).toBe("新会话");
    expect(projection.cwd).toBe("/repo");
    expect(projection.running).toBe(false);
  });
  it("marks non-idle phases as running and counts queued steer", () => {
    const projection = projectSessionSnapshot(
      snapshot({ phase: "turn", queuedSteerCount: 2, transcript: [] }),
    );
    expect(projection.running).toBe(true);
    expect(projection.queuedSteerCount).toBe(2);
  });
});
