import { Extension, Mark as TiptapMark } from "@tiptap/core"
import {
  closeHistory,
  isHistoryTransaction,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from "@tiptap/pm/history"
import type { MarkType, Node as ProseMirrorNode } from "@tiptap/pm/model"
import {
  type EditorState,
  Plugin,
  PluginKey,
  type Selection,
  type Transaction,
} from "@tiptap/pm/state"
import { StepMap } from "@tiptap/pm/transform"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import { caretTakesMarksBefore } from "@features/composer/lib/editor/doc-offset.js"
import {
  inlineMarkdownUnitMarks,
  MARKDOWN_SOURCE_MARK,
  type RichTextMark,
} from "@features/composer/lib/editor/rich-text.js"
import {
  collapseMarkdownSource,
  collapseRegion,
  collapseShownMarkdownSource,
  forEachUnitRun,
  mapRange,
  regionUnits,
  revealStyledText,
  sourceRegions,
  touches,
  type TextRange,
} from "@features/composer/lib/editor/source-ranges.js"

type SourceState = {
  decorations: DecorationSet
  detached: boolean
  revealed: TextRange[]
}

const PREVIEW_TAGS: Record<Exclude<RichTextMark, "code">, string> = {
  bold: "strong",
  italic: "em",
  strike: "s",
}
const sourceKey = new PluginKey<SourceState>("composerMarkdownSource")
const replayKey = new PluginKey("composerMarkdownSourceReplay")

function byStartDescending(ranges: readonly TextRange[]): TextRange[] {
  return [...ranges].sort((left, right) => right.from - left.from)
}

function normalizeMarkdownSource(state: EditorState, typed: boolean): Transaction | null {
  const type = state.schema.marks[MARKDOWN_SOURCE_MARK]

  if (!type) return null
  const tr = state.tr

  collapseMarkdownSource(tr, (region) => touches(state.selection, region))
  revealStyledText(tr, type, typed, caretTakesMarksBefore(state))
  return tr.docChanged ? tr : null
}

function normalizeDetached(state: EditorState, revealed: TextRange[]): Transaction | null {
  const type = state.schema.marks[MARKDOWN_SOURCE_MARK]

  if (!type) return null
  const tr = state.tr
  const kept: TextRange[] = []

  for (const region of byStartDescending(revealed)) {
    if (touches(state.selection, region)) kept.push(region)
    else collapseRegion(tr, region, type)
  }

  const added = revealStyledText(tr, type, false, caretTakesMarksBefore(state))

  if (!tr.docChanged) return null
  const shown = [...kept.map((region) => mapRange(tr.mapping, region)), ...added]
  return tr.setMeta(sourceKey, shown).setMeta("addToHistory", false)
}

function collapseRevealed(state: EditorState, revealed: TextRange[]): Transaction {
  const tr = state.tr
  const type = state.schema.marks[MARKDOWN_SOURCE_MARK]

  if (type) {
    for (const region of byStartDescending(revealed)) collapseRegion(tr, region, type)
  }

  return tr.setMeta(sourceKey, []).setMeta("addToHistory", false)
}

function rebaseEdit(tr: Transaction, collapse: Transaction, edit: Transaction): Transaction {
  for (let index = collapse.steps.length - 1; index >= 0; index--) {
    tr.step(collapse.steps[index]!.invert(collapse.docs[index]!))
  }

  for (const step of edit.steps) tr.step(step)
  tr.setSelection(edit.selection.map(tr.doc, StepMap.empty)).setTime(edit.time)

  if (edit.storedMarksSet) tr.setStoredMarks(edit.storedMarks)

  if (edit.scrolledIntoView) tr.scrollIntoView()

  type WithMeta = { meta: Record<string, unknown> }

  Object.assign((tr as unknown as WithMeta).meta, (edit as unknown as WithMeta).meta)
  return tr
}

const replayPlugin = new Plugin({
  key: replayKey,
  appendTransaction([request, collapse], _, state) {
    const edit = request?.getMeta(replayKey) as Transaction | undefined
    return edit && collapse ? closeHistory(rebaseEdit(state.tr, collapse, edit)) : null
  },
})

function regionDecorations(doc: ProseMirrorNode, region: TextRange, hide: boolean): Decoration[] {
  const decorations: Decoration[] = []
  const { text, units } = regionUnits(doc, region)
  const codeTicks = new Set<number>()

  forEachUnitRun(units, (start, end, marks) => {
    for (const name of marks ?? []) {
      if (name !== "code") {
        const attrs = { nodeName: PREVIEW_TAGS[name] }

        decorations.push(Decoration.inline(region.from + start, region.from + end, attrs))
        continue
      }

      let from = start
      let to = end

      while (units[from - 1] === null && "` ".includes(text[from - 1]!)) codeTicks.add((from -= 1))

      while (units[to] === null && "` ".includes(text[to] ?? "_")) codeTicks.add(to++)
      const attrs = { nodeName: "code", dir: "ltr" }

      decorations.push(Decoration.inline(region.from + from, region.from + to, attrs))
    }
  })

  const markerUnits = units.map((marks, index) =>
    marks === null && (hide || !codeTicks.has(index)) ? null : [],
  )

  forEachUnitRun(markerUnits, (start, end, marks) => {
    if (marks !== null) return
    const attrs = { class: hide ? "is-source-marker-hidden" : "is-source-marker" }

    decorations.push(Decoration.inline(region.from + start, region.from + end, attrs))
  })
  return decorations
}

function previewDecorations(
  doc: ProseMirrorNode,
  type: MarkType,
  hidden: Selection | null,
): DecorationSet {
  const decorations = sourceRegions(doc, type).flatMap((region) =>
    regionDecorations(doc, region, hidden !== null && !touches(hidden, region)),
  )
  return DecorationSet.create(doc, decorations)
}

function applySourceState(
  tr: Transaction,
  old: SourceState,
  state: EditorState,
  type: MarkType,
): SourceState {
  const history = isHistoryTransaction(tr)
  const recorded = tr.docChanged && tr.getMeta("addToHistory") !== false
  const detached = history || (old.detached && !recorded)
  const own = tr.getMeta(sourceKey) as TextRange[] | undefined
  const mapped = tr.docChanged
    ? old.revealed.map((range) => mapRange(tr.mapping, range))
    : old.revealed
  const revealed = !detached || history ? [] : (own ?? mapped)
  const redraw = tr.docChanged || detached !== old.detached || (detached && tr.selectionSet)
  return {
    decorations: redraw
      ? previewDecorations(state.doc, type, detached ? state.selection : null)
      : old.decorations,
    detached,
    revealed,
  }
}

function markdownSourcePlugin(type: MarkType): Plugin<SourceState> {
  let view: EditorView | null = null
  return new Plugin<SourceState>({
    key: sourceKey,
    view(editorView) {
      view = editorView
      return {
        destroy() {
          view = null
        },
      }
    },
    state: {
      init: (_, state) => ({
        decorations: previewDecorations(state.doc, type, null),
        detached: false,
        revealed: [],
      }),
      apply: (tr, old, _, state) => applySourceState(tr, old, state, type),
    },
    props: {
      decorations: (state) => sourceKey.getState(state)?.decorations,
    },
    appendTransaction(transactions, _, state) {
      if (transactions[0]?.getMeta(replayKey)) {
        return collapseRevealed(state, sourceKey.getState(state)?.revealed ?? [])
      }

      if (view?.composing) return null

      if (transactions.some((tr) => isHistoryTransaction(tr) || tr.getMeta(sourceKey))) return null

      if (!transactions.some((tr) => tr.docChanged || tr.selectionSet)) return null
      const source = sourceKey.getState(state)

      if (source?.detached) return normalizeDetached(state, source.revealed)

      const tr = normalizeMarkdownSource(
        state,
        transactions.some((item) => item.docChanged),
      )

      if (tr && undoDepth(state) === 0) tr.setMeta("addToHistory", false)
      return tr
    },
  })
}

const MarkdownSourceHistory = Extension.create({
  name: "composerMarkdownSourceHistory",
  priority: 1,
  dispatchTransaction({ transaction, next }) {
    const { editor } = this
    const revealed = sourceKey.getState(editor.state)?.revealed ?? []

    if (isHistoryTransaction(transaction)) {
      if (revealed.length === 0) next(transaction)
      else {
        const undoing = redoDepth(editor.state.apply(transaction)) > redoDepth(editor.state)
        const replay = undoing ? undo : redo

        next(collapseRevealed(editor.state, revealed))
        replay(editor.state, next)
      }

      const source = sourceKey.getState(editor.state)
      const tr = editor.view.composing
        ? null
        : normalizeDetached(editor.state, source?.revealed ?? [])

      if (tr) next(tr)
      return
    }

    const recordedEdit =
      transaction.docChanged &&
      transaction.getMeta("addToHistory") !== false &&
      transaction.getMeta(sourceKey) === undefined

    if (revealed.length === 0 || !recordedEdit) {
      next(transaction)
      return
    }

    next(editor.state.tr.setMeta(replayKey, transaction))
  },
})
export const ComposerMarkdownSource = TiptapMark.create({
  name: MARKDOWN_SOURCE_MARK,
  priority: 1001,
  inclusive: false,
  parseHTML() {
    return [{ tag: "span.is-markdown-source" }]
  },
  renderHTML() {
    return ["span", { class: "is-markdown-source" }, 0]
  },
  addKeyboardShortcuts() {
    const toggle = (name: RichTextMark) => () => {
      const { state } = this.editor
      const { selection } = state
      const touched = sourceRegions(state.doc, this.type).some((region) => {
        if (!touches(selection, region)) return false

        if (!selection.empty) return true
        const { units } = regionUnits(state.doc, region)
        const offset = selection.from - region.from
        const before = units[offset - 1]
        const after = units[offset]
        return (
          (before === null && after?.includes(name) === true) ||
          (after === null && before?.includes(name) === true)
        )
      })

      if (!touched) return false
      return this.editor.chain().command(collapseShownMarkdownSource).toggleMark(name).run()
    }

    return {
      "Mod-b": toggle("bold"),
      "Mod-B": toggle("bold"),
      "Mod-i": toggle("italic"),
      "Mod-I": toggle("italic"),
      "Mod-Shift-s": toggle("strike"),
      "Mod-e": toggle("code"),
    }
  },
  addExtensions() {
    return [MarkdownSourceHistory]
  },
  addProseMirrorPlugins() {
    return [markdownSourcePlugin(this.type), replayPlugin]
  },
})

export function isInCodeContext(state: EditorState): boolean {
  const { $from, $to, empty } = state.selection
  const code = state.schema.marks["code"]

  if ($from.parent.type.spec.code === true) return true

  if (
    code &&
    (empty ? code.isInSet($from.marks()) : state.doc.rangeHasMark($from.pos, $to.pos, code))
  ) {
    return true
  }

  const source = state.schema.marks[MARKDOWN_SOURCE_MARK]

  if (!source || !$from.parent.inlineContent) return false
  const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, "￼")
  const before = inlineMarkdownUnitMarks(text)[$from.parentOffset - 1]
  return before?.includes("code") === true && !!source.isInSet($from.nodeBefore?.marks ?? [])
}
