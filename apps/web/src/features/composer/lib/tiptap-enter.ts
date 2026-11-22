import { lift, newlineInCode, splitBlock } from "@tiptap/pm/commands"
import type { NodeType } from "@tiptap/pm/model"
import { liftListItem, splitListItem } from "@tiptap/pm/schema-list"
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state"
import {
  CLOSING_FENCE,
  isClosingFence,
  parseOpeningFence,
} from "@features/composer/lib/tiptap-markdown.js"

const TRAILING_BLANK = /\n[ \t]*\n[ \t]*$/u
const LIST_ITEMS = new Set(["listItem", "taskItem"])

type Dispatch = (transaction: Transaction) => void

function codeBlock(state: EditorState): { text: string; caret: number } | undefined {
  const { $from, $to } = state.selection

  if ($from.parent.type.spec.code !== true || !$from.sameParent($to)) return undefined
  return { text: $from.parent.textContent, caret: $from.pos - $from.start() }
}

function replaceCodeBlock(state: EditorState, dispatch: Dispatch | undefined, text: string): void {
  if (!dispatch) return
  const { $from } = state.selection
  const parent = $from.parent
  const start = $from.before()
  const block = parent.type.create(parent.attrs, text ? state.schema.text(text) : null)
  const paragraph = state.schema.nodes["paragraph"]!.createAndFill()!
  const tr = state.tr.replaceWith(start, start + parent.nodeSize, [block, paragraph])

  tr.setSelection(TextSelection.create(tr.doc, start + block.nodeSize + 1))
  dispatch(tr.scrollIntoView())
}

function enterInCodeBlock(state: EditorState, dispatch?: Dispatch): boolean {
  const block = codeBlock(state)

  if (!block) return false
  const { text, caret } = block
  const { empty } = state.selection
  const lineStart = caret === 0 ? 0 : text.lastIndexOf("\n", caret - 1) + 1
  const nextBreak = text.indexOf("\n", caret)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak

  if (empty && caret === lineEnd && nextBreak === -1) {
    const line = text.slice(lineStart, lineEnd)

    if (isClosingFence(line, CLOSING_FENCE)) {
      replaceCodeBlock(state, dispatch, text.slice(0, Math.max(0, lineStart - 1)))
      return true
    }
  }

  if (empty && caret === text.length) {
    const trailing = TRAILING_BLANK.exec(text)

    if (trailing) {
      replaceCodeBlock(state, dispatch, text.slice(0, text.length - trailing[0].length))
      return true
    }
  }

  const indent = /^[ \t]*/u.exec(text.slice(lineStart, caret))?.[0] ?? ""

  if (!indent) return newlineInCode(state, dispatch)
  const tr = state.tr.insertText(`\n${indent}`, state.selection.from, state.selection.to)

  tr.setSelection(TextSelection.create(tr.doc, state.selection.from + indent.length + 1))
  dispatch?.(tr.scrollIntoView())
  return true
}

export function convertFenceOnEnter(state: EditorState, dispatch?: Dispatch): boolean {
  const { $from, empty } = state.selection

  if (!empty || $from.parent.type.name !== "paragraph" || $from.depth !== 1) return false

  if ($from.parentOffset !== $from.parent.content.size) return false
  const opening = parseOpeningFence($from.parent.textContent)
  const codeBlockType = state.schema.nodes["codeBlock"]

  if (!opening || !codeBlockType) return false

  if (dispatch) {
    const start = $from.before()
    const block = codeBlockType.create({ language: opening.language || null })
    const tr = state.tr.replaceWith(start, start + $from.parent.nodeSize, block)

    tr.setSelection(TextSelection.create(tr.doc, start + 1))
    dispatch(tr.scrollIntoView())
  }

  return true
}

function listItemType(state: EditorState) {
  const { $from } = state.selection

  if ($from.depth < 2) return undefined
  const node = $from.node(-1)
  return LIST_ITEMS.has(node.type.name) ? node.type : undefined
}

function itemAttrs(type: NodeType): Record<string, unknown> | undefined {
  return type.name === "taskItem" ? { checked: false } : undefined
}

export function splitOrLiftListItem(state: EditorState, dispatch?: Dispatch): boolean {
  const type = listItemType(state)

  if (!type) return false

  if (splitListItem(type, itemAttrs(type))(state, undefined)) {
    splitListItem(type, itemAttrs(type))(state, dispatch)
    return true
  }

  const { $from } = state.selection

  if ($from.parent.content.size > 0 || !liftListItem(type)(state, undefined)) return false
  liftListItem(type)(state, dispatch)
  return true
}

function liftOutOfBlockquote(state: EditorState, dispatch?: Dispatch): boolean {
  const { $from, empty } = state.selection

  if (!empty || $from.parent.content.size > 0) return false

  let quoted = false

  for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "blockquote") quoted = true
  }

  if (!quoted) return false
  return lift(state, dispatch)
}

export function splitLineOnShiftEnter(state: EditorState, dispatch?: Dispatch): boolean {
  return splitBlock(state, dispatch)
}

export function handleStructuredEnter(state: EditorState, dispatch?: Dispatch): boolean {
  return (
    enterInCodeBlock(state, dispatch) ||
    convertFenceOnEnter(state, dispatch) ||
    splitOrLiftListItem(state, dispatch) ||
    liftOutOfBlockquote(state, dispatch)
  )
}
