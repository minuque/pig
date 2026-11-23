import type { Editor, JSONContent } from "@tiptap/core"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { splitPromptSegments } from "@features/composer/lib/editor/chip-tokens.js"
import { buildTiptapContent } from "@features/composer/lib/editor/doc-parse.js"
import { markdownOffsetAt } from "@features/composer/lib/editor/doc-offset.js"
import {
  serializeEditorDoc,
  serializeSelection,
} from "@features/composer/lib/editor/doc-serialize.js"
import { MARKDOWN_SOURCE_MARK } from "@features/composer/lib/editor/rich-text.js"
import { collapseShownMarkdownSource } from "@features/composer/lib/editor/source-ranges.js"
import { markAsClipboardEdit } from "@features/composer/lib/editor/undo-grouping.js"

export const COMPOSER_CLIPBOARD_MIME = "application/x-pig-composer"
const NESTED = new Set(["listItem", "taskItem", "blockquote"])

export function copySelection(view: EditorView, event: ClipboardEvent, cut: boolean): boolean {
  const { clipboardData } = event
  const { from, to } = view.state.selection

  if (!clipboardData || from === to || (cut && !view.editable)) return false
  const text = serializeSelection(view.state.doc, from, to)

  event.preventDefault()
  clipboardData.setData("text/plain", text)
  clipboardData.setData(COMPOSER_CLIPBOARD_MIME, text)

  if (cut) view.dispatch(markAsClipboardEdit(view.state.tr.deleteSelection(), "cut"))
  return true
}

function insertPlain(view: EditorView, text: string): true {
  const { from, to } = view.state.selection

  view.dispatch(
    markAsClipboardEdit(view.state.tr.insertText(text, from, to), "paste").scrollIntoView(),
  )
  return true
}

function hasNestedAncestor(view: EditorView): boolean {
  const { $from } = view.state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (NESTED.has($from.node(depth).type.name)) return true
  }

  return false
}

function padChips(view: EditorView, text: string): string {
  const segments = splitPromptSegments(text)
  const doc = view.state.doc
  let padded = text

  if (segments.at(-1)?.type !== "text" && segments.length > 0) padded += " "

  if (segments[0] && segments[0].type !== "text") {
    const offset = markdownOffsetAt(doc, view.state.selection.from)
    const before = serializeEditorDoc(doc).value[offset - 1]

    if (offset > 0 && before !== undefined && !/\s/.test(before)) padded = ` ${padded}`
  }

  return padded
}

function insertParsed(editor: Editor, view: EditorView, text: string, chips: boolean): void {
  const blocks = buildTiptapContent(text, { chips, blocks: !hasNestedAncestor(view) })
  const single = blocks.length === 1 && blocks[0]?.["type"] === "paragraph"
  const content = (single ? (blocks[0]?.["content"] ?? []) : blocks) as JSONContent[]

  if (content.length === 0) return
  editor
    .chain()
    .command(({ tr }) => {
      markAsClipboardEdit(tr, "paste")
      return true
    })
    .command(collapseShownMarkdownSource)
    .insertContent(content)
    .command(({ tr }) => {
      const { selection } = tr

      if (!(selection instanceof NodeSelection) || !selection.node.isBlock) return true

      if (!tr.doc.resolve(selection.to).nodeAfter?.isTextblock) {
        tr.insert(selection.to, tr.doc.type.schema.nodes["paragraph"]!.create())
      }

      tr.setSelection(TextSelection.create(tr.doc, selection.to + 1))
      return true
    })
    .scrollIntoView()
    .run()
}

export function pasteMarkdown(editor: Editor, view: EditorView, data: DataTransfer): boolean {
  const composerText = data.getData(COMPOSER_CLIPBOARD_MIME)
  const chips = composerText.length > 0
  const text = (chips ? composerText : data.getData("text/plain")).replace(/\r\n?/g, "\n")

  if (!text) return false
  const { $from } = view.state.selection

  if ($from.parent.type.spec.code === true) return insertPlain(view, text)
  const sourceType = view.state.schema.marks[MARKDOWN_SOURCE_MARK]
  const tokens = splitPromptSegments(text).some((segment) => segment.type !== "text")

  if (sourceType?.isInSet($from.marks()) && !text.includes("\n") && !(chips && tokens)) {
    return insertPlain(view, text)
  }

  insertParsed(editor, view, chips ? padChips(view, text) : text, chips)
  return true
}
