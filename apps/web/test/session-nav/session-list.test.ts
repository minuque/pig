import { describe, expect, it } from "vitest";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import {
  formatRelativeTime,
  sessionTitle,
  workspaceName,
  workspaceScopeLabel,
} from "@features/session-nav/format.js";
import {
  groupSessionsByCwd,
  listSessionsForSidebar,
  modelDisplayNames,
  pruneProjectScope,
  sessionCardFoot,
  sessionModelLabel,
  sortSessionsForSidebar,
  toggleProjectScope,
} from "@features/session-nav/sidebar.js";

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

  it("merges live Windows cwd into the canonical local workspace group", () => {
    const groups = groupSessionsByCwd(
      [{ id: "open", createdAt: 1, cwd: "G:\\AICode\\pig" }],
      ["g:/AICode/pig"],
    );
    expect(groups).toEqual([
      {
        canonicalPath: "g:/AICode/pig",
        sessions: [{ id: "open", createdAt: 1, cwd: "G:\\AICode\\pig" }],
        authorized: true,
      },
    ]);
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
    expect(listSessionsForSidebar(sessions, []).map((session) => session.id)).toEqual([
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
    expect(listSessionsForSidebar(sessions, ["/a"]).map((session) => session.id)).toEqual([
      "a2",
      "a1",
    ]);
  });

  it("filters to several cwds and keeps creation order", () => {
    const sessions: SessionMetadata[] = [
      { id: "b", createdAt: 1, cwd: "/b" },
      { id: "a2", createdAt: 3, cwd: "/a" },
      { id: "c", createdAt: 4, cwd: "/c" },
      { id: "a1", createdAt: 2, cwd: "/a" },
    ];
    expect(listSessionsForSidebar(sessions, ["/a", "/c"]).map((session) => session.id)).toEqual([
      "c",
      "a2",
      "a1",
    ]);
  });

  it("treats live Windows cwd and canonical workspace path as the same filter", () => {
    const sessions: SessionMetadata[] = [
      { id: "open", createdAt: 2, cwd: "G:\\AICode\\pig" },
      { id: "other", createdAt: 1, cwd: "/elsewhere" },
    ];
    expect(
      listSessionsForSidebar(sessions, ["g:/AICode/pig"]).map((session) => session.id),
    ).toEqual(["open"]);
  });

  it("toggles a path into and out of the scope set", () => {
    expect(toggleProjectScope([], "/a")).toEqual(["/a"]);
    expect(toggleProjectScope(["/a"], "/a")).toEqual([]);
    expect(toggleProjectScope(["g:/AICode/pig"], "G:\\AICode\\pig")).toEqual([]);
    expect(toggleProjectScope(["/a"], "/b")).toEqual(["/a", "/b"]);
  });

  it("drops scoped paths that are no longer in the group list", () => {
    expect(pruneProjectScope(["/a", "/gone"], ["/a", "/b"])).toEqual(["/a"]);
    expect(pruneProjectScope(["/gone"], ["/a"])).toEqual([]);
  });

  it("labels empty as all, one as the folder name, many as a count", () => {
    expect(workspaceScopeLabel([])).toBe("全部工作目录");
    expect(workspaceScopeLabel(["/repo/app"])).toBe("app");
    expect(workspaceScopeLabel(["/a", "/b"])).toBe("2 个工作目录");
  });

  it("does not reorder by activity", () => {
    expect(
      sortSessionsForSidebar([
        { id: "older", createdAt: 1, updatedAt: 100, cwd: "/a" },
        { id: "newer", createdAt: 2, cwd: "/a" },
      ]).map((session) => session.id),
    ).toEqual(["newer", "older"]);
  });
});

describe("session card foot", () => {
  it("uses catalog name and live overlay for the open session", () => {
    const extras = new Map([
      ["s1", { messageCount: 2, model: { provider: "openai", id: "gpt-4" } }],
      ["s2", { messageCount: 9, model: { provider: "openai", id: "o3" } }],
    ]);
    const names = modelDisplayNames([
      {
        id: "openai",
        models: [
          { id: "gpt-4", name: "GPT-4" },
          { id: "o3", name: "o3" },
        ],
      },
    ]);
    expect(sessionCardFoot("s1", extras, undefined, names)).toEqual({
      messageCount: 2,
      modelLabel: "GPT-4",
      modelProvider: "openai",
    });
    expect(
      sessionCardFoot(
        "s1",
        extras,
        { sessionId: "s1", messageCount: 5, model: { provider: "openai", id: "o3" } },
        names,
      ),
    ).toEqual({ messageCount: 5, modelLabel: "o3", modelProvider: "openai" });
    expect(sessionModelLabel({ provider: "x", id: "unknown" }, names)).toBe("unknown");
  });

  it("live 截断 transcript 不得把卡片条数改小", () => {
    // extras 193 是卡片全量；live 40 是快照窗口。Math.max 避免侧栏显示成 40。
    // 新消息刷出时 live 可能大于 extras，仍取较大值。
    const extras = new Map([
      ["s1", { messageCount: 193, model: { provider: "openai", id: "gpt-4" } }],
    ]);
    const names = modelDisplayNames([{ id: "openai", models: [{ id: "gpt-4", name: "GPT-4" }] }]);
    expect(
      sessionCardFoot(
        "s1",
        extras,
        { sessionId: "s1", messageCount: 40, model: { provider: "openai", id: "gpt-4" } },
        names,
      ),
    ).toEqual({ messageCount: 193, modelLabel: "GPT-4", modelProvider: "openai" });
  });
});
