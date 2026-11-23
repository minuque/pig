import { type Editor, InputRule } from "@tiptap/core"
import { Blockquote } from "@tiptap/extension-blockquote"
import { CodeBlock } from "@tiptap/extension-code-block"
import { Heading } from "@tiptap/extension-heading"
import { HorizontalRule } from "@tiptap/extension-horizontal-rule"
import { Plugin, TextSelection, type EditorState } from "@tiptap/pm/state"

export function sourceAttr(value: string) {
  return { default: value, rendered: false }
}

export function withoutBlockChords<Shortcuts extends Record<string, unknown>>(
  shortcuts: Shortcuts | undefined,
  drop: readonly string[],
): Shortcuts {
  return Object.fromEntries(
    Object.entries(shortcuts ?? {}).filter(([key]) => !drop.includes(key)),
  ) as Shortcuts
}

function atTopLevelParagraph(state: EditorState, pos: number): boolean {
  const $from = state.doc.resolve(pos)
  return $from.parent.type.name === "paragraph" && $from.depth === 1
}

const blockquoteInputRule = new InputRule({
  find: /^>(\s)$/,
  handler: ({ state, range, match, chain }) => {
    if (!atTopLevelParagraph(state, range.from)) return null
    chain()
      .deleteRange(range)
      .wrapIn("blockquote", { prefix: `>${match[1] ?? " "}` })
      .run()
    return undefined
  },
})
const horizontalRuleInputRule = new InputRule({
  find: /^(---|\*\*\*|___)\s?$/,
  handler: ({ state, range, match, chain }) => {
    const source = match[0] ?? "---"

    if (!source.startsWith("---") && !/\s$/.test(source)) return null

    if (!atTopLevelParagraph(state, range.from)) return null
    chain()
      .deleteRange(range)
      .setHorizontalRule()
      .command(({ tr }) => {
        const $pos = tr.selection.$from
        const index = $pos.index(0) - 1

        if (index < 0) return true
        const rulePos = $pos.posAtIndex(index, 0)
        const rule = tr.doc.nodeAt(rulePos)

        if (rule?.type.name === "horizontalRule") {
          tr.setNodeMarkup(rulePos, undefined, { ...rule.attrs, source })
        }

        return true
      })
      .run()
    return undefined
  },
})
const headingInputRule = new InputRule({
  find: /^(#{1,6})(\s)$/,
  handler: ({ state, range, match, chain }) => {
    if (!atTopLevelParagraph(state, range.from)) return null
    chain()
      .deleteRange(range)
      .setNode("heading", { level: match[1]?.length ?? 1, space: match[2] ?? " " })
      .run()
    return undefined
  },
})
export const ComposerBlockquote = Blockquote.extend({
  content: "paragraph+",
  addAttributes() {
    return { ...this.parent?.(), prefix: sourceAttr("> ") }
  },
  addKeyboardShortcuts() {
    return withoutBlockChords(this.parent?.(), ["Mod-Shift-b"])
  },
  addInputRules() {
    return [blockquoteInputRule]
  },
})
export const ComposerHorizontalRule = HorizontalRule.extend({
  addAttributes() {
    return { ...this.parent?.(), source: sourceAttr("---") }
  },
  addInputRules() {
    return [horizontalRuleInputRule]
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        appendTransaction: (transactions, _, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null

          if (state.doc.lastChild?.type.name !== "horizontalRule") return null
          return state.tr.insert(state.doc.content.size, state.schema.nodes["paragraph"]!.create())
        },
      }),
    ]
  },
})
export const ComposerHeading = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), space: sourceAttr(" ") }
  },
  addKeyboardShortcuts() {
    return {}
  },
  addInputRules() {
    return [headingInputRule]
  },
}).configure({ levels: [1, 2, 3, 4, 5, 6] })

function unwrapCodeBlockAtStart(editor: Editor): boolean {
  const { $from, empty } = editor.state.selection

  if (!empty || $from.parent.type.name !== "codeBlock" || $from.parentOffset !== 0) return false
  const { schema } = editor.state
  const paragraphs = $from.parent.textContent
    .split("\n")
    .map((line) => schema.nodes["paragraph"]!.create(null, line ? schema.text(line) : null))
  const start = $from.before()
  const tr = editor.state.tr.replaceWith(start, $from.after(), paragraphs)

  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, start + 1)))
  return true
}

export const ComposerCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fence: sourceAttr("```"),
      close: sourceAttr("\n```"),
    }
  },
  addKeyboardShortcuts() {
    return {
      ...withoutBlockChords(this.parent?.(), ["Mod-Alt-c"]),
      Backspace: () => unwrapCodeBlockAtStart(this.editor),
    }
  },
  addInputRules() {
    return []
  },
}).configure({ defaultLanguage: "" })
