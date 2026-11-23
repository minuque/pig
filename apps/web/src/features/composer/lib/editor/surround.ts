import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { type EditorState, TextSelection, type Transaction } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { isChipNode } from "@features/composer/lib/editor/chip-tokens.js"
import { buildTiptapContent } from "@features/composer/lib/editor/doc-parse.js"
import { serializeEditorDoc } from "@features/composer/lib/editor/doc-serialize.js"
import { touchesMarkdownSource } from "@features/composer/lib/editor/marks.js"
import { MARKDOWN_SOURCE_MARK } from "@features/composer/lib/editor/rich-text.js"

const SURROUND_MARKS: Record<string, string> = { "`": "code", "*": "italic", _: "italic" }

export function surroundSelectionWithMark(
  state: EditorState,
  from: number,
  to: number,
  marker: string,
): Transaction | null {
  const markType = state.schema.marks[SURROUND_MARKS[marker] ?? ""]

  if (!markType || touchesMarkdownSource(state, from, to)) return null
  const $from = state.doc.resolve(from)

  if (!$from.sameParent(state.doc.resolve(to)) || !$from.parent.type.allowsMarkType(markType)) {
    return null
  }

  const tr = state.tr.addMark(from, to, markType.create())
  const children: ProseMirrorNode[] = []

  tr.doc.resolve(from).parent.forEach((node) => {
    children.push(isChipNode(node) ? state.schema.text("￼", node.marks) : node)
  })
  const paragraph = state.schema.nodes["paragraph"]!.create(null, children)
  const markdown = serializeEditorDoc(state.doc.type.create(null, paragraph)).value
  const rebuilt = buildTiptapContent(markdown, { blocks: false, chips: false })
  const restored = state.schema.nodeFromJSON({ type: "doc", content: rebuilt })
  return paragraph.content.eq(restored.firstChild!.content) ? tr : null
}

function touchesStyledOrChip(state: EditorState, from: number, to: number): boolean {
  let touched = false

  state.doc.nodesBetween(from, to, (node) => {
    const styled = node.isText && node.marks.some((mark) => mark.type.name !== MARKDOWN_SOURCE_MARK)

    if (isChipNode(node) || styled) touched = true
    return !touched
  })
  return touched
}

export function wrapSelectionOnInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  if (view.composing || !(text in SURROUND_MARKS)) return false
  const { selection } = view.state

  if (!(selection instanceof TextSelection) || selection.empty) return false

  if (selection.from !== from || selection.to !== to) return false

  if (touchesStyledOrChip(view.state, from, to)) return false
  const markTr = surroundSelectionWithMark(view.state, from, to, text)

  if (markTr) {
    view.dispatch(markTr)
    return true
  }

  const tr = view.state.tr.insertText(text, to).insertText(text, from)

  tr.setSelection(TextSelection.create(tr.doc, from + text.length, to + text.length))
  view.dispatch(tr)
  return true
}
