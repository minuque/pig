import { describe, expect, it } from "vitest"
import { LAYOUT_VERSION, parseLayout, resolvePositions, serializeLayout } from "@/canvas/layout.js"

const ids = new Set(["button-default", "alert-error"])
const themeIds = new Set(["pig", "github", "dracula"])

describe("画布布局存档", () => {
  it("读出当前条目的镜头、主题和位置，丢掉过期 id", () => {
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      camera: { x: 8, y: 12, zoom: 1.5 },
      theme: { scheme: "dark", themeId: "github" },
      positions: {
        "button-default": { x: 3, y: 4 },
        stale: { x: 9, y: 9 },
      },
      membership: ["hidden"],
    })

    expect(parseLayout(raw, { ids, themeIds })).toEqual({
      camera: { x: 8, y: 12, zoom: 1.5 },
      theme: { scheme: "dark", themeId: "github" },
      appTheme: null,
      positions: { "button-default": { x: 3, y: 4 } },
    })
  })

  it("旧版本只保留仍然有效的镜头、主题和位置", () => {
    const raw = JSON.stringify({
      version: 0,
      camera: { x: 1, y: 2, zoom: 1 },
      theme: { scheme: "light", themeId: "pig" },
      positions: { "alert-error": { x: 5, y: 6 } },
      names: { "alert-error": "改名" },
      hidden: ["button-default"],
    })
    const parsed = parseLayout(raw, { ids, themeIds })
    expect(parsed?.camera).toEqual({ x: 1, y: 2, zoom: 1 })
    expect(parsed?.theme).toEqual({ scheme: "light", themeId: "pig" })
    expect(parsed?.positions).toEqual({ "alert-error": { x: 5, y: 6 } })
    expect(parsed).not.toHaveProperty("hidden")
  })

  it("未知版本、坏 JSON 和超长文档用默认值", () => {
    expect(parseLayout("{", { ids, themeIds })).toBeNull()
    expect(
      parseLayout(JSON.stringify({ version: 9, camera: { x: 1, y: 1, zoom: 1 } }), {
        ids,
        themeIds,
      }),
    ).toBeNull()
    expect(parseLayout("x".repeat(100_001), { ids, themeIds })).toBeNull()
  })

  it("不支持的主题不覆盖，镜头仍可用", () => {
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      camera: { x: 0, y: 0, zoom: 2 },
      theme: { scheme: "dark", themeId: "nope" },
      positions: {},
    })

    expect(parseLayout(raw, { ids, themeIds })?.theme).toBeNull()
    expect(parseLayout(raw, { ids, themeIds })?.camera?.zoom).toBe(2)
  })

  it("新条目避开已保存的块，已保存的位置不动", () => {
    const items = [
      { id: "button-default", x: 24, y: 24, width: 120, height: 80 },
      { id: "alert-error", x: 24, y: 24, width: 120, height: 80 },
    ]
    const placed = resolvePositions(items, { "button-default": { x: 24, y: 24 } })
    expect(placed["button-default"]).toEqual({ x: 24, y: 24 })
    expect(placed["alert-error"]).not.toEqual({ x: 24, y: 24 })
  })

  it("序列化不写入成员名单或名称", () => {
    const raw = serializeLayout({
      camera: { x: 0, y: 0, zoom: 1 },
      theme: null,
      appTheme: { scheme: "auto", themeId: null },
      positions: { "button-default": { x: 1, y: 2 } },
    })
    const parsed = JSON.parse(raw) as Record<string, unknown>
    expect(parsed.version).toBe(LAYOUT_VERSION)
    expect(parsed).not.toHaveProperty("membership")
    expect(parsed).not.toHaveProperty("names")
  })
})
