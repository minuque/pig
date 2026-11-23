import type { Editor } from "@tiptap/core"
import { closeHistory } from "@tiptap/pm/history"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"
import { REPLY_COMMENT_MAX, withReplyComment, type ReplyReference } from "@pig/protocol"
import { contextReferenceAttrs } from "@features/composer/lib/editor/chip-tokens.js"

export interface InsertedSpaces {
  before: boolean
  after: boolean
}

export type ReplyCommentDismissal =
  | { kind: "cancel" }
  | { kind: "commit"; comment: string }
  | { kind: "close" }
  | { kind: "keep-open" }

const EXTENSIONLESS_FILES = new Set([
  "makefile",
  "gnumakefile",
  "make",
  "justfile",
  "dockerfile",
  "license",
  "readme",
  "procfile",
  "gemfile",
  "rakefile",
  "brewfile",
  "caddyfile",
  "vagrantfile",
  "jenkinsfile",
  "cmakelists",
  "changelog",
  "authors",
  "notice",
  "owners",
  "codeowners",
])
let citeSeq = 0

export function nextCiteId(): string {
  citeSeq += 1
  return `cite-${citeSeq}`
}

export function resolveReplyCommentDismissal(input: {
  reason: string
  draft: string | null
  savedComment: string | undefined
}): ReplyCommentDismissal {
  if (input.reason === "escape-key") return { kind: "cancel" }

  if (input.draft === null || input.draft.trim() === (input.savedComment ?? "").trim()) {
    return { kind: "close" }
  }

  if (input.draft.length > REPLY_COMMENT_MAX) return { kind: "keep-open" }
  return { kind: "commit", comment: input.draft }
}

export function findReplyChipPos(
  doc: ProseMirrorNode,
  citeId: string,
): { pos: number; node: ProseMirrorNode } | null {
  let found: { pos: number; node: ProseMirrorNode } | null = null

  doc.descendants((node, pos) => {
    if (found) return false

    if (
      node.type.name === "contextReference" &&
      node.attrs["kind"] === "reply" &&
      node.attrs["citeId"] === citeId
    ) {
      found = { pos, node }
      return false
    }

    return true
  })
  return found
}

export function insertReplyChipAtCaret(
  editor: Editor,
  reference: ReplyReference,
): { citeId: string; insertedSpaces: InsertedSpaces } | null {
  const { state } = editor
  const type = state.schema.nodes["contextReference"]

  if (!type) return null
  const { doc, selection } = state
  const citeId = nextCiteId()
  const chip = type.create({
    kind: "reply",
    sessionId: reference.sessionId,
    entryId: reference.entryId,
    text: reference.text,
    label: reference.label,
    comment: reference.comment ?? null,
    citeId,
  })
  const inCode = selection.$from.parent.type.spec.code === true

  if (inCode) {
    const last = doc.lastChild

    if (!last || last.type.name !== "paragraph") {
      const paragraph = state.schema.nodes["paragraph"]!.create(null, [
        chip,
        state.schema.text(" "),
      ])
      const insertAt = doc.content.size
      const tr = closeHistory(state.tr.insert(insertAt, paragraph))
      const caret = Math.min(tr.doc.content.size - 1, insertAt + 1 + chip.nodeSize + 1)

      tr.setSelection(TextSelection.create(tr.doc, Math.max(1, caret)))
      editor.view.dispatch(tr.scrollIntoView())
      return { citeId, insertedSpaces: { before: false, after: true } }
    }

    const endPos = doc.content.size - 1
    const spaceBefore =
      last.content.size > 0 && !/\s/.test(doc.textBetween(endPos - 1, endPos, "\n", "\uFFFC"))
    const nodes = [...(spaceBefore ? [state.schema.text(" ")] : []), chip, state.schema.text(" ")]
    const tr = closeHistory(state.tr.insert(endPos, nodes))
    const caret = endPos + (spaceBefore ? 1 : 0) + chip.nodeSize + 1

    tr.setSelection(TextSelection.create(tr.doc, Math.min(tr.doc.content.size - 1, caret)))
    editor.view.dispatch(tr.scrollIntoView())
    return { citeId, insertedSpaces: { before: spaceBefore, after: true } }
  }

  const { from, to, $from, $to } = selection
  const spaceBefore =
    $from.parentOffset > 0 && !/\s/.test(doc.textBetween(from - 1, from, "\n", "\uFFFC"))
  const spaceAfter = to === $to.end() || !/\s/.test(doc.textBetween(to, to + 1, "\n", "\uFFFC"))
  const nodes = [
    ...(spaceBefore ? [state.schema.text(" ")] : []),
    chip,
    ...(spaceAfter ? [state.schema.text(" ")] : []),
  ]
  const tr = closeHistory(state.tr.replaceWith(from, to, nodes))
  const caret = from + (spaceBefore ? 1 : 0) + chip.nodeSize + (spaceAfter ? 1 : 0)

  tr.setSelection(TextSelection.create(tr.doc, Math.min(tr.doc.content.size - 1, caret)))
  editor.view.dispatch(tr.scrollIntoView())
  return { citeId, insertedSpaces: { before: spaceBefore, after: spaceAfter } }
}

export function updateReplyChipComment(editor: Editor, citeId: string, comment: string): boolean {
  const found = findReplyChipPos(editor.state.doc, citeId)

  if (!found) return false
  const { pos, node } = found
  const current = contextReferenceAttrs(node.attrs as Record<string, unknown>)

  if (current.kind !== "reply") return false
  const next = withReplyComment(current, comment)
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    label: next.label,
    comment: next.comment ?? null,
    citeId,
  })

  editor.view.dispatch(tr)
  return true
}

export function removeReplyChip(editor: Editor, citeId: string, spaces: InsertedSpaces): boolean {
  const found = findReplyChipPos(editor.state.doc, citeId)

  if (!found) return false
  const { pos, node } = found
  const { doc } = editor.state
  const end = pos + node.nodeSize
  const $pos = doc.resolve(pos)
  const $end = doc.resolve(end)
  const from =
    spaces.before && $pos.parentOffset > 0 && doc.textBetween(pos - 1, pos) === " " ? pos - 1 : pos
  const to =
    spaces.after &&
    $end.parentOffset < $end.parent.content.size &&
    doc.textBetween(end, end + 1) === " "
      ? end + 1
      : end
  const tr = closeHistory(editor.state.tr.delete(from, to))

  editor.view.dispatch(tr.scrollIntoView())
  return true
}

export function focusAfterReplyChip(editor: Editor, citeId: string): void {
  const found = findReplyChipPos(editor.state.doc, citeId)

  if (!found) {
    editor.view.focus()
    return
  }

  const end = found.pos + found.node.nodeSize
  const { doc } = editor.state
  const $end = doc.resolve(end)
  const hasTrailingSpace =
    $end.parentOffset < $end.parent.content.size && doc.textBetween(end, end + 1) === " "
  const target = hasTrailingSpace ? end + 1 : end

  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(doc, Math.min(doc.content.size - 1, target))),
  )
  editor.view.focus()
}

export function isDirectoryMentionPath(path: string): boolean {
  if (!path) return false

  if (path.endsWith("/")) return true
  const base = path.split("/").filter(Boolean).pop() ?? path

  if (base.includes(".")) return false
  return !EXTENSIONLESS_FILES.has(base.toLowerCase())
}

export function mentionLanguage(path: string): string {
  const base = path.split("/").filter(Boolean).pop() ?? path
  const dot = base.lastIndexOf(".")
  return (dot > 0 ? base.slice(dot + 1) : base).toLowerCase()
}
