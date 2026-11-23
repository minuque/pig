import {
  chipJson,
  splitPromptSegments,
  type ChipJson,
} from "@features/composer/lib/editor/chip-tokens.js"
import {
  MARK_NESTING_ORDER,
  parseInlineMarkdown,
  type RichTextMark,
} from "@features/composer/lib/editor/rich-text.js"

export type JsonNode = Record<string, unknown>

export interface BuildOptions {
  blocks?: boolean | undefined
  chips?: boolean | undefined
}

interface TaskPrefix {
  kind: "task"
  indent: string
  checked: boolean
  markerSpace: string
  contentSpace: string
}

export type ListLinePrefix =
  TaskPrefix | { kind: "bullet" | "ordered"; indent: string; marker: string; space: string }

interface DocLine {
  list: ListLinePrefix | null
  inline: JsonNode[]
}

type Entry =
  | { code: JsonNode }
  | { rule: string }
  | { heading: { level: number; space: string; inline: JsonNode[] } }
  | { quote: { prefix: string; inline: JsonNode[] } }
  | { line: DocLine }

interface PendingItem {
  prefix: ListLinePrefix
  content: JsonNode[]
  children: PendingList[]
}

interface PendingList {
  key: string
  items: PendingItem[]
}

const RULE = /^([-*_])(?:[ \t]*\1){2,}[ \t]*\r?$/
const HEADING = /^(#{1,6})([ \t]+)([^\n]*)$/
const QUOTE = /^(>[ \t]*)([^\n]*)$/

export function parseOpeningFence(line: string): { fence: string; language: string } | null {
  const match = /^(`{3,}|~{3,})([^\n]*)$/.exec(line)

  if (!match) return null
  const fence = match[1]!
  const language = match[2]!

  if (fence.startsWith("`") && language.includes("`")) return null
  return { fence, language }
}

export function isClosingFence(line: string, fence: string): boolean {
  const match = /^(`{3,}|~{3,})[ \t]*\r?$/.exec(line)

  if (!match) return false
  const run = match[1]!
  return run[0] === fence[0] && run.length >= fence.length
}

function parseTaskPrefix(head: string): { prefix: TaskPrefix; markerLength: number } | null {
  const match = /^([ \t]*)-([ \t]+)\[([ xX])\]([ \t]*)/.exec(head)

  if (!match) return null

  if (head.length > match[0].length && !match[4]) return null
  return {
    prefix: {
      kind: "task",
      indent: match[1] ?? "",
      checked: (match[3] ?? " ").toLowerCase() === "x",
      markerSpace: match[2]!,
      contentSpace: match[4]!,
    },
    markerLength: match[0].length,
  }
}

export function parseListPrefix(
  line: string,
): { prefix: ListLinePrefix; markerLength: number } | null {
  const task = parseTaskPrefix(line)

  if (task) return task
  const ordered = /^([ \t]*)(\d+[.)])((?:[ \t]+)|$)/.exec(line)

  if (ordered) {
    return {
      prefix: { kind: "ordered", indent: ordered[1]!, marker: ordered[2]!, space: ordered[3]! },
      markerLength: ordered[0].length,
    }
  }

  const bullet = /^([ \t]*)([-*+])((?:[ \t]+)|$)/.exec(line)

  if (!bullet) return null
  return {
    prefix: { kind: "bullet", indent: bullet[1]!, marker: bullet[2]!, space: bullet[3]! },
    markerLength: bullet[0].length,
  }
}

function listKey(prefix: ListLinePrefix): string {
  if (prefix.kind === "task") return "task"

  if (prefix.kind === "ordered") return `ordered:${prefix.marker.slice(-1)}`
  return `bullet:${prefix.marker}`
}

function itemJson(item: PendingItem): JsonNode {
  const content = [
    { type: "paragraph", content: item.content },
    ...item.children.map((child) => listJson(child)),
  ]
  const { prefix } = item

  if (prefix.kind === "task") {
    const { checked, indent, markerSpace, contentSpace } = prefix
    return { type: "taskItem", attrs: { checked, indent, markerSpace, contentSpace }, content }
  }

  const attrs = { indent: prefix.indent, marker: prefix.marker, space: prefix.space }
  return { type: "listItem", attrs, content }
}

