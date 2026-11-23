import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import { chipSource } from "@features/composer/lib/editor/chip-tokens.js"
import { isClosingFence } from "@features/composer/lib/editor/doc-parse.js"
import {
  MARK_NESTING_ORDER,
  RICH_TEXT_DELIMITERS,
  type RichTextMark,
} from "@features/composer/lib/editor/rich-text.js"

export interface RichRun {
  kind: "text" | "token" | "break" | "prefix"
  flatStart: number
  docLen: number
  mdLen: number
  openLen: number
  closeLen: number
  pmPos: number
  mdStart: number
  nodeName?: string
}

export interface RichDocMap {
  readonly value: string
  readonly runs: ReadonlyArray<Readonly<RichRun>>
  readonly docLength: number
}

interface Accumulator {
  runs: RichRun[]
  value: string
  flat: number
  md: number
}

export const LIST_NODE_NAMES = new Set(["taskList", "bulletList", "orderedList"])
export const LIST_ITEM_NODE_NAMES = new Set(["taskItem", "listItem"])
const STYLE_NAMES = new Set<string>(MARK_NESTING_ORDER)

function pushPrefix(acc: Accumulator, text: string, pmPos: number): void {
  acc.runs.push({
    kind: "prefix",
    flatStart: acc.flat,
    docLen: 0,
    mdLen: text.length,
    openLen: 0,
    closeLen: 0,
    pmPos,
    mdStart: acc.md,
  })
  acc.value += text
  acc.md += text.length
}

function pushBreak(acc: Accumulator, position?: number): void {
  const previous = acc.runs.at(-1)
  const pmPos = position ?? (previous ? previous.pmPos + previous.docLen : 1)

  acc.runs.push({
    kind: "break",
    flatStart: acc.flat,
    docLen: 1,
    mdLen: 1,
    openLen: 0,
    closeLen: 0,
    pmPos,
    mdStart: acc.md,
  })
  acc.value += "\n"
  acc.flat += 1
  acc.md += 1
}

function ruleSource(block: ProseMirrorNode): string {
  const source = block.attrs["source"]
  return typeof source === "string" && source ? source : "---"
}

function isTrailingLineAfterRule(doc: ProseMirrorNode, index: number): boolean {
  const block = doc.child(index)
  return (
    index === doc.childCount - 1 &&
    index > 0 &&
    block.type.name === "paragraph" &&
    block.content.size === 0 &&
    doc.child(index - 1).type.name === "horizontalRule"
  )
}

function needsBlankLineBetween(blocks: readonly ProseMirrorNode[], index: number): boolean {
  const previous = blocks[index - 1]!
  const block = blocks[index]!
  const isEmptyParagraph = (node: ProseMirrorNode | undefined) =>
    node?.type.name === "paragraph" && node.content.size === 0

  if (LIST_NODE_NAMES.has(previous.type.name)) {
    let next = index

    while (isEmptyParagraph(blocks[next])) next += 1
    return blocks[next]?.type.name === "paragraph"
  }

  if (previous.type.name === "blockquote") {
    return block.type.name === "paragraph" && block.content.size > 0
  }

  return (
    block.type.name === "horizontalRule" &&
    previous.type.name === "paragraph" &&
    previous.content.size > 0 &&
    /^-+[ \t]*\r?$/.test(ruleSource(block))
  )
}

function styleMarksOf(node: ProseMirrorNode): RichTextMark[] {
  return node.marks
    .map((mark) => mark.type.name)
    .filter((name): name is RichTextMark => STYLE_NAMES.has(name))
}

function hasCode(node: ProseMirrorNode): boolean {
  return node.marks.some((mark) => mark.type.name === "code")
}

function splitEdgeWhitespace(container: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = []

  container.forEach((child) => {
    if (!child.isText || hasCode(child)) {
      children.push(child)
      return
    }

    const text = child.text!
    const start = text.length - text.trimStart().length
    const end = Math.max(start, text.trimEnd().length)
    let offset = 0

    for (const boundary of [start, end, text.length]) {
      if (boundary > offset) children.push(child.cut(offset, boundary))
      offset = boundary
    }
  })
  return children
}

function dropEdgeWhitespaceMarks(children: ProseMirrorNode[]): void {
  for (const mark of MARK_NESTING_ORDER) {
    if (mark === "code") continue

    for (const direction of [1, -1]) {
      let hasContent = false

      for (
        let index = direction === 1 ? 0 : children.length - 1;
        index >= 0 && index < children.length;
        index += direction
      ) {
        const child = children[index]!

        if (!child.marks.some((item) => item.type.name === mark)) hasContent = false
        else if (child.isText && !hasCode(child) && /^\s+$/.test(child.text!)) {
          if (!hasContent) {
            children[index] = child.mark(child.marks.filter((item) => item.type.name !== mark))
          }
        } else hasContent = true
      }
    }
  }
}

