import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { chipToken } from "@features/composer/lib/tiptap-doc.js"

function leafText(node: ProseMirrorNode): string {
  return chipToken(node.type.name, node.attrs as Record<string, unknown>)
}

export function textOffsetAt(doc: ProseMirrorNode, position: number): number {
  const from = 1
  const to = Math.max(from, Math.min(position, doc.content.size))
  return doc.textBetween(from, to, "\n", leafText).length
}

export function positionAtOffset(doc: ProseMirrorNode, offset: number): number {
  const target = Math.max(0, offset)
  let consumed = 0
  let resolved: number | undefined
  let firstBlock = true

  doc.nodesBetween(0, doc.content.size, (node, position) => {
    if (resolved !== undefined) return false

    if (node.isBlock) {
      if (firstBlock) firstBlock = false
      else consumed += 1
    }

    if (node.isText) {
      const length = node.text?.length ?? 0

      if (target <= consumed + length) resolved = position + (target - consumed)
      consumed += length
      return false
    }

    if (node.isLeaf) {
      const length = leafText(node).length

      if (target <= consumed + length) resolved = target <= consumed ? position : position + 1
      consumed += length
    }

    return true
  })
  return resolved ?? doc.content.size
}
