import { describe, expect, it } from "vitest"
import type { SidebarSession } from "@features/session-nav/type.js"
import { sessionGlyph } from "@features/session-nav/lib/status-cycle.js"

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