function listJson(list: PendingList): JsonNode {
  const first = list.items[0]!.prefix
  const content = list.items.map(itemJson)

  if (first.kind === "task") return { type: "taskList", content }

  if (first.kind === "ordered") {
    return {
      type: "orderedList",
      attrs: { start: Number.parseInt(first.marker, 10) || 1 },
      content,
    }
  }

  return { type: "bulletList", content }
}

export function textJson(text: string, marks: readonly RichTextMark[]): JsonNode {
  const json: JsonNode = { type: "text", text }

  if (marks.length > 0) {
    json["marks"] = [...marks]
      .sort((a, b) => MARK_NESTING_ORDER.indexOf(a) - MARK_NESTING_ORDER.indexOf(b))
      .map((mark) => ({ type: mark }))
  }

  return json
}

function sentinelFor(value: string): string {
  let sentinel = "￼"

  for (let codePoint = 0xe000; value.includes(sentinel); codePoint += 1) {
    sentinel = String.fromCodePoint(codePoint)
  }

  return sentinel
}

class InlineBuilder {
  private atoms: ChipJson[] = []
  private sources: string[] = []
  private index = 0
  readonly text: string

  constructor(
    value: string,
    readonly sentinel: string,
    chips: boolean,
  ) {
    const segments = chips ? splitPromptSegments(value) : [{ type: "text" as const, text: value }]

    this.text = segments
      .map((segment) => {
        if (segment.type === "text") return segment.text
        this.atoms.push(chipJson(segment))
        this.sources.push(segment.source)
        return sentinel
      })
      .join("")
  }

  inline(content: string): JsonNode[] {
    const nodes: JsonNode[] = []

    for (const span of parseInlineMarkdown(content)) {
      span.text.split(this.sentinel).forEach((piece, index) => {
        if (index > 0) {
          const marks = textJson("", span.marks)["marks"]
          nodes.push({ ...this.atoms[this.index++]!, ...(marks ? { marks } : {}) })
        }

        if (piece) nodes.push(textJson(piece, span.marks))
      })
    }

    return nodes
  }

  restore(line: string): string {
    return line.split(this.sentinel).reduce((joined, piece, index) => {
      if (index === 0) return piece
      this.index += 1
      return joined + this.sources[this.index - 1]! + piece
    }, "")
  }
}

function readCode(lines: readonly string[], index: number, builder: InlineBuilder) {
  const opening = parseOpeningFence(lines[index]!)!
  const language = builder.restore(opening.language)
  const body: string[] = []
  let cursor = index + 1
  let close = ""

  while (cursor < lines.length) {
    const candidate = lines[cursor]!

    if (isClosingFence(candidate, opening.fence)) {
      close = `\n${candidate}`
      break
    }

    body.push(builder.restore(candidate))
    cursor += 1
  }

  const content = body.join("\n")
  const code: JsonNode = {
    type: "codeBlock",
    attrs: { language, fence: opening.fence, close },
    ...(content ? { content: [{ type: "text", text: content }] } : {}),
  }
  return { code, next: cursor < lines.length ? cursor : lines.length }
}

function readEntries(builder: InlineBuilder, blocks: boolean): Entry[] {
  const lines = builder.text.split("\n")
  const entries: Entry[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!

    if (blocks && parseOpeningFence(line)) {
      const read = readCode(lines, index, builder)

      entries.push({ code: read.code })
      index = read.next
      continue
    }

    if (blocks && RULE.test(line)) {
      entries.push({ rule: line })
      continue
    }

    const heading = blocks ? HEADING.exec(line) : null

    if (heading) {
      const level = heading[1]!.length

      entries.push({
        heading: { level, space: heading[2]!, inline: builder.inline(heading[3]!) },
      })
      continue
    }

    const quote = blocks ? QUOTE.exec(line) : null

    if (quote) {
      entries.push({ quote: { prefix: quote[1]!, inline: builder.inline(quote[2]!) } })
      continue
    }

    const parsed = blocks ? parseListPrefix(line) : null
    const content = parsed ? line.slice(parsed.markerLength) : line

    entries.push({ line: { list: parsed?.prefix ?? null, inline: builder.inline(content) } })
  }

  return entries
}

