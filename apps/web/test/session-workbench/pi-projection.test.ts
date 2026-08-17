import { describe, expect, it } from "vitest";
import type { SessionMetadata, SessionSnapshot, TranscriptItem } from "@earendil-works/pi-protocol";
import { projectSessionSnapshot } from "@features/session-workbench/lib/session-state.js";
import {
  formatRelativeTime,
  groupSessionsByCwd,
  initialExpandedWorkspace,
  sessionTitle,
  workspaceName,
} from "@features/session-nav/types.js";

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
      {
        canonicalPath: "/a",
        sessions: [{ id: "s2", createdAt: 2, cwd: "/a" }],
        authorized: true,
      },
      {
        canonicalPath: "/b",
        sessions: [{ id: "s1", createdAt: 1, cwd: "/b" }],
        authorized: true,
      },
    ]);
  });
  it("sorts sessions in a group by recency", () => {
    const groups = groupSessionsByCwd(
      [
        { id: "old", createdAt: 1, cwd: "/a" },
        { id: "new", createdAt: 2, updatedAt: 9, cwd: "/a" },
      ],
      ["/a"],
    );
    expect(groups[0]?.sessions.map((session) => session.id)).toEqual(["new", "old"]);
  });

  it("titles unnamed sessions as 新会话", () => {
    expect(sessionTitle({})).toBe("新会话");
    expect(sessionTitle({ sessionName: "  卸载插件  " })).toBe("卸载插件");
  });

  it("formats compact relative time", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    expect(formatRelativeTime(now - 20_000, now)).toBe("刚刚");
    expect(formatRelativeTime(now - 48 * 60_000, now)).toBe("48分钟");
    expect(formatRelativeTime(now - 2 * 60 * 60_000, now)).toBe("2小时");
    expect(formatRelativeTime(now - 26 * 60 * 60_000, now)).toBe("昨天");
  });

  it("expands only lastCwd when present, otherwise none", () => {
    const groups = [{ canonicalPath: "/a" }, { canonicalPath: "/b" }];
    expect(initialExpandedWorkspace(groups, "/b")).toBe("/b");
    expect(initialExpandedWorkspace(groups, "/gone")).toBeUndefined();
    expect(initialExpandedWorkspace([], "/a")).toBeUndefined();
  });

  it("keeps empty local workspaces and appends sessions from other cwd", () => {
    const groups = groupSessionsByCwd(
      [
        { id: "s1", createdAt: 1, cwd: "/a" },
        { id: "s2", createdAt: 2, cwd: "/other" },
      ],
      ["/a", "/empty"],
    );
    expect(groups).toEqual([
      {
        canonicalPath: "/a",
        sessions: [{ id: "s1", createdAt: 1, cwd: "/a" }],
        authorized: true,
      },
      { canonicalPath: "/empty", sessions: [], authorized: true },
      {
        canonicalPath: "/other",
        sessions: [{ id: "s2", createdAt: 2, cwd: "/other" }],
        authorized: false,
      },
    ]);
  });
});
