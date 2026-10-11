import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  paintTheme,
  THEME_ROLES,
  themeVar,
  type ThemeColors,
  type ThemeTarget,
} from "@features/theme/lib/palette.js"

const css = readFileSync(new URL("../../../src/style/app.css", import.meta.url), "utf8")

/** 取选择器块顶层的直接声明，跳过嵌套块。 */
function declared(selector: string): Set<string> {
  const lines = css.split("\n")
  const start = lines.findIndex((line) => line === `${selector} {`)
  const names = new Set<string>()
  let depth = 0

  for (const line of lines.slice(start + 1)) {
    if (line.includes("{")) depth++

    if (line.includes("}")) {
      if (depth === 0) break
      depth--
      continue
    }

    const decl = depth === 0 ? /^\s*--([\w-]+):/.exec(line) : null
    const name = decl?.[1]

    if (name) names.add(name)
  }

  return names
}

describe("主题角色", () => {
  const root = declared(":root")
  const dark = declared(".dark")
  const themed = declared("html[data-theme-id]")

  it("每个角色在 :root 和 .dark 都有默认值", () => {
    const missing = THEME_ROLES.filter((role) => !root.has(role) || !dark.has(role))
    expect(missing).toEqual([])
  })

  it("指向块覆盖每个角色，且只覆盖角色", () => {
    expect([...themed].sort()).toEqual([...THEME_ROLES].sort())
  })

  it("指向块把角色指到注入变量", () => {
    for (const role of THEME_ROLES) {
      expect(css).toContain(`--${role}: var(${themeVar(role)});`)
    }
  })
})

const sample = Object.fromEntries(THEME_ROLES.map((role) => [role, "#123456"])) as ThemeColors

function target(): ThemeTarget & {
  props: Map<string, string>
  id: string | null
  json: string | null
} {
  const props = new Map<string, string>()
  const state = { id: null as string | null, json: null as string | null }
  return {
    props,
    get id() {
      return state.id
    },
    get json() {
      return state.json
    },
    setProperty: (name, value) => props.set(name, value),
    removeProperty: (name) => props.delete(name),
    setThemeId: (id) => {
      state.id = id
    },
    store: (json) => {
      state.json = json
    },
  }
}

describe("paintTheme", () => {
  it("写入每个角色的注入变量、标记和首帧缓存", () => {
    const painted = target()
    paintTheme(painted, "grove", sample)

    expect(painted.id).toBe("grove")
    expect(painted.props.get(themeVar("ink"))).toBe("#123456")
    expect(painted.props.size).toBe(THEME_ROLES.length)
    expect(JSON.parse(painted.json ?? "")).toEqual({ id: "grove", colors: sample })
  })

  it("传 null 清除主题，回到默认色", () => {
    const painted = target()
    paintTheme(painted, "grove", sample)
    paintTheme(painted, null, null)

    expect(painted.id).toBeNull()
    expect(painted.props.size).toBe(0)
    expect(painted.json).toBeNull()
  })
})
