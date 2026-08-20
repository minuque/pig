import { describe, expect, it } from "vitest";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import {
  formatRelativeTime,
  groupSessionsByCwd,
  listSessionsForSidebar,
  searchSessionsByTitle,
  sessionTitle,
  sortSessionsForSidebar,
  workspaceName,
} from "@features/session-nav/types.js";

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
    expect(formatRelativeTime(now - 48 * 60_000, now)).toBe("48m");
    expect(formatRelativeTime(now - 2 * 60 * 60_000, now)).toBe("2h");
    expect(formatRelativeTime(now - 26 * 60 * 60_000, now)).toBe("1d");
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

describe("session-dimension list", () => {
  it("lists all cwd sessions newest-created first when unscoped", () => {
    const sessions: SessionMetadata[] = [
      { id: "old", createdAt: 1, cwd: "/b", updatedAt: 90 },
      { id: "new", createdAt: 3, cwd: "/a" },
      { id: "mid", createdAt: 2, cwd: "/a", updatedAt: 80 },
      { id: "orphan", createdAt: 4 },
    ];
    expect(listSessionsForSidebar(sessions, null).map((session) => session.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("filters to one cwd without changing creation order", () => {
    const sessions: SessionMetadata[] = [
      { id: "b", createdAt: 1, cwd: "/b" },
      { id: "a2", createdAt: 3, cwd: "/a" },
      { id: "a1", createdAt: 2, cwd: "/a" },
    ];
    expect(listSessionsForSidebar(sessions, "/a").map((session) => session.id)).toEqual([
      "a2",
      "a1",
    ]);
  });

  it("does not reorder by activity", () => {
    expect(
      sortSessionsForSidebar([
        { id: "older", createdAt: 1, updatedAt: 100, cwd: "/a" },
        { id: "newer", createdAt: 2, cwd: "/a" },
      ]).map((session) => session.id),
    ).toEqual(["newer", "older"]);
  });

  it("searches titles only and keeps input order", () => {
    const sessions: SessionMetadata[] = [
      { id: "a", createdAt: 1, sessionName: "Casual Greeting", cwd: "/a" },
      { id: "b", createdAt: 2, sessionName: "Friendly Greeting", cwd: "/b" },
      { id: "c", createdAt: 3, cwd: "/a" },
    ];
    expect(searchSessionsByTitle(sessions, "").map((session) => session.id)).toEqual([]);
    expect(searchSessionsByTitle(sessions, "greeting").map((session) => session.id)).toEqual([
      "a",
      "b",
    ]);
    expect(searchSessionsByTitle(sessions, "新会话").map((session) => session.id)).toEqual(["c"]);
  });
});