function orderMarks(children: readonly ProseMirrorNode[]): RichTextMark[][] {
  const markEnds = new Map<RichTextMark, number>()
  const ordered: RichTextMark[][] = []

  for (let index = children.length - 1; index >= 0; index -= 1) {
    const marks = styleMarksOf(children[index]!)

    for (const mark of MARK_NESTING_ORDER) {
      if (!marks.includes(mark)) markEnds.delete(mark)
      else if (!markEnds.has(mark)) markEnds.set(mark, index)
    }

    ordered[index] = marks.sort(
      (a, b) =>
        markEnds.get(b)! - markEnds.get(a)! ||
        MARK_NESTING_ORDER.indexOf(a) - MARK_NESTING_ORDER.indexOf(b),
    )
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const marks = ordered[index]!
    const retained: RichTextMark[] = []

    for (const mark of ordered[index - 1]!) {
      if (!marks.includes(mark)) break
      retained.push(mark)
    }

    ordered[index] = [...retained, ...marks.filter((mark) => !retained.includes(mark))]
  }

  return ordered
}

function commonLength(left: readonly RichTextMark[], right: readonly RichTextMark[]): number {
  let index = 0

  while (index < left.length && left[index] === right[index]) index += 1
  return index
}

interface CodeFence {
  open: string
  close: string
}

function codeFence(text: string): CodeFence {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length))
  const fence = "`".repeat(longest + 1)
  const stripped = /^ [\s\S]* $/.test(text) && /[^ ]/.test(text)
  const pad = text.startsWith("`") || text.endsWith("`") || stripped ? " " : ""
  return { open: `${fence}${pad}`, close: `${pad}${fence}` }
}

function sourceOf(child: ProseMirrorNode): string {
  return child.isText ? child.text! : chipSource(child)
}

function codeFences(
  children: readonly ProseMirrorNode[],
  ordered: readonly RichTextMark[][],
): Array<CodeFence | undefined> {
  const fences: Array<CodeFence | undefined> = Array.from({ length: children.length })
  let start = -1
  let text = ""

  children.forEach((child, index) => {
    if (!ordered[index]!.includes("code")) return

    if (start === -1) {
      start = index
      text = ""
    }

    text += sourceOf(child)
    const next = ordered[index + 1] ?? []
    const closes = commonLength(ordered[index]!, next) <= ordered[index]!.indexOf("code")

    if (!closes) return
    fences.fill(codeFence(text), start, index + 1)
    start = -1
  })
  return fences
}

function delimiters(
  marks: readonly RichTextMark[],
  fence: CodeFence | undefined,
  closing: boolean,
): string {
  return marks
    .map((mark) => {
      if (mark !== "code" || !fence) return RICH_TEXT_DELIMITERS[mark]
      return closing ? fence.close : fence.open
    })
    .join("")
}

function appendInline(container: ProseMirrorNode, contentStart: number, acc: Accumulator): void {
  const children = splitEdgeWhitespace(container)

  dropEdgeWhitespaceMarks(children)
  const ordered = orderMarks(children)
  const fences = codeFences(children, ordered)
  let inlineOffset = 0

  children.forEach((child, index) => {
    const pmPos = contentStart + inlineOffset

    inlineOffset += child.nodeSize
    const marks = ordered[index]!
    const fence = fences[index]
    const opened = marks.slice(commonLength(marks, ordered[index - 1] ?? []))
    const closed = marks.slice(commonLength(marks, ordered[index + 1] ?? [])).reverse()
    const open = delimiters(opened, fence, false)
    const close = delimiters(closed, fence, true)
    const source = sourceOf(child)
    const docLen = child.isText ? source.length : 1
    const mdText = open + source + close

    acc.runs.push({
      kind: child.isText ? "text" : "token",
      flatStart: acc.flat,
      docLen,
      mdLen: mdText.length,
      openLen: open.length,
      closeLen: close.length,
      pmPos,
      mdStart: acc.md,
      ...(child.isText ? {} : { nodeName: child.type.name }),
    })
    acc.value += mdText
    acc.flat += docLen
    acc.md += mdText.length
  })

  if (children.length === 0) {
    acc.runs.push({
      kind: "text",
      flatStart: acc.flat,
      docLen: 0,
      mdLen: 0,
      openLen: 0,
      closeLen: 0,
      pmPos: contentStart,
      mdStart: acc.md,
    })
  }
}

function attr(node: ProseMirrorNode, name: string, fallback: string): string {
  const value = node.attrs[name]
  return typeof value === "string" ? value : fallback
}

function listItemPrefix(item: ProseMirrorNode, empty: boolean): string {
  const indent = attr(item, "indent", "")
  const pad = (value: unknown) => (typeof value === "string" && value) || (empty ? "" : " ")

  if (item.type.name === "taskItem") {
    const box = `[${item.attrs["checked"] === true ? "x" : " "}]`
    return `${indent}-${attr(item, "markerSpace", " ")}${box}${pad(item.attrs["contentSpace"])}`
  }

  return `${indent}${attr(item, "marker", "") || "-"}${pad(item.attrs["space"])}`
}

