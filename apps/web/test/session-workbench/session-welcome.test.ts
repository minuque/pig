import { describe, expect, it } from "vitest"
import {
  canSubmit,
  nextWelcomeWorkspaceId,
} from "@features/session-workbench/components/SessionWelcome.vue"
import { workbenchHeroLabel } from "@features/session-workbench/components/WorkbenchHero.vue"

describe("canSubmit", () => {
  const profile = { model: { provider: "openai", id: "gpt-5" }, thinkingLevel: "high" }

  it("有 workspace、preset 且未提交中即可", () => {
    expect(canSubmit("w1", profile, false)).toBe(true)
  })

  it("无 workspace 拒绝", () => {
    expect(canSubmit(undefined, profile, false)).toBe(false)
  })

  it("无 profile 拒绝", () => {
    expect(canSubmit("w1", undefined, false)).toBe(false)
  })

  it("提交中拒绝", () => {
    expect(canSubmit("w1", profile, true)).toBe(false)
  })
})

describe("nextWelcomeWorkspaceId", () => {
  it("当前选择仍在列表时保留", () => {
    expect(nextWelcomeWorkspaceId(["/a", "/b"], "/b", undefined)).toBe("/b")
  })

  it("否则回退到最近目录或第一个", () => {
    expect(nextWelcomeWorkspaceId(["/a", "/b"], undefined, "/b")).toBe("/b")
    expect(nextWelcomeWorkspaceId(["/a", "/b"], "/gone", "/gone")).toBe("/a")
    expect(nextWelcomeWorkspaceId(["/a"], undefined, undefined)).toBe("/a")
  })

  it("空列表返回 undefined", () => {
    expect(nextWelcomeWorkspaceId([], "/a", undefined)).toBeUndefined()
  })
})

describe("workbenchHeroLabel", () => {
  it("无目录时显示选择工作目录", () => {
    expect(workbenchHeroLabel(undefined)).toBe("选择工作目录")
  })

  it("有路径时用目录名作标题", () => {
    expect(workbenchHeroLabel("/repo/app")).toBe("app")
    expect(workbenchHeroLabel("C:\\repo\\app")).toBe("app")
  })
})
