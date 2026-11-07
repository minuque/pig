import { describe, expect, it } from "vitest"
import type { Node as ComarkNode } from "comark"
import { REVEAL_TAG, createResponseReveal } from "@features/transcript-view/lib/response-reveal.js"

type Span = { at: number; text: string }

function clock(start = 0) {
  const state = { t: start }
  return { state, now: () => state.t }
}

function textOf(node: ComarkNode): string {
  if (typeof node === "string") return node
  return node
    .slice(2)
    .map((child) => textOf(child as ComarkNode))
    .join("")
}

function spans(nodes: ComarkNode[]): Span[] {
  const out: Span[] = []
  const walk = (node: ComarkNode) => {
    if (typeof node === "string") return

    if (node[0] === REVEAL_TAG) {
      out.push({ at: Number((node[1] as { at: string }).at), text: textOf(node) })
      return
    }

    for (const child of node.slice(2)) walk(child as ComarkNode)
  }

  for (const node of nodes) walk(node)
  return out
}

const para = (text: string): ComarkNode[] => [["p", {}, text]]

describe("createResponseReveal", () => {
  it("一次到达的长段拆成小批依次淡入，积压最多排到 600ms 后", () => {
    const { now } = clock()
    const reveal = createResponseReveal("", now)
    const text = "word ".repeat(400)

    reveal.begin(text)
    const out = spans(reveal.decorate(para(text)))

    expect(out.length).toBeGreaterThan(20)
    expect(out.every((s) => s.text.length <= 20)).toBe(true)
    expect(out.map((s) => s.at)).toEqual([...out.map((s) => s.at)].sort((a, b) => a - b))
    expect(out[0]!.at).toBeLessThan(20)
    expect(out.at(-1)!.at).toBeLessThanOrEqual(600)
    expect(out.map((s) => s.text).join("")).toBe(text)
  })

  it("末段重新解析成新节点时，已排期的词不重播", () => {
    const { state, now } = clock()
    const reveal = createResponseReveal("", now)
    const first = "Hello brave new world "

    reveal.begin(first)
    const before = spans(reveal.decorate(para(first)))

    state.t = 150
    const next = `${first}again and again `
    reveal.begin(next)
    const after = spans(reveal.decorate(para(next)))

    expect(after.slice(0, before.length)).toEqual(before)
    expect(after.at(-1)!.at).toBeGreaterThanOrEqual(150)
  })

  it("打开时已有长文本的消息直接显示，不做淡入", () => {
    const { now } = clock()
    const text = "历史内容 ".repeat(100)
    const reveal = createResponseReveal(text, now)

    reveal.begin(text)
    expect(spans(reveal.decorate(para(text)))).toEqual([])
  })

  it("代码块原样保留，行内代码整体作为一个单位", () => {
    const { now } = clock()
    const reveal = createResponseReveal("", now)
    const nodes: ComarkNode[] = [
      ["p", {}, "run ", ["code", {}, "pnpm dev now"], " then"],
      ["pre", { language: "ts" }, ["code", {}, "const a = 1"]],
    ]

    reveal.begin("run `pnpm dev now` then\n\n```ts\nconst a = 1\n```")
    const out = reveal.decorate(nodes)

    expect(out[1]).toBe(nodes[1])
    expect(spans(out).some((s) => s.text === "pnpm dev now")).toBe(true)
  })

  it("结束后清除装饰，节点回到解析原样", () => {
    const { now } = clock()
    const reveal = createResponseReveal("", now)
    const nodes = para("done text ")

    reveal.begin("done text ")
    reveal.decorate(nodes)
    reveal.finish()
    expect(reveal.decorate(nodes)).toBe(nodes)
  })
})
