import { describe, expect, it } from "vitest"
import type { SessionMetadata } from "@/types/common-type.js"
import {
  ARCHIVE_GROUP_HEAD_FIRST_HEIGHT,
  ARCHIVE_GROUP_HEAD_HEIGHT,
  ARCHIVE_LOAD_MORE_HEIGHT,
  ARCHIVE_ROW_HEIGHT,
  archiveVirtualItemHeight,
  buildArchiveRows,
  collectProjectOptions,
  countArchiveTabs,
  countQuickRules,
  filterArchiveRows,
  flattenArchiveGroups,
  formatRelativeAge,
  groupArchiveRows,
  idsMatchingQuickRule,
  STALE_SESSION_MS,
  type ArchiveProjectView,
  type ArchiveSessionFoot,
} from "@features/settings/lib/archive-view.js"

const NOW = 1_800_000_000_000

function session(id: string, overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    id,
    createdAt: NOW - 10_000,
    updatedAt: NOW - 5_000,
    cwd: "/work/pig",
    sessionName: `Session ${id}`,
    ...overrides,
  }
}

describe("archive-view 纯计算逻辑", () => {
  it("按 inbox / archived 视图拆分并正确统计 Tab 数量与状态标记", () => {
    const sessions: SessionMetadata[] = [
      session("run", { updatedAt: NOW - 1_000 }),
      session("settled", { updatedAt: NOW - 2_000 }),
      session("err", { updatedAt: NOW - 3_000 }),
      session("old", { updatedAt: NOW - STALE_SESSION_MS - 1_000 }),
      session("arch", { updatedAt: NOW - 4_000 }),
    ]
    const cardFootById = new Map<string, ArchiveSessionFoot>([
      ["err", { messageCount: 4, model: undefined, state: "error" }],
      [
        "arch",
        {
          messageCount: 9,
          model: { provider: "anthropic", id: "claude-sonnet" },
          state: undefined,
        },
      ],
    ])

    expect(countArchiveTabs(sessions, { arch: NOW - 500 })).toEqual({ inbox: 4, archived: 1 })

    const inbox = buildArchiveRows({
      sessions,
      archives: { arch: NOW - 500 },
      settledIds: new Set(["settled"]),
      runningIds: new Set(["run"]),
      cardFootById,
      tab: "inbox",
      untitledLabel: "新对话",
      now: NOW,
    })

    expect(inbox.map((row) => [row.id, row.status, row.stale])).toEqual([
      ["run", "running", false],
      ["settled", "settled", false],
      ["err", "error", false],
      ["old", "idle", true],
    ])
    expect(countQuickRules(inbox)).toEqual({ stale: 1, settled: 1, error: 1 })
    expect(idsMatchingQuickRule(inbox, "stale")).toEqual(["old"])
    expect(idsMatchingQuickRule(inbox, "settled")).toEqual(["settled"])
    expect(idsMatchingQuickRule(inbox, "error")).toEqual(["err"])

    const archived = buildArchiveRows({
      sessions,
      archives: { arch: NOW - 500 },
      settledIds: new Set(),
      runningIds: new Set(),
      cardFootById,
      tab: "archived",
      untitledLabel: "新对话",
      now: NOW,
    })

    expect(archived.map((row) => row.id)).toEqual(["arch"])
    expect(archived[0]?.archivedAt).toBe(NOW - 500)
    expect(archived[0]?.provider).toBe("anthropic")
    expect(archived[0]?.model).toBe("claude-sonnet")
    expect(archived[0]?.messageCount).toBe(9)
  })

  it("按项目、关键词筛选并分组，running 行不进 selectableIds", () => {
    const sessions: SessionMetadata[] = [
      session("s1", { cwd: "/work/alpha", sessionName: "修 bug" }),
      session("s2", {
        cwd: "/work/alpha",
        sessionName: "写测试",
        updatedAt: NOW - STALE_SESSION_MS - 10,
      }),
      session("s3", { cwd: "/work/beta", sessionName: "修样式" }),
    ]
    const cardFootById = new Map<string, ArchiveSessionFoot>([
      [
        "s1",
        { messageCount: 2, model: { provider: "anthropic", id: "claude-opus" }, state: undefined },
      ],
    ])
    const rows = buildArchiveRows({
      sessions,
      archives: {},
      settledIds: new Set(),
      runningIds: new Set(["s1"]),
      cardFootById,
      tab: "inbox",
      untitledLabel: "新对话",
      now: NOW,
    })

    expect(filterArchiveRows(rows, "/work/alpha", "opus").map((r) => r.id)).toEqual(["s1"])
    expect(filterArchiveRows(rows, "", "修").map((r) => r.id)).toEqual(["s1", "s3"])

    const projectMap = new Map<string, ArchiveProjectView>([
      ["/work/alpha", { cwd: "/work/alpha", name: "alpha", monogram: "AL", tone: "indigo" }],
    ])
    const groups = groupArchiveRows(rows, projectMap)

    expect(groups).toHaveLength(2)
    expect(groups[0]?.project.name).toBe("alpha")
    expect(groups[0]?.selectableIds).toEqual(["s2"])
    expect(groups[0]?.staleIds).toEqual(["s2"])
    expect(groups[1]?.project.name).toBe("beta")

    expect(collectProjectOptions(sessions, projectMap).map((p) => p.name)).toEqual([
      "alpha",
      "beta",
    ])
  })

  it("按批截断扁平化分组并精确标记首尾圆角与加载更多项", () => {
    const sessions: SessionMetadata[] = [
      session("a1", { cwd: "/work/alpha", updatedAt: NOW - 1_000 }),
      session("a2", { cwd: "/work/alpha", updatedAt: NOW - 2_000 }),
      session("b1", { cwd: "/work/beta", updatedAt: NOW - 3_000 }),
      session("b2", { cwd: "/work/beta", updatedAt: NOW - 4_000 }),
    ]
    const rows = buildArchiveRows({
      sessions,
      archives: {},
      settledIds: new Set(),
      runningIds: new Set(),
      cardFootById: new Map(),
      tab: "inbox",
      untitledLabel: "新对话",
      now: NOW,
    })
    const groups = groupArchiveRows(rows, new Map())
    const partial = flattenArchiveGroups(groups, 3, rows.length)

    expect(partial.map((item) => item.kind)).toEqual([
      "group-head",
      "row",
      "row",
      "group-head",
      "row",
      "load-more",
    ])
    expect(partial.map((item) => archiveVirtualItemHeight(item))).toEqual([
      ARCHIVE_GROUP_HEAD_FIRST_HEIGHT,
      ARCHIVE_ROW_HEIGHT,
      ARCHIVE_ROW_HEIGHT,
      ARCHIVE_GROUP_HEAD_HEIGHT,
      ARCHIVE_ROW_HEIGHT,
      ARCHIVE_LOAD_MORE_HEIGHT,
    ])
    expect(partial[4]).toMatchObject({ kind: "row", key: "b1", isFirst: true, isLast: true })
    expect(partial[5]).toEqual({ kind: "load-more", key: "__load_more__", loaded: 3, total: 4 })

    const full = flattenArchiveGroups(groups, 10, rows.length)

    expect(full.some((item) => item.kind === "load-more")).toBe(false)
    expect(full.map((item) => item.key)).toEqual([
      "head:/work/alpha",
      "a1",
      "a2",
      "head:/work/beta",
      "b1",
      "b2",
    ])
  })

  it("按分/时/天/周/月格式化相对时间", () => {
    const t = (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${params.count}` : key

    expect(formatRelativeAge(NOW - 10_000, NOW, t)).toBe("settings.archive.justNow")
    expect(formatRelativeAge(NOW - 5 * 60_000, NOW, t)).toBe("settings.archive.minutesAgo:5")
    expect(formatRelativeAge(NOW - 3 * 3_600_000, NOW, t)).toBe("settings.archive.hoursAgo:3")
    expect(formatRelativeAge(NOW - 4 * 86_400_000, NOW, t)).toBe("settings.archive.daysAgo:4")
    expect(formatRelativeAge(NOW - 21 * 86_400_000, NOW, t)).toBe("settings.archive.weeksAgo:3")
    expect(formatRelativeAge(NOW - 90 * 86_400_000, NOW, t)).toBe("settings.archive.monthsAgo:3")
  })
})