function walkList(list: ProseMirrorNode, listStart: number, acc: Accumulator): void {
  let itemPos = listStart + 1

  list.content.forEach((item, _, index) => {
    if (index > 0) pushBreak(acc)
    const contentStart = itemPos + 1
    const first = item.firstChild
    const empty = first?.type.name === "paragraph" && first.content.childCount === 0

    pushPrefix(acc, listItemPrefix(item, empty), contentStart + 1)
    let childPos = contentStart

    item.content.forEach((child, __, childIndex) => {
      if (childIndex > 0) pushBreak(acc)

      if (LIST_NODE_NAMES.has(child.type.name)) walkList(child, childPos, acc)
      else if (child.type.name === "paragraph") appendInline(child, childPos + 1, acc)
      childPos += child.nodeSize
    })
    itemPos += item.nodeSize
  })
}

export function codeBlockSource(node: ProseMirrorNode, followed: boolean) {
  let fence = attr(node, "fence", "```") || "```"
  const language = attr(node, "language", "")
  let close = attr(node, "close", "")
  const content = node.textContent
  const longest = Math.max(
    0,
    ...content
      .split("\n")
      .filter((line) => isClosingFence(line, fence))
      .map((line) => /^[`~]+/.exec(line)![0].length),
  )

  if (longest > 0) {
    fence = fence[0]!.repeat(longest + 1)

    if (close) close = `\n${fence}`
  }

  if (!close && followed) close = `\n${fence}`
  return { open: `${fence}${language}${content ? "\n" : ""}`, content, close }
}

function appendCodeBlock(
  block: ProseMirrorNode,
  pmPos: number,
  followed: boolean,
  acc: Accumulator,
): void {
  const { open, content, close } = codeBlockSource(block, followed)
  const mdLen = open.length + content.length + close.length

  acc.runs.push({
    kind: "text",
    flatStart: acc.flat,
    docLen: content.length,
    mdLen,
    openLen: open.length,
    closeLen: close.length,
    pmPos,
    mdStart: acc.md,
    nodeName: "codeBlock",
  })
  acc.flat += content.length
  acc.md += mdLen
  acc.value += open + content + close
}

function walkBlockquote(quote: ProseMirrorNode, quoteStart: number, acc: Accumulator): void {
  const prefix = attr(quote, "prefix", "> ")
  let childPos = quoteStart + 1

  quote.content.forEach((child, _, index) => {
    if (index > 0) pushBreak(acc)
    pushPrefix(acc, prefix, childPos + 1)

    if (child.type.name === "paragraph") appendInline(child, childPos + 1, acc)
    childPos += child.nodeSize
  })
}

function appendBlock(
  block: ProseMirrorNode,
  start: number,
  followed: boolean,
  acc: Accumulator,
): void {
  const name = block.type.name

  if (LIST_NODE_NAMES.has(name)) return walkList(block, start, acc)

  if (name === "codeBlock") return appendCodeBlock(block, start + 1, followed, acc)

  if (name === "blockquote") return walkBlockquote(block, start, acc)

  if (name === "horizontalRule") return pushPrefix(acc, ruleSource(block), start + block.nodeSize)

  if (name === "heading") {
    const level = typeof block.attrs["level"] === "number" ? block.attrs["level"] : 1

    pushPrefix(acc, `${"#".repeat(level)}${attr(block, "space", " ")}`, start + 1)
  }

  appendInline(block, start + 1, acc)
}

function serializeDoc(doc: ProseMirrorNode): RichDocMap {
  const acc: Accumulator = { runs: [], value: "", flat: 0, md: 0 }
  const blocks: ProseMirrorNode[] = []
  let start = 0

  doc.content.forEach((node) => blocks.push(node))
  blocks.forEach((block, index) => {
    if (index > 0 && !isTrailingLineAfterRule(doc, index)) pushBreak(acc)

    if (index > 0 && needsBlankLineBetween(blocks, index)) pushPrefix(acc, "\n", start + 1)
    appendBlock(block, start, index < blocks.length - 1, acc)
    start += block.nodeSize
  })
  return { value: acc.value, runs: acc.runs, docLength: acc.flat }
}

const serialized = new WeakMap<ProseMirrorNode, RichDocMap>()

export function serializeEditorDoc(doc: ProseMirrorNode): RichDocMap {
  let map = serialized.get(doc)

  if (!map) {
    map = serializeDoc(doc)
    serialized.set(doc, map)
  }

  return map
}

export function serializeSelection(doc: ProseMirrorNode, from: number, to: number): string {
  const slice = doc.slice(from, to)
  const $from = doc.resolve(from)
  let depth = $from.sharedDepth(to)
  let content: Fragment | ProseMirrorNode = slice.content

  if (slice.content.firstChild?.isInline) {
    content = doc.type.schema.nodes["paragraph"]!.create(null, slice.content)
  } else {
    while (depth > 0) {
      const shared = $from.node(depth)

      content = shared.copy(Fragment.from(content))

      if (!LIST_ITEM_NODE_NAMES.has(shared.type.name)) break
      depth -= 1
    }
  }

  return serializeEditorDoc(doc.type.create(null, content)).value
}
