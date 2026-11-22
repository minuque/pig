import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import {
  fromProseMirror,
  type MarkdownToken,
  writeMarkdown,
} from "@features/composer/lib/tiptap-blocks.js"

function tokensOf(doc: ProseMirrorNode): MarkdownToken[] {
  return writeMarkdown(fromProseMirror(doc)).tokens
}

export function textOffsetAt(doc: ProseMirrorNode, position: number): number {
  let offset = 0

  for (const token of tokensOf(doc)) {
    if (token.length === 0) {
      if (token.at <= position) offset += token.markdown.length
      continue
    }

    if (position <= token.at) break

    if (position < token.at + token.length) {
      return offset + Math.min(position - token.at, token.markdown.length)
    }

    offset += token.markdown.length
  }

  return offset
}

export function positionAtOffset(doc: ProseMirrorNode, offset: number): number {
  const target = Math.max(0, offset)
  let consumed = 0

  for (const token of tokensOf(doc)) {
    if (token.length === 0) {
      consumed += token.markdown.length

      if (target <= consumed) return token.at
      continue
    }

    const next = consumed + token.markdown.length

    if (target <= next) return token.at + Math.min(target - consumed, token.length)
    consumed = next
  }

  return doc.content.size
}
