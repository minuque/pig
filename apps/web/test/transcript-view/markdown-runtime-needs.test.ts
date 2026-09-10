import { describe, expect, it } from "vitest"
import { markdownRuntimeNeeds } from "@features/transcript-view/lib/markdown-runtime-needs.js"

describe("markdownRuntimeNeeds", () => {
  it("纯文字末条不装 worker", () => {
    expect(markdownRuntimeNeeds("好。还要别的公式或接着看项目再说。")).toEqual({
      mermaid: false,
      katex: false,
      code: false,
    })
  })

  it("公式、代码围栏、mermaid 分别命中", () => {
    expect(markdownRuntimeNeeds("$$E = mc^2$$").katex).toBe(true)
    expect(markdownRuntimeNeeds("```ts\nconst a = 1\n```").code).toBe(true)
    expect(markdownRuntimeNeeds("```mermaid\nflowchart LR\n  A --> B\n```").mermaid).toBe(true)
  })
})
