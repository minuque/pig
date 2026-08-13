import { describe, expect, it } from "vitest";
import type { SessionMetadata, SessionSnapshot, TranscriptItem } from "@earendil-works/pi-protocol";
import { projectSessionSnapshot } from "../src/features/sessions/session-state.js";
import { projectTranscriptItem } from "../src/features/sessions/transcript-format.js";
import { groupSessionsByCwd, workspaceName } from "../src/features/sessions/types.js";

function userItem(text: string): TranscriptItem {
  return {
    id: `u-${text}`,
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 1,
  };
}
function assistantItem(text: string, thinking: string[] = []): TranscriptItem {
  return {
    id: `a-${text}`,
    role: "assistant",
    content: [
      ...(text ? [{ type: "text" as const, text }] : []),
      ...thinking.map((value) => ({ type: "thinking" as const, thinking: value })),
    ],
    model: { provider: "test", id: "model" },
    timestamp: 2,
    status: "complete",
    stopReason: "stop",
  };
}
function toolItem(name: string, text: string, isError = false): TranscriptItem {
  return {
    id: `t-${name}`,
    role: "tool",
    toolCallId: `call-${name}`,
    toolName: name,
    input: {},
    content: text ? [{ type: "text", text }] : [],
    timestamp: 3,
    status: isError ? "error" : "complete",
    isError,
  } as TranscriptItem; // 判别联合由 status 分支，测试 fixture 直接断言
}

describe("projectTranscriptItem", () => {
  it("projects user text", () => {
    expect(projectTranscriptItem(userItem("你好"))).toEqual({ kind: "user", text: "你好" });
  });
  it("projects assistant text with thinking blocks, keeping status", () => {
    expect(projectTranscriptItem(assistantItem("回答", ["思考一"]))).toEqual({
      kind: "agent",
      text: "回答",
      thinking: ["思考一"],
      status: "complete",
    });
  });
  it("projects tool items with error flag, keeping status", () => {
    expect(projectTranscriptItem(toolItem("bash", "ok"))).toEqual({
      kind: "tool",
      name: "bash",
      isError: false,
      text: "ok",
      status: "complete",
    });
    expect(projectTranscriptItem(toolItem("bash", "", true))).toMatchObject({
      kind: "tool",
      name: "bash",
      isError: true,
    });
  });
  it("keeps running/error/aborted status on agent items", () => {
    const running = { ...assistantItem("写一半"), status: "streaming" };
    expect(projectTranscriptItem(running as TranscriptItem)).toMatchObject({
      kind: "agent",
      status: "streaming",
    });
    const error = { ...assistantItem("失败"), status: "error" };
    expect(projectTranscriptItem(error as TranscriptItem)).toMatchObject({
      kind: "agent",
      status: "error",
    });
    const aborted = { ...assistantItem("中止"), status: "aborted" };
    expect(projectTranscriptItem(aborted as TranscriptItem)).toMatchObject({
      kind: "agent",
      status: "aborted",
    });
  });
  it("drops items without visible content", () => {
    expect(projectTranscriptItem(assistantItem("", []))).toBeUndefined();
  });
});

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
    expect(projection.name).toBe(`Session ${"s1".slice(0, 8)}`);
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

describe("workspaceName and grouping", () => {
  it("uses the last path segment as display name", () => {
    expect(workspaceName("/repo/app/src")).toBe("src");
    expect(workspaceName("C:\\repo\\app")).toBe("app");
    expect(workspaceName("/")).toBe("/");
  });
  it("groups sessions by cwd, following local workspace order", () => {
    const sessions: SessionMetadata[] = [
      { id: "s1", createdAt: 1, cwd: "/b" },
      { id: "s2", createdAt: 2, cwd: "/a" },
      { id: "s3", createdAt: 3 },
    ];
    const groups = groupSessionsByCwd(sessions, ["/a", "/b"]);
    expect(groups).toEqual([
      { canonicalPath: "/a", sessions: [{ id: "s2", createdAt: 2, cwd: "/a" }] },
      { canonicalPath: "/b", sessions: [{ id: "s1", createdAt: 1, cwd: "/b" }] },
    ]);
  });
  it("keeps empty local workspaces as groups", () => {
    const groups = groupSessionsByCwd([{ id: "s1", createdAt: 1, cwd: "/a" }], ["/a", "/empty"]);
    expect(groups).toEqual([
      { canonicalPath: "/a", sessions: [{ id: "s1", createdAt: 1, cwd: "/a" }] },
      { canonicalPath: "/empty", sessions: [] },
    ]);
  });
});
