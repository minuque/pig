import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { ACCENT_STORAGE_KEY, paintAccent, readStoredAccent } from "@features/theme/lib/palette.js"
import { ACCENTS, DEFAULT_ACCENT_ID, findAccent, isAccentId } from "@features/theme/lib/accents.js"

const css = readFileSync(new URL("../../../src/style/app.css", import.meta.url), "utf8")

/** 取选择器块顶层的直接声明值，跳过嵌套块。 */
function values(selector: string): Map<string, string> {
  const lines = css.split("\n")
  const start = lines.findIndex((line) => line === `${selector} {`)
  const decls = new Map<string, string>()
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
  const props = new Map<string, string>()
  const state = { attr: null as string | null, json: null as string | null }
  return {
    props,
    get attr() {
      return state.attr
    },
    get json() {
      return state.json
    },
    setProperty: (name: string, value: string) => props.set(name, value),
    removeProperty: (name: string) => props.delete(name),
    setAttr: (_name: string, value: string | null) => {
      state.attr = value
    },
    store: (json: string | null) => {
      state.json = json
    },
  }
}

describe("accent 变量", () => {
  const root = values(":root")
  const dark = values(".dark")

  it(":root / .dark 都给了默认 indigo 的 7 个 accent 变量", () => {
    for (const key of ["9", "10", "11", "a3", "a4", "a6", "a9", "contrast"]) {
      expect(root.has(`accent-${key}`)).toBe(true)
      expect(dark.has(`accent-${key}`)).toBe(true)
    }
  })

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
})

describe("paintAccent", () => {
  it("写入每个 accent 变量、data-accent 和首帧缓存", () => {
    const painted = target()
    paintAccent(painted, "crimson", "light")
    const accent = findAccent("crimson")

    expect(painted.attr).toBe("crimson")
    expect(painted.props.get("--accent-9")).toBe(accent.light.step9)
    expect(painted.props.get("--accent-10")).toBe(accent.light.step10)
    expect(painted.props.get("--accent-11")).toBe(accent.light.step11)
    expect(painted.props.get("--accent-a3")).toBe(accent.light.a3)
    expect(painted.props.get("--accent-a4")).toBe(accent.light.a4)
    expect(painted.props.get("--accent-a6")).toBe(accent.light.a6)
    expect(painted.props.get("--accent-a9")).toBe(accent.light.a9)
    expect(painted.props.get("--accent-contrast")).toBe("var(--white)")
    expect(JSON.parse(painted.json ?? "")).toEqual({ id: "crimson" })
  })

  it("contrast 为 dark 的 accent 写前景色而不是白色", () => {
    const painted = target()
    paintAccent(painted, "amber", "dark")

    expect(painted.props.get("--accent-contrast")).toBe("var(--foreground)")
  })

  it("传 null 清除 accent，回到默认", () => {
    const painted = target()
    paintAccent(painted, "iris", "light")
    paintAccent(painted, null, "light")

    expect(painted.attr).toBeNull()
    expect(painted.props.size).toBe(0)
    expect(painted.json).toBeNull()
  })
})

describe("readStoredAccent", () => {
  it("读出存储的 accent id", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "iris" }))

    expect(readStoredAccent()).toBe("iris")
  })

  it("非法 id 返回 null", () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify({ id: "nope" }))

    expect(readStoredAccent()).toBeNull()
  })
})

describe("accents", () => {
  it("默认 accent 是 indigo", () => {
    expect(DEFAULT_ACCENT_ID).toBe("indigo")
    expect(isAccentId("indigo")).toBe(true)
    expect(isAccentId("nope")).toBe(false)
  })

  it("14 个 accent 都有浅深两份色表", () => {
    expect(ACCENTS).toHaveLength(14)

    for (const accent of ACCENTS) {
      expect(accent.light.step9).toMatch(/^#[0-9a-f]{6}$/i)
      expect(accent.dark.step9).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
