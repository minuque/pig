import { InputRule } from "@tiptap/core"
import type { MarkType, Node as ProseMirrorNode } from "@tiptap/pm/model"
import { type EditorState, TextSelection } from "@tiptap/pm/state"
import { buildTiptapContent } from "@features/composer/lib/editor/doc-parse.js"
import { serializeEditorDoc } from "@features/composer/lib/editor/doc-serialize.js"
import { codeSpanEndingAt } from "@features/composer/lib/editor/rich-text.js"

function openingTickRun(text: string): number {
  let index = text.length - 1

  while (text[index] === "`") index -= 1
  const run = text.length - 1 - index

  while (run > 0 && index >= 0 && text[index] !== "\n") {
    if (text[index] !== "`") {
      index -= 1
      continue
    }

    const end = index

    while (text[index - 1] === "`") index -= 1

    if (end - index + 1 === run) return index
    index -= 1
  }

  return -1
}

function lineMarkdown(state: EditorState, pos: number): string {
  const $pos = state.doc.resolve(pos)
  const { schema } = state
  const prefix = $pos.parent.content.cut(0, $pos.parentOffset)
  const paragraph = schema.nodes["paragraph"]!.create(null, prefix)
  return serializeEditorDoc(state.doc.type.create(null, paragraph)).value
}

function rebuiltInline(state: EditorState, markdown: string): ProseMirrorNode | null {
  const blocks = buildTiptapContent(markdown, { blocks: false })
  const doc = state.schema.nodeFromJSON({ type: "doc", content: blocks })
  return doc.childCount === 1 ? doc.firstChild : null
}

export function codeSpanRule(type: MarkType): InputRule {
  return new InputRule({
    find: (text) => {
      const start = text.endsWith("`") ? openingTickRun(text) : -1
      return start === -1 ? null : { index: start, text: text.slice(start) }
    },
    handler: ({ state, range }) => {
      const $end = state.doc.resolve(range.to)

      if (!$end.parent.isTextblock || $end.parent.type.spec.code) return null
      const markdown = lineMarkdown(state, range.to)

      if (codeSpanEndingAt(markdown) === null) return null
      const rebuilt = rebuiltInline(state, markdown)
      const last = rebuilt?.lastChild

      if (!rebuilt || !last || !type.isInSet(last.marks)) return null
      const start = $end.start()
      const { tr } = state

      tr.replaceWith(start, range.to, rebuilt.content)
      tr.setSelection(TextSelection.create(tr.doc, start + rebuilt.content.size))
      tr.setStoredMarks([])
      return undefined
    },
  })
}
