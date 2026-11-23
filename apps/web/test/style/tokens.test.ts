import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const appTokensCss = readFileSync(
  fileURLToPath(new URL("../../src/style/tokens.css", import.meta.url)),
  "utf8",
)
const uiTokensCss = readFileSync(
  fileURLToPath(new URL("../../../../packages/ui/src/styles/tokens.css", import.meta.url)),
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

describe("apps/web tokens.css contract", () => {
  const appRootVars = varsBySelector(appTokensCss, ":root")
  const appDarkVars = varsBySelector(appTokensCss, "html.dark")
  const uiRootVars = varsBySelector(uiTokensCss, ":root")

  it("html.dark 中的应用级覆写都在 apps/web :root 中有定义", () => {
    for (const token of appDarkVars.keys())
      expect(appRootVars.has(token), `dark override ${token} missing in apps/web :root`).toBe(true)
  })

  it("不与 @pig/ui 的 :root 设计变量重名冲突", () => {
    for (const token of appRootVars.keys())
      expect(uiRootVars.has(token), `duplicate :root token ${token} with @pig/ui`).toBe(false)
  })
})
