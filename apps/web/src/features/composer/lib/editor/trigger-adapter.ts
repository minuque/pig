import type { Editor } from "@tiptap/core"
import { TextSelection, type Transaction } from "@tiptap/pm/state"
import type { EditorChange, TextEditorAdapter } from "@pig/ui/trigger-menu"

const TOKEN_TEXT = "￼"

export interface TriggerAdapterHooks {
  external(): boolean
  submit(): void
}

export function createTriggerAdapter(
  editor: Editor,
  hooks: TriggerAdapterHooks,
): TextEditorAdapter {
  const listeners = new Set<(change: EditorChange) => void>()
  const notify = (change: EditorChange) => listeners.forEach((listener) => listener(change))

  function onTransaction({ transaction }: { transaction: Transaction }) {
    if (!transaction.docChanged) {
      if (transaction.selectionSet) notify({ type: "selection" })
      return
    }

    const before = transaction.before
    const start = transaction.doc.content.findDiffStart(before.content)

    if (start === null) return

    const end = transaction.doc.content.findDiffEnd(before.content) ?? {
      a: transaction.doc.content.size,
      b: before.content.size,
    }
    const overlap = Math.max(0, start - Math.min(end.a, end.b))
    const endBefore = end.b + overlap
    const endAfter = end.a + overlap

    notify({
      type: "input",
      inserted: transaction.doc.textBetween(start, endAfter, "\n", TOKEN_TEXT),
      range: { start, end: endBefore },
      user: !hooks.external(),
    })
  }

  const onCompositionStart = () => notify({ type: "compositionstart" })
  const onCompositionEnd = () => notify({ type: "compositionend" })
  return {
    get element() {
      return editor.isDestroyed ? undefined : editor.view.dom
    },
    textBefore(length) {
      const { $from, empty } = editor.state.selection

      if (!empty || !$from.parent.isTextblock) return null
      const blockStart = $from.start()
      const from = Math.max(blockStart, $from.pos - length)
      const text = editor.state.doc.textBetween(from, $from.pos, "\n", TOKEN_TEXT)
      return from === blockStart ? { text: `\n${text}`, offset: from - 1 } : { text, offset: from }
    },
    selection() {
      if (!editor.isFocused) return null
      const { from, to } = editor.state.selection
      return { start: from, end: to }
    },
    rectAt(offset) {
      const pos = Math.max(0, Math.min(offset, editor.state.doc.content.size))
      const coords = editor.view.coordsAtPos(pos)
      return {
        x: coords.left,
        y: coords.top,
        width: Math.max(1, coords.right - coords.left),
        height: coords.bottom - coords.top,
      }
    },
    replace(range, content) {
      if (typeof content !== "string") return
      const tr = editor.state.tr.insertText(content, range.start, range.end)
      tr.setSelection(TextSelection.create(tr.doc, range.start + content.length))
      editor.view.dispatch(tr)
    },
    subscribe(listener) {
      if (!listeners.size) {
        editor.on("transaction", onTransaction)
        editor.view.dom.addEventListener("compositionstart", onCompositionStart)
        editor.view.dom.addEventListener("compositionend", onCompositionEnd)
      }

      listeners.add(listener)
      return () => {
        listeners.delete(listener)

        if (listeners.size || editor.isDestroyed) return
        editor.off("transaction", onTransaction)
        editor.view.dom.removeEventListener("compositionstart", onCompositionStart)
        editor.view.dom.removeEventListener("compositionend", onCompositionEnd)
      }
    },
    composing: () => editor.view.composing,
    submit: () => hooks.submit(),
  }
}
