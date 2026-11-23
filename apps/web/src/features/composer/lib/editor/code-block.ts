import { exitCode } from "@tiptap/pm/commands"
import { type EditorState, TextSelection, type Transaction } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { isClosingFence, parseOpeningFence } from "@features/composer/lib/editor/doc-parse.js"
import { serializeSelection } from "@features/composer/lib/editor/doc-serialize.js"

type Dispatch = (transaction: Transaction) => void

const CODE_BLOCK_INDENT = "  "

function outdentLine(line: string): string {
  if (line.startsWith(CODE_BLOCK_INDENT)) return line.slice(CODE_BLOCK_INDENT.length)

  if (line.startsWith("\t") || line.startsWith(" ")) return line.slice(1)
  return line
}

export function selectionInOneCodeBlock(state: EditorState): boolean {
  const { $from, $to } = state.selection
  return $from.parent.type.spec.code === true && $from.sameParent($to)
}

function codeBlockRange(state: EditorState) {
  const { $from } = state.selection

  if (!selectionInOneCodeBlock(state)) return null
  const from = $from.start()
  return { from, to: from + $from.parent.content.size, text: $from.parent.textContent }
}

export function indentedNewlineInCodeBlock(state: EditorState, dispatch?: Dispatch): boolean {
  const block = codeBlockRange(state)

  if (!block) return false
  const { from, to } = state.selection
  const beforeCursor = block.text.slice(0, from - block.from)
  const line = beforeCursor.slice(beforeCursor.lastIndexOf("\n") + 1)
  const indent = /^[ \t]*/.exec(line)?.[0] ?? ""

  if (indent.length === 0) return false

  if (dispatch) {
    const inserted = `\n${indent}`
    const tr = state.tr.insertText(inserted, from, to)

    tr.setSelection(TextSelection.create(tr.doc, from + inserted.length))
    dispatch(tr.scrollIntoView())
  }

  return true
}

export function exitCodeBlockOnTrailingBlankLines(view: EditorView): boolean {
  const { $from, empty } = view.state.selection

  if (!empty || $from.parent.type.spec.code !== true) return false

  if ($from.parentOffset !== $from.parent.content.size) return false
  const trailing = /\n[ \t]*\n[ \t]*$/.exec($from.parent.textContent)

  if (!trailing) return false
  const tr = view.state.tr.delete($from.pos - trailing[0].length, $from.pos)

  if (!$from.parent.attrs["close"]) {
    tr.setNodeAttribute($from.before(), "close", `\n${String($from.parent.attrs["fence"])}`)
  }

  view.dispatch(tr)
  return exitCode(view.state, (next) => view.dispatch(next.scrollIntoView()))
}

export function exitCodeBlockOnClosingFence(state: EditorState, dispatch?: Dispatch): boolean {
  const block = codeBlockRange(state)

  if (!block || !state.selection.empty) return false
  const caret = state.selection.from - block.from
  const lineStart = block.text.lastIndexOf("\n", caret - 1) + 1
  const newlineAfter = block.text.indexOf("\n", caret)
  const lineEnd = newlineAfter === -1 ? block.text.length : newlineAfter
  const line = block.text.slice(lineStart, lineEnd)
  const node = state.selection.$from.parent

  if (caret !== lineEnd || !isClosingFence(line, String(node.attrs["fence"]))) return false

  if (dispatch) {
    const { schema } = state
    const paragraph = (text: string) =>
      schema.nodes["paragraph"]!.create(null, text ? schema.text(text) : null)
    const code = block.text.slice(0, Math.max(0, lineStart - 1))
    const rest = newlineAfter === -1 ? [] : block.text.slice(newlineAfter + 1).split("\n")
    const closed = node.type.create(
      { ...node.attrs, close: `\n${line}` },
      code ? schema.text(code) : null,
    )
    const start = state.selection.$from.before()
    const tr = state.tr.replaceWith(start, start + node.nodeSize, [
      closed,
      paragraph(""),
      ...rest.map(paragraph),
    ])

    tr.setSelection(TextSelection.create(tr.doc, start + closed.nodeSize + 1))
    dispatch(tr.scrollIntoView())
  }

  return true
}

export function indentCodeBlock(
  state: EditorState,
  direction: "in" | "out",
  dispatch?: Dispatch,
): boolean {
  const block = codeBlockRange(state)

  if (!block) return false
  const { from, to } = state.selection

  if (from === to && direction === "in") {
    dispatch?.(state.tr.insertText(CODE_BLOCK_INDENT, from, to).scrollIntoView())
    return true
  }

  const startOffset = from - block.from
  const endOffset = to - block.from
  const lineStart = startOffset === 0 ? 0 : block.text.lastIndexOf("\n", startOffset - 1) + 1
  const newlineAfter = block.text.indexOf("\n", Math.max(startOffset, endOffset - 1))
  const lineEnd = newlineAfter === -1 ? block.text.length : newlineAfter
  const original = block.text.slice(lineStart, lineEnd).split("\n")
  const lines = original.map((line) =>
    direction === "in" ? (line ? `${CODE_BLOCK_INDENT}${line}` : line) : outdentLine(line),
  )

  if (lines.join("\n") === original.join("\n")) return true

  if (dispatch) {
    const text = lines.join("\n")
    const tr = state.tr.insertText(text, block.from + lineStart, block.from + lineEnd)
    const firstDelta = (lines[0]?.length ?? 0) - (original[0]?.length ?? 0)
    const totalDelta = text.length - original.join("\n").length
    const nextFrom = Math.max(block.from + lineStart, from + firstDelta)
    const nextTo = Math.max(nextFrom, to + totalDelta)

    tr.setSelection(TextSelection.create(tr.doc, nextFrom, nextTo))
    dispatch(tr.scrollIntoView())
  }

  return true
}

export function convertCodeFenceOnEnter(state: EditorState, dispatch?: Dispatch): boolean {
  const { $from, empty } = state.selection

  if (!empty || $from.parent.type.name !== "paragraph" || $from.depth !== 1) return false

  if ($from.parentOffset !== $from.parent.content.size) return false
  const opening = parseOpeningFence(serializeSelection(state.doc, $from.start(), $from.end()))
  const codeBlock = state.schema.nodes["codeBlock"]

  if (!opening || !codeBlock) return false

  if (dispatch) {
    const start = $from.before()
    const { fence, language } = opening
    const tr = state.tr.replaceWith(
      start,
      start + $from.parent.nodeSize,
      codeBlock.create({ language, fence, close: `\n${fence}` }),
    )

    tr.setSelection(TextSelection.create(tr.doc, start + 1))
    dispatch(tr.scrollIntoView())
  }

  return true
}
