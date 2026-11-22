import type { JSONContent } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import {
  type MarkdownSink,
  type PromptNode,
  writeInline,
} from "@features/composer/lib/tiptap-inline.js"
import {
  CLOSING_FENCE,
  headingPrefix,
  isClosingFence,
  openingFence,
} from "@features/composer/lib/tiptap-markdown.js"

export interface MarkdownToken {
  at: number
  length: number
  markdown: string
}

export interface MarkdownDocument {
  text: string
  tokens: MarkdownToken[]
}

interface Writer {
  text: string
  tokens: MarkdownToken[]
}

const INLINE_NODES = new Set(["text", "fileMention", "commandChip"])

function createSink(writer: Writer): MarkdownSink {
  return {
    virtual(at, markdown) {
      if (!markdown) return
      writer.text += markdown
      writer.tokens.push({ at, length: 0, markdown })
    },
    mapped(at, length, markdown) {
      if (!markdown) return
      writer.text += markdown
      writer.tokens.push({ at, length, markdown })
    },
  }
}

export function fromJson(node: JSONContent): PromptNode {
  return {
    type: node.type ?? "",
    at: 0,
    text: node.text,
    attrs: node.attrs,
    marks: node.marks?.map((mark) => mark.type ?? ""),
    content: node.content?.map(fromJson),
  }
}

export function fromProseMirror(node: ProseMirrorNode, at = 0): PromptNode {
  const content: PromptNode[] = []
  const contentStart = node.type.name === "doc" ? at : at + 1
  let offset = 0

  node.forEach((child) => {
    content.push(fromProseMirror(child, contentStart + offset))
    offset += child.nodeSize
  })
  return {
    type: node.type.name,
    at,
    text: node.isText ? (node.text ?? "") : undefined,
    attrs: node.attrs as Record<string, unknown>,
    marks: node.marks.map((mark) => mark.type.name),
    content: node.isText ? undefined : content,
  }
}

function indentOf(marker: string): string {
  return " ".repeat(marker.length)
}

function codeText(node: PromptNode): string {
  const text = (node.content ?? []).map((child) => child.text ?? "").join("")
  const lines = text.split("\n")
  const last = lines[lines.length - 1]

  if (lines.length > 1 && last !== undefined && isClosingFence(last, CLOSING_FENCE)) lines.pop()
  return lines.join("\n")
}

function headingLevel(node: PromptNode): number {
  const level = Number(node.attrs?.["level"] ?? 1)
  return Number.isFinite(level) ? level : 1
}

function itemMarker(list: PromptNode, item: PromptNode, index: number): string {
  if (list.type === "taskList") return `- [${item.attrs?.["checked"] ? "x" : " "}] `

  if (list.type === "orderedList") {
    const start = Number(list.attrs?.["start"] ?? 1)
    return `${(Number.isFinite(start) ? start : 1) + index}. `
  }

  return "- "
}

function contentStart(node: PromptNode): number {
  const first = node.content?.[0]

  if (!first) return node.at + 1

  if (INLINE_NODES.has(first.type)) return first.at
  return contentStart(first)
}

function writeItems(list: PromptNode, sink: MarkdownSink, linePrefix: string): void {
  const items = list.content ?? []

  items.forEach((item, index) => {
    if (index > 0) sink.virtual(item.at, `\n${linePrefix}`)
    const marker = itemMarker(list, item, index)

    sink.virtual(contentStart(item), marker)
    const blocks = item.content ?? []
    const [first, ...rest] = blocks

    if (first) writeBlock(first, sink, linePrefix)

    for (const block of rest) {
      const indent = `${linePrefix}${indentOf(marker)}`

      sink.virtual(block.at, `\n${indent}`)
      writeBlock(block, sink, indent)
    }
  })
}

function writeBlocks(node: PromptNode, sink: MarkdownSink, linePrefix: string): void {
  const children = node.content ?? []

  children.forEach((child, index) => {
    if (index > 0) sink.virtual(child.at, `\n${linePrefix}`)
    writeBlock(child, sink, linePrefix)
  })
}

function writeBlock(node: PromptNode, sink: MarkdownSink, linePrefix: string): void {
  switch (node.type) {
    case "heading":
      sink.virtual(contentStart(node), headingPrefix(headingLevel(node)))
      writeInline(node, sink)
      return
    case "blockquote": {
      const inner = `${linePrefix}> `

      sink.virtual(contentStart(node), "> ")
      writeBlocks(node, sink, inner)
      return
    }

    case "codeBlock": {
      const code = codeText(node)

      sink.virtual(contentStart(node), openingFence(String(node.attrs?.["language"] ?? "")))

      if (code) {
        sink.virtual(node.at + 1, "\n")
        sink.mapped(node.at + 1, code.length, code)
        sink.virtual(node.at + 1 + code.length, `\n${CLOSING_FENCE}`)
      }

      return
    }

    case "horizontalRule":
      sink.virtual(node.at, "---")
      return
    case "bulletList":
    case "orderedList":
    case "taskList":
      writeItems(node, sink, linePrefix)
      return
    default:
      writeInline(node, sink)
  }
}

export function writeMarkdown(node: PromptNode): MarkdownDocument {
  const writer: Writer = { text: "", tokens: [] }

  writeBlocks(node, createSink(writer), "")
  return writer
}
