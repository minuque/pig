import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ACCENT_ATTR,
  ACCENT_STORAGE_KEY,
  GRAY_ATTR,
  paintAccent,
  readStoredAccent,
} from "@features/theme/lib/palette.js"
import { ACCENTS, DEFAULT_ACCENT_ID, findAccent, isAccentId } from "@features/theme/lib/accents.js"

const css = readFileSync(new URL("../../../src/style/app.css", import.meta.url), "utf8")

/** 取选择器块顶层的直接声明值，跳过嵌套块。 */
function values(selector: string): Map<string, string> {
  const lines = css.split("\n")
  const start = lines.findIndex((line) => line === `${selector} {`)
  const decls = new Map<string, string>()

  if (start < 0) return decls

  let depth = 0

  for (const line of lines.slice(start + 1)) {
    if (line.includes("{")) depth++

    if (line.includes("}")) {
      if (depth === 0) break
      depth--
      continue
    }

    const decl = depth === 0 ? /^\s*--([\w-]+):\s*([^;]+);/.exec(line) : null

    if (decl?.[1] && decl[2]) decls.set(decl[1], decl[2].trim())
  }

  return decls
}

function target() {
  const attrs = new Map<string, string>()
  const state = { json: null as string | null }
  return {
    attrs,
    get json() {
      return state.json
    },
    setAttr: (name: string, value: string | null) => {
      if (value) attrs.set(name, value)
      else attrs.delete(name)
    },
    store: (json: string | null) => {
      state.json = json
    },
  }
}

describe("accent 变量", () => {
  const root = values(":root")

  it("语义层把 --primary / --link / 选区 / 焦点环指到 --accent-*", () => {
    expect(root.get("primary")).toBe("var(--accent-9)")
    expect(root.get("primary-active")).toBe("var(--accent-10)")
    expect(root.get("primary-foreground")).toBe("var(--accent-contrast)")
    expect(root.get("link")).toBe("var(--accent-11)")
    expect(root.get("info")).toBe("var(--accent-11)")
    expect(root.get("info-bg")).toBe("var(--accent-a3)")
    expect(root.get("info-halo")).toBe("var(--accent-a4)")
    expect(root.get("selection-bg")).toBe("var(--accent-a6)")
    expect(root.get("focus-ring")).toContain("var(--accent-a4)")
  })

  it("色值不再写在本文件：--accent-* 由 data-accent-color 映射", () => {
    expect(root.has("accent-9")).toBe(false)
    expect(root.has("accent-contrast")).toBe(false)
  })
})

describe("paintAccent", () => {
  it("写 data-accent-color 与对应的中性色族，并缓存选择", () => {
    const painted = target()
    paintAccent(painted, "teal")

    expect(painted.attrs.get(ACCENT_ATTR)).toBe("teal")
    expect(painted.attrs.get(GRAY_ATTR)).toBe(findAccent("teal").gray)
    expect(JSON.parse(painted.json ?? "")).toEqual({ id: "teal" })
  })

  it("传 null 回到默认 accent 并清掉缓存", () => {
    const painted = target()
    paintAccent(painted, "red")
    paintAccent(painted, null)

    expect(painted.attrs.get(ACCENT_ATTR)).toBe(DEFAULT_ACCENT_ID)
    expect(painted.attrs.get(GRAY_ATTR)).toBe(findAccent(DEFAULT_ACCENT_ID).gray)
    expect(painted.json).toBeNull()
  })
})

describe("readStoredAccent", () => {
  it("读出存储的 accent id", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "blue" }))

    expect(readStoredAccent()).toBe("blue")
  })

  it("已下线的 accent 与非法 id 都返回 null", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "iris" }))
    expect(readStoredAccent()).toBeNull()

    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "nope" }))
    expect(readStoredAccent()).toBeNull()
  })
})

describe("accents", () => {
  it("默认 accent 是 indigo", () => {
    expect(DEFAULT_ACCENT_ID).toBe("indigo")
    expect(isAccentId("indigo")).toBe(true)
    expect(isAccentId("iris")).toBe(false)
  })

  it("6 套 accent 各自有中性色族，id 与标签不重复", () => {
    expect(ACCENTS).toHaveLength(6)
    expect(new Set(ACCENTS.map((accent) => accent.id)).size).toBe(6)

    for (const accent of ACCENTS) {
      expect(accent.label.length).toBeGreaterThan(0)
      expect(["slate", "sage", "sand", "mauve"]).toContain(accent.gray)
    }
  })
})
