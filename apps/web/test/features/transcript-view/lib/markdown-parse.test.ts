import { describe, expect, it } from "vitest"
import { createStreamParser } from "@features/transcript-view/lib/markdown-parse.js"

async function links(markdown: string): Promise<string[]> {
  const { nodes } = await createStreamParser()(markdown)
  return (
    JSON.stringify(nodes)
      .match(/"href":"[^"]*"/g)
      ?.map((attr) => attr.slice(8, -1)) ?? []
  )
}

describe("正文自动链接", () => {
  it("裸写的文件名不当成网址", async () => {
    expect(await links("同步 DESIGN.md 与 README.md")).toEqual([])
  })

  it("带协议的网址仍自动成链接", async () => {
    expect(await links("见 https://example.com/docs")).toEqual(["https://example.com/docs"])
  })

  it("网址后紧跟中文标点时在标点前结束，后面的中文不进链接", async () => {
    expect(await links("分支 https://github.com/a/b/tree/main，要开 PR")).toEqual([
      "https://github.com/a/b/tree/main",
    ])
    expect(await links("见 https://example.com/docs。下一步")).toEqual(["https://example.com/docs"])
  })

  it("网址里本来就有中文时不截断", async () => {
    expect(await links("https://zh.wikipedia.org/wiki/猪 很好")).toEqual([
      "https://zh.wikipedia.org/wiki/%E7%8C%AA",
    ])
  })
})
