import { describe, expect, it } from "vitest"
import type { SidebarSession } from "@features/session-nav/type.js"
import {
  FOOTER_STATUSES,
  nextInCycle,
  sessionGlyph,
  statusBuckets,
} from "@features/session-nav/lib/status-cycle.js"

function session(id: string, draft = false): SidebarSession {
  return { id, title: id, updatedAt: 0, draft }
}

describe("sessionGlyph", () => {
  it("按运行中 > 未读 > 草稿 > 错误取图标", () => {
    expect(sessionGlyph(session("a"), "running")).toBe("running")
    expect(sessionGlyph(session("a", true), "running")).toBe("running")
    expect(sessionGlyph(session("a", true), "unread")).toBe("unread")
    expect(sessionGlyph(session("a", true), "error")).toBe("draft")
    expect(sessionGlyph(session("a"), "error")).toBe("error")
    expect(sessionGlyph(session("a"), undefined)).toBeUndefined()
  })
})

describe("statusBuckets", () => {
  it("只分页脚三个状态，保持原顺序", () => {
    const sessions = [session("run-1"), session("read-1"), session("draft-1", true), session("bad")]
    const buckets = statusBuckets(
      sessions,
      new Map([
        ["run-1", { state: "running" as const }],
        ["read-1", { state: "unread" as const }],
        ["bad", { state: "error" as const }],
      ]),
    )

    expect(FOOTER_STATUSES.map((status) => buckets[status].map((item) => item.id))).toEqual([
      ["run-1"],
      ["read-1"],
      ["draft-1"],
    ])
  })
})

describe("nextInCycle", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }]

  it("当前在池里就取下一个，末尾回到开头", () => {
    expect(nextInCycle(items, "a")?.id).toBe("b")
    expect(nextInCycle(items, "c")?.id).toBe("a")
  })

  it("当前不在池里或没有当前项时从第一个开始", () => {
    expect(nextInCycle(items, "z")?.id).toBe("a")
    expect(nextInCycle(items)?.id).toBe("a")
  })

  it("空池返回 undefined", () => {
    expect(nextInCycle([], "a")).toBeUndefined()
  })
})
