import { Parser, zhHansModel } from "budoux"
import type { ElementNode, Node } from "comark"

const zhParser = new Parser(zhHansModel)
const SKIP_TAGS = new Set(["pre", "code", "kbd", "samp"])
const CONTAINER_TAGS = new Set([
  "ul",
  "ol",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "section",
])
const LANG_BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "td",
  "th",
])
const PHRASE_HEADING_TAGS = new Set(["h1", "h2", "h3"])
const HAN_RE = /\p{Script=Han}/u
const HAN_ALL_RE = /\p{Script=Han}/gu
const LATIN_WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g
const NO_BREAK_BEFORE_RE = /^[、。，．：；！？）」』】》〉’”]/u
const NO_BREAK_AFTER_RE = /[（「『【《〈‘“]$/u
const enhanced = new WeakMap<ElementNode, ElementNode>()

export type ProseLang = "zh-Hans" | "en"

function isElementNode(node: Node): node is ElementNode {
  return Array.isArray(node) && node[0] !== null
}

function collectProseText(node: Node): string {
  if (typeof node === "string") return node

  const tag = node[0]

  if (tag === null || SKIP_TAGS.has(tag)) return ""
  let out = ""

  for (let i = 2; i < node.length; i++) out += collectProseText(node[i] as Node)
  return out
}

export function detectProseLang(node: ElementNode): ProseLang | undefined {
  const text = collectProseText(node)
  const hanCount = text.match(HAN_ALL_RE)?.length ?? 0
  const latinWords = text.match(LATIN_WORD_RE)?.length ?? 0

  if (hanCount > 0 && hanCount * 2 >= latinWords) return "zh-Hans"

  if (latinWords > 0) return "en"
  return undefined
}

function endsWithWhitespace(node: Node | undefined): boolean {
  if (typeof node === "string") return /\s$/.test(node)

  if (!node || node[0] === null) return false

  if (node[0] === "wbr" || node[0] === "br") return true
  const text = collectProseText(node)
  return text.length > 0 && /\s$/.test(text)
}

function startsWithWhitespace(node: Node | undefined): boolean {
  if (typeof node === "string") return /^\s/.test(node)

  if (!node || node[0] === null) return false

  if (node[0] === "wbr" || node[0] === "br") return true
  const text = collectProseText(node)
  return text.length > 0 && /^\s/.test(text)
}

function splitChineseText(text: string): { nodes: Node[]; inserted: boolean } {
  if (!HAN_RE.test(text)) return { nodes: [text], inserted: false }
  const chunks = zhParser.parse(text)

  if (chunks.length <= 1) return { nodes: [text], inserted: false }
  const out: Node[] = []
  let inserted = false

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const prev = chunks[i - 1]

    if (prev !== undefined && !/\s$/.test(prev) && !/^\s/.test(chunk)) {
      out.push(["wbr", {}])
      inserted = true
    }

    out.push(chunk)
  }

  return { nodes: out, inserted }
}

function insertHeadingBreaks(children: Node[]): { children: Node[]; inserted: boolean } {
  const out: Node[] = []
  let inserted = false

  for (const child of children) {
    if (typeof child === "string") {
      const split = splitChineseText(child)

      if (split.inserted) inserted = true
      out.push(...split.nodes)
      continue
    }

    const tag = child[0]

    if (tag === null || SKIP_TAGS.has(tag) || tag === "wbr" || tag === "br") {
      out.push(child)
      continue
    }

    const inner = insertHeadingBreaks(child.slice(2) as Node[])

    if (inner.inserted) inserted = true
    out.push([tag, child[1], ...inner.children])
  }

  const withEdges: Node[] = []

  for (let i = 0; i < out.length; i++) {
    const current = out[i]!
    const prev = withEdges.at(-1)

    if (
      prev !== undefined &&
      (typeof prev !== "string" || typeof current !== "string") &&
      !endsWithWhitespace(prev) &&
      !startsWithWhitespace(current) &&
      !NO_BREAK_AFTER_RE.test(collectProseText(prev)) &&
      !NO_BREAK_BEFORE_RE.test(collectProseText(current))
    ) {
      withEdges.push(["wbr", {}])
      inserted = true
    }

    withEdges.push(current)
  }

  return { children: withEdges, inserted }
}

function enhanceElement(node: ElementNode): ElementNode {
  const tag = node[0]

  if (tag === null || SKIP_TAGS.has(tag)) return node
  const hit = enhanced.get(node)

  if (hit) return hit
  const attrs = { ...node[1] }

  if (LANG_BLOCK_TAGS.has(tag) && attrs["lang"] === undefined) {
    const lang = detectProseLang(node)

    if (lang) attrs["lang"] = lang
  }

  let children = node.slice(2) as Node[]

  if (CONTAINER_TAGS.has(tag) || tag === "li") {
    children = children.map((child) => (isElementNode(child) ? enhanceElement(child) : child))
  }

  if (PHRASE_HEADING_TAGS.has(tag) && HAN_RE.test(collectProseText(node))) {
    const broken = insertHeadingBreaks(children)
    children = broken.children

    if (broken.inserted || /\s/.test(collectProseText(node))) attrs["data-phrase-break"] = ""
  }

  const result: ElementNode = [tag, attrs, ...children]
  enhanced.set(node, result)
  return result
}

export function enhanceMarkdownTypography(nodes: Node[]): Node[] {
  return nodes.map((node) => (isElementNode(node) ? enhanceElement(node) : node))
}
