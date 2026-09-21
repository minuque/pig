import type { SessionMetadata } from "@earendil-works/pi-protocol"
import { describe, expect, it } from "vitest"

import { recentSessionCwd } from "../src/pi/service.js"

const session = (
  id: string,
  createdAt: number,
  updatedAt?: number,
  cwd?: string,
): SessionMetadata => ({
  id,
  createdAt,
  ...(updatedAt === undefined ? {} : { updatedAt }),
  ...(cwd === undefined ? {} : { cwd }),
})

/** 网关启动时预热哪个目录：防的是退回固定目录，或挑到没有 cwd 的会话。 */
describe("recentSessionCwd", () => {
  it("取最近使用过的会话目录", () => {
    const sessions = [session("old", 1_000, 2_000, "C:/a"), session("new", 1_500, 3_000, "C:/b")]

    expect(recentSessionCwd(sessions)).toBe("C:/b")
  })

  it("没有 updatedAt 时按创建时间比较", () => {
    const sessions = [
      session("old", 1_000, undefined, "C:/a"),
      session("new", 2_000, undefined, "C:/b"),
    ]

    expect(recentSessionCwd(sessions)).toBe("C:/b")
  })

  it("跳过没有 cwd 的会话", () => {
    const sessions = [session("new", 2_000, 3_000), session("old", 1_000, 2_000, "C:/a")]

    expect(recentSessionCwd(sessions)).toBe("C:/a")
    expect(recentSessionCwd([session("new", 2_000, 3_000)])).toBeUndefined()
    expect(recentSessionCwd([])).toBeUndefined()
  })
})
