import { InputRule, markInputRule } from "@tiptap/core"
import { Bold } from "@tiptap/extension-bold"
import { Code } from "@tiptap/extension-code"
import { Italic } from "@tiptap/extension-italic"
import { Strike } from "@tiptap/extension-strike"
import type { MarkType, ResolvedPos } from "@tiptap/pm/model"
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state"
import { ReplaceStep } from "@tiptap/pm/transform"
import { codeSpanRule } from "@features/composer/lib/editor/code-span.js"
import {
  inlineMarkdownUnitMarks,
  MARKDOWN_SOURCE_MARK,
  type RichTextMark,
} from "@features/composer/lib/editor/rich-text.js"

type CodePair = { from: number; to: number }

const BOLD_STAR = /(?<!\*)\*\*([^\s*](?:[^*]*[^\s*])?)\*\*$/
const BOLD_UNDERSCORE = /(?<![\p{L}\p{M}\p{N}_])__([^\s_](?:[^_]*[^\s_])?)__$/u
const ITALIC_STAR = /(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*$/
const STRIKE_TILDE = /(?<!~)~~([^\s~](?:[^~]*[^\s~])?)~~$/
const codePairKey = new PluginKey<CodePair[]>("composerBacktickPairs")

export function touchesMarkdownSource(state: EditorState, from: number, to: number): boolean {
  const type = state.schema.marks[MARKDOWN_SOURCE_MARK]

  if (!type) return false

  if (from < to) return state.doc.rangeHasMark(from, to, type)
  const $pos = state.doc.resolve(from)
  return [$pos.nodeBefore, $pos.nodeAfter].some((node) => node && type.isInSet(node.marks))
}

export function literalBackticksBefore($pos: ResolvedPos): number {
  let count = 0

  $pos.parent.forEach((node, offset) => {
    if (offset >= $pos.parentOffset) return

    if (!node.isText) {
      count = 0
      return
    }

    if (node.marks.some((mark) => mark.type.spec.code)) return
    const text = node.text!.slice(0, $pos.parentOffset - offset)

    count += [...text.matchAll(/(?<!`)`(?!`)/g)].length
  })
  return count
}

function closesBacktickPair($pos: ResolvedPos): boolean {
  return (
    $pos.parent.isTextblock &&
    !$pos.parent.type.spec.code &&
    /(^|[^`])`$/.test($pos.nodeBefore?.text ?? "") &&
    literalBackticksBefore($pos) % 2 === 1
  )
}

function composedCodePair(tr: Transaction): CodePair | undefined {
  if (tr.getMeta("composition") === undefined || tr.steps.length !== 1) return undefined
  const step = tr.steps[0]

  if (!(step instanceof ReplaceStep) || step.from !== step.to || step.slice.size !== 1) {
    return undefined
  }

  if (step.slice.content.firstChild?.text !== "`") return undefined

  if (!closesBacktickPair(tr.before.resolve(step.from))) return undefined
  return { from: step.from - 1, to: step.from + 1 }
}

function isPlainRange(state: EditorState, from: number, to: number): boolean {
  let plain = true

  state.doc.nodesBetween(from, to, (node) => {
    if (node.isInline && (!node.isText || node.marks.length > 0)) plain = false
  })
  return plain
}

function codeBeforeClosingTick(
  state: EditorState,
  from: number,
  type: MarkType,
  insert: () => Transaction,
): Transaction | null {
  const $from = state.doc.resolve(from)
  const after = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, "\n", "\n")
  const match = /^([^`\n]+)`(?!`)/.exec(after)

  if (!match) return null
  const end = from + match[1]!.length

  if (!isPlainRange(state, from, end + 1)) return null

  const tr = insert()
    .delete(end + 1, end + 2)
    .delete(from, from + 1)

  tr.addMark(from, end, type.create())
  tr.setSelection(TextSelection.create(tr.doc, from))
  tr.addStoredMark(type.create())
  return tr
}

function closeTypedPair(state: EditorState, type: MarkType): Transaction | null {
  const pair = codePairKey.getState(state)?.find(({ to }) => to === state.selection.from)

  if (!pair) return null
  const $start = state.doc.resolve(pair.from)
  const $end = state.selection.$from

  if (!$start.sameParent($end) || $start.parent.type.spec.code) return null

  if (
    $start.nodeBefore?.text?.endsWith("`") ||
    $end.nodeAfter?.text?.startsWith("`") ||
    !/^`[^`]+`$/.test(state.doc.textBetween(pair.from, pair.to))
  ) {
    return null
  }

  if (!isPlainRange(state, pair.from, pair.to)) return null
  const tr = state.tr.delete(pair.to - 1, pair.to).delete(pair.from, pair.from + 1)

  tr.addMark(pair.from, pair.to - 2, type.create())
  tr.setSelection(TextSelection.create(tr.doc, pair.to - 2))
  tr.removeStoredMark(type)
  return tr
}

function codePairPlugin(type: MarkType): Plugin<CodePair[]> {
  return new Plugin<CodePair[]>({
    key: codePairKey,
    state: {
      init: () => [],
      apply(tr, pairs) {
        const mapped = pairs.flatMap((pair) => {
          const from = tr.mapping.mapResult(pair.from, 1)
          const to = tr.mapping.mapResult(pair.to, -1)
          return from.deleted || to.deleted ? [] : [{ from: from.pos, to: to.pos }]
        })
        const typed = (tr.getMeta(codePairKey) as CodePair | undefined) ?? composedCodePair(tr)
        return typed ? [...mapped, typed] : mapped
      },
    },
    props: {
      handleTextInput(view, from, to, text, insert) {
        if (view.composing || from !== to || text !== "`") return false
        const $from = view.state.doc.resolve(from)

        if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false

        if (touchesMarkdownSource(view.state, from, to)) return false

        if (closesBacktickPair($from)) {
          view.dispatch(insert().setMeta(codePairKey, { from: from - 1, to: from + 1 }))
          return true
        }

        if (($from.nodeBefore?.text ?? "").endsWith("`")) return false
        const tr = codeBeforeClosingTick(view.state, from, type, insert)

        if (!tr) return false
        view.dispatch(tr)
        return true
      },
    },
    appendTransaction(transactions, oldState, state) {
      if (!state.selection.empty || oldState.selection.from === state.selection.from) return null

      if (transactions.some((tr) => tr.docChanged)) return null
      return closeTypedPair(state, type)
    },
  })
}

function plainTextBefore(state: EditorState, pos: number): string {
  const $pos = state.doc.resolve(pos)
  let text = ""

  $pos.parent.forEach((node, offset) => {
    if (offset >= $pos.parentOffset) return
    const length = Math.min(node.nodeSize, $pos.parentOffset - offset)
    const plain = node.isText && node.marks.length === 0

    text += plain ? node.text!.slice(0, length) : "￼".repeat(length)
  })
  return text
}

function parsesAs(text: string, start: number, delimiter: number, mark: RichTextMark): boolean {
  const units = inlineMarkdownUnitMarks(text)

  for (let index = start; index < text.length; index += 1) {
    const isDelimiter = index < start + delimiter || index >= text.length - delimiter
    const marks = units[index]

    if (isDelimiter ? marks !== null : marks?.includes(mark) !== true) return false
  }

  return true
}

function flankingMarkRule(find: RegExp, type: MarkType, delimiter: number): InputRule {
  const rule = markInputRule({ find, type })
  return new InputRule({
    find,
    handler: (props) => {
      const { state, range, match } = props

      if (touchesMarkdownSource(state, range.from, range.to)) return null
      const text = plainTextBefore(state, range.to)

      if (!parsesAs(text, text.length - match[0].length, delimiter, type.name as RichTextMark)) {
        return null
      }

      return rule.handler(props)
    },
  })
}

export const ComposerCode = Code.extend({
  excludes: "code",
  exitable: false,
  addOptions() {
    return { ...this.parent!(), HTMLAttributes: { dir: "ltr" } }
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), codePairPlugin(this.type)]
  },
  addInputRules() {
    return [codeSpanRule(this.type)]
  },
})
export const ComposerBold = Bold.extend({
  addInputRules() {
    return [
      flankingMarkRule(BOLD_STAR, this.type, 2),
      flankingMarkRule(BOLD_UNDERSCORE, this.type, 2),
    ]
  },
  addPasteRules() {
    return []
  },
})
export const ComposerItalic = Italic.extend({
  addInputRules() {
    return [flankingMarkRule(ITALIC_STAR, this.type, 1)]
  },
  addPasteRules() {
    return []
  },
})
export const ComposerStrike = Strike.extend({
  addInputRules() {
    return [flankingMarkRule(STRIKE_TILDE, this.type, 2)]
  },
  addPasteRules() {
    return []
  },
})
