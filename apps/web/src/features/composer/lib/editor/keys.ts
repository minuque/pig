import type { Editor } from "@tiptap/core"
import { newlineInCode, splitBlockKeepMarks } from "@tiptap/pm/commands"
import { type EditorState, TextSelection, type Transaction } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { isChipNode } from "@features/composer/lib/editor/chip-tokens.js"
import {
  convertCodeFenceOnEnter,
  exitCodeBlockOnClosingFence,
  exitCodeBlockOnTrailingBlankLines,
  indentCodeBlock,
  indentedNewlineInCodeBlock,
  selectionInOneCodeBlock,
} from "@features/composer/lib/editor/code-block.js"
import { buildDocJson } from "@features/composer/lib/editor/doc-parse.js"
import {
  flatToPm,
  markdownOffsetAt,
  markdownToFlat,
  serializedMarkdownOffset,
  stepCaretAcrossStyledEdge,
} from "@features/composer/lib/editor/doc-offset.js"
import { serializeEditorDoc } from "@features/composer/lib/editor/doc-serialize.js"
import {
  listIndentForTab,
  listOutdentForTab,
  type ListEdit,
} from "@features/composer/lib/editor/list-indent.js"
import { listItemTypeAt, splitOrLiftListItem } from "@features/composer/lib/editor/lists.js"
import { collapseShownMarkdownSource } from "@features/composer/lib/editor/source-ranges.js"

const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.metaKey || event.ctrlKey
}

function inBlockquote(state: EditorState): boolean {
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "blockquote") return true
  }

  return false
}

export function selectMarkdownOffset(editor: Editor, source: string, offset: number): void {
  for (let pass = 0; pass < 2; pass += 1) {
    const map = serializeEditorDoc(editor.state.doc)
    const pos = flatToPm(
      map,
      markdownToFlat(map, serializedMarkdownOffset(source, map.value, offset)),
    )
    const { selection } = editor.state

    if (pass > 0 && selection.empty && selection.from === pos) return
    editor.commands.setTextSelection(pos)
  }
}

export function stepCaretOnArrow(view: EditorView, event: KeyboardEvent): boolean {
  if (!ARROWS.has(event.key) || event.shiftKey || hasModifier(event) || event.isComposing) {
    return false
  }

  const { state } = view

  if (!state.selection.empty) return false
  const { $from } = state.selection
  const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1
  const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight"
  const edge =
    direction === -1 ? TextSelection.atStart(state.doc).from : TextSelection.atEnd(state.doc).to
  const step = horizontal || $from.pos === edge ? stepCaretAcrossStyledEdge(state, direction) : null

  if (step) {
    event.preventDefault()
    view.dispatch(step)
    return true
  }

  const adjacent = direction === -1 ? $from.nodeBefore : $from.nodeAfter

  if (!horizontal || !isChipNode(adjacent)) return false
  event.preventDefault()
  const target = $from.pos + direction * adjacent!.nodeSize

  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, target)).scrollIntoView())
  return true
}

function applyListEdit(editor: Editor, edit: ListEdit | null): boolean {
  if (!edit) return false
  const { value } = serializeEditorDoc(editor.state.doc)
  const next = value.slice(0, edit.start) + edit.replacement + value.slice(edit.end)

  editor.commands.setContent(buildDocJson(next), { emitUpdate: false })
  selectMarkdownOffset(editor, next, edit.cursorAfter)
  return true
}

export function handleTab(editor: Editor, event: KeyboardEvent): boolean {
  if (event.key !== "Tab" || hasModifier(event) || event.isComposing) return false
  const { state, view } = editor

  if (selectionInOneCodeBlock(state)) {
    event.preventDefault()
    return indentCodeBlock(state, event.shiftKey ? "out" : "in", (tr) => view.dispatch(tr))
  }

  const { from, to } = state.selection

  if (from !== to) return false
  const offset = markdownOffsetAt(state.doc, from)
  const { value } = serializeEditorDoc(state.doc)
  const edit = event.shiftKey
    ? listOutdentForTab(value, offset, offset)
    : listIndentForTab(value, offset, offset)

  if (!applyListEdit(editor, edit)) return false
  event.preventDefault()
  return true
}

function enterInCodeBlock(view: EditorView): boolean {
  const dispatch = (tr: Transaction) => view.dispatch(tr.scrollIntoView())
  return (
    exitCodeBlockOnClosingFence(view.state, dispatch) ||
    exitCodeBlockOnTrailingBlankLines(view) ||
    indentedNewlineInCodeBlock(view.state, dispatch) ||
    newlineInCode(view.state, dispatch)
  )
}

function enterInStructure(editor: Editor, shift: boolean): boolean {
  const { view } = editor
  const { state } = view

  if (selectionInOneCodeBlock(state)) return enterInCodeBlock(view)

  if (convertCodeFenceOnEnter(state, (tr) => view.dispatch(tr))) return true

  if (listItemTypeAt(state.selection.$from)) {
    return splitOrLiftListItem(editor, collapseShownMarkdownSource)
  }

  const emptyLine = state.selection.$from.parent.content.size === 0

  if (inBlockquote(state) && emptyLine && editor.commands.lift("blockquote")) return true

  if (!shift) return false
  return editor
    .chain()
    .command(collapseShownMarkdownSource)
    .command(({ state: next, dispatch }) => splitBlockKeepMarks(next, dispatch))
    .scrollIntoView()
    .run()
}

export function handleEnter(editor: Editor, event: KeyboardEvent): boolean {
  if (event.key !== "Enter" || hasModifier(event) || event.isComposing) return false

  if (!enterInStructure(editor, event.shiftKey)) return false
  event.preventDefault()
  return true
}
