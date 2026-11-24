import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const tokensCss = readFileSync(
  fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
  "utf8",
)

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

function varsBySelector(css: string, selector: string): Map<string, string> {
  const vars = new Map<string, string>()

  for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!.split(",").map((part) => part.trim())

    if (!selectors.includes(selector)) continue

    for (const decl of match[2]!.matchAll(/(?:^|[\s;])(--[\w-]+)\s*:\s*([^;]+)/g))
      vars.set(decl[1]!, decl[2]!.replace(/\s+/g, " ").trim())
  }

  return vars
}

describe("@pig/ui tokens.css contract", () => {
  const rootVars = varsBySelector(tokensCss, ":root")
  const darkVars = varsBySelector(tokensCss, "html.dark")

  it("固定控件三档高度与核心切换变量契约", () => {
    for (const token of ["--switch-thumb-unchecked", "--tone-hover-target"]) {
      expect(rootVars.has(token), `missing ${token} in :root`).toBe(true)
      expect(darkVars.has(token), `missing ${token} in html.dark`).toBe(true)
    }
  })

  it("六个基础色调均提供 --tone 与 --tone-text", () => {
    for (const tone of ["accent", "info", "success", "warning", "danger", "neutral"]) {
      const toneVars = varsBySelector(tokensCss, `[data-tone="${tone}"]`)
      expect(toneVars.get("--tone"), `missing --tone for ${tone}`).toBeTruthy()
      expect(toneVars.get("--tone-text"), `missing --tone-text for ${tone}`).toBeTruthy()
    }
  })

  it("html.dark 中的每项覆写都在 :root 中有基线定义", () => {
    for (const token of darkVars.keys())
      expect(rootVars.has(token), `dark override ${token} missing in :root`).toBe(true)
  })
})