class ListStack {
  roots: PendingList[] = []
  private stack: { indent: string; list: PendingList; container: PendingList[] }[] = []

  private open(container: PendingList[], key: string): PendingList {
    const list: PendingList = { key, items: [] }

    container.push(list)
    return list
  }

  flush(blocks: JsonNode[]): void {
    for (const list of this.roots) blocks.push(listJson(list))
    this.roots = []
    this.stack = []
  }

  add(prefix: ListLinePrefix, content: JsonNode[]): void {
    const item: PendingItem = { prefix, content, children: [] }
    const key = listKey(prefix)
    const { indent } = prefix

    for (;;) {
      const top = this.stack.at(-1)

      if (!top) {
        this.stack.push({ indent, list: this.open(this.roots, key), container: this.roots })
        continue
      }

      if (top.indent === indent) {
        if (top.list.key !== key) top.list = this.open(top.container, key)
        top.list.items.push(item)
        return
      }

      if (top.indent !== "" && !indent.startsWith(top.indent)) {
        if (this.stack.length > 1) {
          this.stack.pop()
          continue
        }

        top.indent = indent

        if (top.list.key !== key) top.list = this.open(top.container, key)
        top.list.items.push(item)
        return
      }

      const parent = top.list.items.at(-1)

      if (!parent) {
        top.list.items.push(item)
        return
      }

      const list = this.open(parent.children, key)

      this.stack.push({ indent, list, container: parent.children })
      list.items.push(item)
      return
    }
  }
}

function isProseLine(entry: Entry | undefined, empty: boolean): boolean {
  return (
    entry !== undefined &&
    "line" in entry &&
    !entry.line.list &&
    (entry.line.inline.length === 0) === empty
  )
}

function assemble(entries: readonly Entry[]): JsonNode[] {
  const blocks: JsonNode[] = []
  const lists = new ListStack()
  let quote: { prefix: string; content: JsonNode[][] } | null = null
  const flushQuote = () => {
    if (!quote) return
    blocks.push({
      type: "blockquote",
      attrs: { prefix: quote.prefix },
      content: quote.content.map((inline) => ({ type: "paragraph", content: inline })),
    })
    quote = null
  }

  entries.forEach((entry, entryIndex) => {
    if ("quote" in entry) {
      lists.flush(blocks)

      if (quote && quote.prefix !== entry.quote.prefix) flushQuote()
      quote ??= { prefix: entry.quote.prefix, content: [] }
      quote.content.push(entry.quote.inline)
      return
    }

    let proseIndex = entryIndex + 1

    if (quote === null && lists.roots.length > 0 && isProseLine(entry, true)) {
      while (isProseLine(entries[proseIndex], true)) proseIndex += 1
    }

    const separator =
      (quote !== null || lists.roots.length > 0) &&
      isProseLine(entry, true) &&
      isProseLine(entries[proseIndex], false)

    flushQuote()

    if (separator) return lists.flush(blocks)

    if ("line" in entry && entry.line.list) return lists.add(entry.line.list, entry.line.inline)
    lists.flush(blocks)

    if ("code" in entry) blocks.push(entry.code)
    else if ("rule" in entry) blocks.push({ type: "horizontalRule", attrs: { source: entry.rule } })
    else if ("heading" in entry) {
      const { level, space, inline } = entry.heading

      blocks.push({ type: "heading", attrs: { level, space }, content: inline })
    } else blocks.push({ type: "paragraph", content: entry.line.inline })
  })
  flushQuote()
  lists.flush(blocks)
  return blocks
}

export function buildTiptapContent(value: string, options: BuildOptions = {}): JsonNode[] {
  const builder = new InlineBuilder(value, sentinelFor(value), options.chips ?? true)
  return assemble(readEntries(builder, options.blocks ?? true))
}

export function buildDocJson(value: string): JsonNode {
  const content = buildTiptapContent(value)

  if (content.at(-1)?.["type"] === "horizontalRule") content.push({ type: "paragraph" })
  return { type: "doc", content }
}
