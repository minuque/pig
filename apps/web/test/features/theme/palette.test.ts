import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_THEME,
  fillTheme,
  paintTheme,
  THEME_ROLES,
  THEME_SEEDS,
  themeVar,
  type ThemeColors,
  type ThemeSeedColors,
  type ThemeTarget,
} from "@features/theme/lib/palette.js"

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

describe("主题角色", () => {
  const root = values(":root")
  const dark = values(".dark")
  const themed = new Set(values("html[data-theme-id]").keys())

  it("每个角色在 :root 和 .dark 都有默认值", () => {
    const missing = THEME_ROLES.filter((role) => !root.has(role) || !dark.has(role))
    expect(missing).toEqual([])
  })

  it("默认主题的预览色与 :root / .dark 一致", () => {
    const drifted = THEME_ROLES.filter(
      (role) =>
        DEFAULT_THEME.light[role] !== root.get(role) || DEFAULT_THEME.dark[role] !== dark.get(role),
    )

    expect(drifted).toEqual([])
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

const seed: ThemeSeedColors = {
  background: "#101010",
  card: "#202020",
  primary: "#3050c0",
  foreground: "#f0f0f0",
  sidebar: "#181818",
  success: "#30a030",
  warning: "#c08020",
  destructive: "#c03030",
}

describe("fillTheme", () => {
  it("只给种子色也能补齐每个角色", () => {
    const colors = fillTheme("dark", seed)

    expect(Object.keys(colors).sort()).toEqual([...THEME_ROLES].sort())
    expect(THEME_SEEDS.every((role) => colors[role] === seed[role])).toBe(true)
  })

  it("同名覆盖优先于派生值", () => {
    const colors = fillTheme("light", seed, { link: "#abcdef", "code-background": "#111111" })

    expect(colors.link).toBe("#abcdef")
    expect(colors["code-background"]).toBe("#111111")
  })

  it("浅色和深色的文字方向相反", () => {
    expect(fillTheme("light", seed)["primary-foreground"]).toBe("#ffffff")
    expect(fillTheme("dark", seed)["primary-foreground"]).toBe("#000000")
  })
})

describe("paintTheme", () => {
  it("写入每个角色的注入变量、标记和首帧缓存", () => {
    const painted = target()
    paintTheme(painted, "grove", sample)

    expect(painted.id).toBe("grove")
    expect(painted.props.get(themeVar("foreground"))).toBe("#123456")
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
