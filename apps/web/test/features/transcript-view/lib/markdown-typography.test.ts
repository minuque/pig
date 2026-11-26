import { describe, expect, it } from "vitest"
import { createStreamParser } from "@features/transcript-view/lib/markdown-parse.js"

function findNodes(nodes: unknown, tag: string): unknown[][] {
  const found: unknown[][] = []

  if (!Array.isArray(nodes)) return found

  if (typeof nodes[0] === "string" && nodes[0] === tag) found.push(nodes)

  for (const item of nodes) {
    if (Array.isArray(item)) found.push(...findNodes(item, tag))
  }

  return found
}

describe("Markdown 排版增强", () => {
  it("中英文段落按内容标注 lang，中文技术句不被行内英文代码带偏", async () => {
    const parse = createStreamParser()
    const doc = await parse(
      [
        "把 `useMarkdownNodes` 与 `finalCache` 对齐到当前实现。",
        "",
        "Keep running text proportional while aligning table numbers cleanly.",
      ].join("\n"),
    )
    const paragraphs = findNodes(doc.nodes, "p")

    expect((paragraphs[0]?.[1] as Record<string, unknown> | undefined)?.lang).toBe("zh-Hans")
    expect((paragraphs[1]?.[1] as Record<string, unknown> | undefined)?.lang).toBe("en")
  })

  it("中文 h1-h3 插入 wbr 并标 data-phrase-break，且不拆分代码、正文与英文标题", async () => {
    const parse = createStreamParser()
    const doc = await parse(
      [
        "## 配置`--content-width`属性与排版规范",
        "",
        "## Typography guidelines for headings",
        "",
        "正文段落里的中文词语不应插入断点标签。",
      ].join("\n"),
    )
    const headings = findNodes(doc.nodes, "h2")
    const zhHeading = headings[0]!
    const enHeading = headings[1]!
    const paragraph = findNodes(doc.nodes, "p")[0]!
    const codeNodes = findNodes(zhHeading, "code")

    expect((zhHeading[1] as Record<string, unknown>)["lang"]).toBe("zh-Hans")
    expect((zhHeading[1] as Record<string, unknown>)["data-phrase-break"]).toBe("")
    expect(findNodes(zhHeading, "wbr").length).toBeGreaterThan(0)
    expect(codeNodes[0]?.slice(2)).toEqual(["--content-width"])

    expect((enHeading[1] as Record<string, unknown>)["lang"]).toBe("en")
    expect((enHeading[1] as Record<string, unknown>)["data-phrase-break"]).toBeUndefined()
    expect(findNodes(enHeading, "wbr")).toHaveLength(0)

    expect(findNodes(paragraph, "wbr")).toHaveLength(0)
  })

  it("代码块节点原样保留不标 lang 也不插 wbr", async () => {
    const parse = createStreamParser()
    const doc = await parse("```ts\nconst 标题 = '保持原样'\n```")
    const pre = findNodes(doc.nodes, "pre")[0]!

    expect((pre[1] as Record<string, unknown>)["lang"]).toBeUndefined()
    expect(findNodes(pre, "wbr")).toHaveLength(0)
  })
})

describe("Markdown 排版增强与流式解析", () => {
  it("流式追加时已稳定的块保持同一引用，渲染缓存不失效", async () => {
    const parse = createStreamParser()
    const first = await parse("## 第一节标题\n\n稳定段落。\n\n正在", { streaming: true })
    const second = await parse("## 第一节标题\n\n稳定段落。\n\n正在输出", { streaming: true })

    expect(second.nodes[0]).toBe(first.nodes[0])
    expect(second.nodes[1]).toBe(first.nodes[1])
  })

  it("中文标题不在收尾标点前或开括号后留断点", async () => {
    const parse = createStreamParser()
    const doc = await parse("## 设置**重点**。运行`pnpm`（可选）")
    const children = (findNodes(doc.nodes, "h2")[0] ?? []).slice(2)
    const isWbr = (node: unknown) => Array.isArray(node) && node[0] === "wbr"

    children.forEach((node, index) => {
      if (!isWbr(node)) return
      const next = children[index + 1]
      const prev = children[index - 1]

      expect(typeof next === "string" ? next : "").not.toMatch(/^[。，、；：！？）」』》]/u)
      expect(typeof prev === "string" ? prev : "").not.toMatch(/[（「『《]$/u)
    })
  })
})
