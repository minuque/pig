import type { JSONContent } from "@tiptap/core"
import { type ParsePromptOptions, parseLine } from "@features/composer/lib/tiptap-inline.js"
import { isClosingFence, parseOpeningFence } from "@features/composer/lib/tiptap-markdown.js"

const HEADING = /^(#{1,6})(?:[ \t]+(.*))?$/u
const QUOTE = /^[ \t]*>[ \t]?(.*)$/u
const RULE = /^[ \t]*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/u
const TASK_ITEM = /^([ \t]*)[-*+][ \t]+\[([ xX])\](?:[ \t]+(.*))?$/u
const BULLET_ITEM = /^([ \t]*)[-*+][ \t]+(.*)$/u
const ORDERED_ITEM = /^([ \t]*)(\d{1,9})[.)][ \t]+(.*)$/u

type ListKind = "task" | "bullet" | "ordered"

interface ListEntry {
  indent: number
  kind: ListKind
  checked: boolean
  start: number
  text: string
}

function paragraphNode(content: JSONContent[]): JSONContent {
  return content.length ? { type: "paragraph", content } : { type: "paragraph" }
}

function readListLine(line: string): ListEntry | undefined {
  const task = TASK_ITEM.exec(line)

  if (task) {
    return {
      indent: task[1]!.length,
      kind: "task",
      checked: (task[2] ?? " ").toLowerCase() === "x",
      start: 1,
      text: task[3] ?? "",
    }
  }

  const bullet = BULLET_ITEM.exec(line)

  if (bullet) {
    return {
      indent: bullet[1]!.length,
      kind: "bullet",
      checked: false,
      start: 1,
      text: bullet[2] ?? "",
    }
  }

  const ordered = ORDERED_ITEM.exec(line)

  if (ordered) {
    return {
      indent: ordered[1]!.length,
      kind: "ordered",
      checked: false,
      start: Number(ordered[2]),
      text: ordered[3] ?? "",
    }
  }

  return undefined
}

function buildList(entries: readonly ListEntry[], options: ParsePromptOptions): JSONContent[] {
  let cursor = 0

  function level(indent: number): JSONContent[] {
    const nodes: JSONContent[] = []

    while (cursor < entries.length && entries[cursor]!.indent >= indent) {
      const kind = entries[cursor]!.kind
      const items: JSONContent[] = []
      let start = 1

      while (
        cursor < entries.length &&
        entries[cursor]!.indent === indent &&
        entries[cursor]!.kind === kind
      ) {
        const entry = entries[cursor]!

        if (items.length === 0) start = entry.start
        cursor += 1
        const content: JSONContent[] = [paragraphNode(parseLine(entry.text, options))]

        if (cursor < entries.length && entries[cursor]!.indent > indent) {
          content.push(...level(entries[cursor]!.indent))
        }

        items.push(
          entry.kind === "task"
            ? { type: "taskItem", attrs: { checked: entry.checked }, content }
            : { type: "listItem", content },
        )
      }

      nodes.push(listNode(kind, items, start))
    }

    return nodes
  }

  return level(entries[0]?.indent ?? 0)
}

function listNode(kind: ListKind, items: JSONContent[], start: number): JSONContent {
  if (kind === "task") return { type: "taskList", content: items }

  if (kind === "ordered") {
    return {
      type: "orderedList",
      ...(start === 1 ? {} : { attrs: { start } }),
      content: items,
    }
  }

  return { type: "bulletList", content: items }
}

function readFence(
  lines: readonly string[],
  index: number,
  fence: { fence: string; language: string },
): { block: JSONContent; next: number } {
  const body: string[] = []
  let cursor = index + 1

  while (cursor < lines.length) {
    const line = lines[cursor]!

    if (isClosingFence(line, fence.fence)) {
      cursor += 1
      break
    }

    body.push(line)
    cursor += 1
  }

  const text = body.join("\n")
  return {
    block: {
      type: "codeBlock",
      attrs: { language: fence.language || null },
      ...(text ? { content: [{ type: "text", text }] } : {}),
    },
    next: cursor,
  }
}

function readQuote(
  lines: readonly string[],
  index: number,
  options: ParsePromptOptions,
): { block: JSONContent; next: number } {
  const paragraphs: JSONContent[] = []
  let cursor = index

  while (cursor < lines.length) {
    const quoted = QUOTE.exec(lines[cursor]!)

    if (!quoted) break
    paragraphs.push(paragraphNode(parseLine(quoted[1] ?? "", options)))
    cursor += 1
  }

  return { block: { type: "blockquote", content: paragraphs }, next: cursor }
}

export function parseBlocks(
  lines: readonly string[],
  options: ParsePromptOptions = {},
): JSONContent[] {
  const blocks: JSONContent[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    const fence = parseOpeningFence(line)

    if (fence) {
      const read = readFence(lines, index, fence)

      blocks.push(read.block)
      index = read.next
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: "horizontalRule" })
      index += 1
      continue
    }

    const heading = HEADING.exec(line)

    if (heading) {
      const level = heading[1]!.length
      const content = parseLine(heading[2] ?? "", options)

      blocks.push({
        type: "heading",
        attrs: { level },
        ...(content.length ? { content } : {}),
      })
      index += 1
      continue
    }

    if (QUOTE.test(line)) {
      const read = readQuote(lines, index, options)

      blocks.push(read.block)
      index = read.next
      continue
    }

    const entries: ListEntry[] = []

    while (index < lines.length) {
      const entry = readListLine(lines[index]!)

      if (!entry) break
      entries.push(entry)
      index += 1
    }

    if (entries.length) {
      blocks.push(...buildList(entries, options))
      continue
    }

    blocks.push(paragraphNode(parseLine(line, options)))
    index += 1
  }

  return blocks
}
