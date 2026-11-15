import { describe, expect, it } from "vitest"
import { orderPinnedFirst, parseProjectPrefs } from "@features/session-nav/lib/project-prefs.js"

describe("orderPinnedFirst", () => {
  it("置顶项目按置顶顺序排前，其余保持原序", () => {
    const groups = ["/a", "/b", "/c", "/d"].map((canonicalPath) => ({ canonicalPath }))

    expect(orderPinnedFirst(groups, ["/c", "/a"]).map((group) => group.canonicalPath)).toEqual([
      "/c",
      "/a",
      "/b",
      "/d",
    ])
  })
})

describe("parseProjectPrefs", () => {
  it("丢掉不认识的图标和颜色，存储损坏时回落空配置", () => {
    expect(
      parseProjectPrefs({
        pinned: ["/a", 3],
        icons: {
          "/a": { name: "rocket", color: "green" },
          "/b": { name: "no-such-icon", color: "green" },
          "/c": { name: "rocket", color: "pink" },
        },
      }),
    ).toEqual({ pinned: ["/a"], icons: { "/a": { name: "rocket", color: "green" } } })
    expect(parseProjectPrefs("broken")).toEqual({ pinned: [], icons: {} })
  })
})
