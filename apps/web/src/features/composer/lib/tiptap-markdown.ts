import { Extension, markInputRule, markPasteRule, type Extensions } from "@tiptap/core"
import { Blockquote } from "@tiptap/extension-blockquote"
import {
  Bold,
  starInputRegex as boldStarInput,
  starPasteRegex as boldStarPaste,
} from "@tiptap/extension-bold"
import { Code } from "@tiptap/extension-code"
import { CodeBlock } from "@tiptap/extension-code-block"
import { Heading } from "@tiptap/extension-heading"
import { HorizontalRule } from "@tiptap/extension-horizontal-rule"
import {
  Italic,
  starInputRegex as italicStarInput,
  starPasteRegex as italicStarPaste,
} from "@tiptap/extension-italic"
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list"
import { Strike } from "@tiptap/extension-strike"
import { TaskItem } from "@tiptap/extension-task-item"
import { TaskList } from "@tiptap/extension-task-list"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state"

export const CLOSING_FENCE = "```"

export function headingPrefix(level: number): string {
  return `${"#".repeat(Math.min(6, Math.max(1, level)))} `
}

export function openingFence(language: string): string {
  return `${CLOSING_FENCE}${language}`
}

export function parseOpeningFence(line: string): { fence: string; language: string } | null {
  const match = /^(`{3,}|~{3,})(.*)$/u.exec(line)

  if (!match) return null
  const fence = match[1]!
  const language = match[2]!.trim()

  if (fence.startsWith("`") && language.includes("`")) return null
  return { fence, language }
}

export function isClosingFence(line: string, fence: string): boolean {
  const match = /^(`{3,}|~{3,})[ \t]*$/u.exec(line)

  if (!match) return false
  return match[1]![0] === fence[0] && match[1]!.length >= fence.length
}

export function isInCodeBlock(state: EditorState): boolean {
  return state.selection.$from.parent.type.spec.code === true
}

export function isInCodeContext(state: EditorState): boolean {
  const { $from, $to, empty } = state.selection
  const code = state.schema.marks["code"]

  if (code) {
    const marked = empty
      ? code.isInSet($from.marks())
      : state.doc.rangeHasMark($from.pos, $to.pos, code)

    if (marked) return true
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.code === true) return true
  }

  return false
}

export const ComposerBold = Bold.extend({
  addInputRules() {
    return [markInputRule({ find: boldStarInput, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: boldStarPaste, type: this.type })]
  },
})
export const ComposerItalic = Italic.extend({
  addInputRules() {
    return [markInputRule({ find: italicStarInput, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: italicStarPaste, type: this.type })]
  },
})
export const ComposerStrike = Strike
export const ComposerCode = Code.extend({
  excludes: "code",
  addOptions() {
    return { ...this.parent!(), HTMLAttributes: { dir: "ltr" } }
  },
})
export const ComposerHeading = Heading.configure({ levels: [1, 2, 3, 4, 5, 6] })
export const ComposerBlockquote = Blockquote
export const ComposerCodeBlock = CodeBlock
export const ComposerHorizontalRule = HorizontalRule
export const ComposerBulletList = BulletList
export const ComposerOrderedList = OrderedList
export const ComposerListItem = ListItem
export const ComposerTaskList = TaskList
export const ComposerTaskItem = TaskItem.configure({ nested: true })

function taskItemStart(doc: ProseMirrorNode, position: number): number | undefined {
  const $pos = doc.resolve(Math.max(0, Math.min(position, doc.content.size)))

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "taskItem") return $pos.before(depth)
  }

  return undefined
}

export const ComposerTaskToggle = Extension.create({
  name: "composerTaskToggle",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("composerTaskToggle"),
        props: {
          handleDOMEvents: {
            change(view, event) {
              const input = event.target

              if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return false
              const start = taskItemStart(view.state.doc, view.posAtDOM(input, 0))

              if (start === undefined) return false
              view.dispatch(view.state.tr.setNodeAttribute(start, "checked", input.checked))
              return false
            },
          },
        },
      }),
    ]
  },
})

export function createMarkdownExtensions(): Extensions {
  return [
    ComposerHeading,
    ComposerBlockquote,
    ComposerCodeBlock,
    ComposerHorizontalRule,
    ComposerBulletList,
    ComposerOrderedList,
    ComposerListItem,
    ComposerTaskList,
    ComposerTaskItem,
    ComposerBold,
    ComposerItalic,
    ComposerStrike,
    ComposerCode,
    ComposerTaskToggle,
  ]
}
