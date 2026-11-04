import { describe, expect, it } from "vitest"

import { matchSettings, type SettingsSearchEntry } from "@features/settings/lib/settings-search.js"

const entries: SettingsSearchEntry[] = [
  { id: "a", pane: "general", title: "Language", section: "Interface" },
  { id: "b", pane: "general", title: "字体大小", section: "界面" },
  { id: "c", pane: "models", title: "Providers", section: "Models" },
]

describe("matchSettings", () => {
  it("空白查询不返回结果", () => {
    expect(matchSettings(entries, "")).toEqual([])
    expect(matchSettings(entries, "   ")).toEqual([])
  })

  it("按标题匹配，忽略大小写与首尾空白", () => {
    expect(matchSettings(entries, " lang ").map((entry) => entry.id)).toEqual(["a"])
  })

  it("按分组名匹配", () => {
    expect(matchSettings(entries, "interface").map((entry) => entry.id)).toEqual(["a"])
    expect(matchSettings(entries, "界").map((entry) => entry.id)).toEqual(["b"])
  })

  it("标题和分组都不含关键词时没有结果", () => {
    expect(matchSettings(entries, "keyboard")).toEqual([])
  })
})
