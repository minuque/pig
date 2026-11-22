import { Extension, InputRule, markInputRule, markPasteRule, type Extensions } from "@tiptap/core"
import { Blockquote } from "@tiptap/extension-blockquote"
import { Bold } from "@tiptap/extension-bold"
import { Code } from "@tiptap/extension-code"
import { CodeBlock } from "@tiptap/extension-code-block"
import { Heading } from "@tiptap/extension-heading"
import { HorizontalRule } from "@tiptap/extension-horizontal-rule"
import { Italic } from "@tiptap/extension-italic"
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list"
import { Strike } from "@tiptap/extension-strike"
import { TaskItem } from "@tiptap/extension-task-item"
import { TaskList } from "@tiptap/extension-task-list"
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state"

export const CLOSING_FENCE = "```"
const EMPHASIS = String.raw`([^\s*](?:[^*]*[^\s*])?)`
const BOLD_INPUT = new RegExp(String.raw`(?:^|\s)(\*\*${EMPHASIS}\*\*)$`)
const BOLD_PASTE = new RegExp(String.raw`(?:^|\s)(\*\*${EMPHASIS}\*\*)`, "g")
const ITALIC_INPUT = new RegExp(String.raw`(?:^|\s)(\*${EMPHASIS}\*)$`)
const ITALIC_PASTE = new RegExp(String.raw`(?:^|\s)(\*${EMPHASIS}\*)`, "g")

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
    return [markInputRule({ find: BOLD_INPUT, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: BOLD_PASTE, type: this.type })]
  },
})
export const ComposerItalic = Italic.extend({
  addInputRules() {
    return [markInputRule({ find: ITALIC_INPUT, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: ITALIC_PASTE, type: this.type })]
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
const TASK_CONTENT_START = 3

function convertBulletItemToTask(tr: Transaction, from: number, to: number, checked: boolean) {
  tr.delete(from, to)
  const $pos = tr.doc.resolve(from)
  const item = $pos.node(-1)
  const list = $pos.node(-2)
  const index = $pos.index(-2)
  const { nodes } = tr.doc.type.schema
  const task = nodes["taskItem"]!.create({ checked }, item.content)
  const taskList = nodes["taskList"]!.create(null, task)
  const before: ProseMirrorNode[] = []
  const after: ProseMirrorNode[] = []

  list.forEach((child, _, childIndex) => {
    if (childIndex < index) before.push(child)
    else if (childIndex > index) after.push(child)
  })

  const head = before.length ? list.copy(Fragment.from(before)) : null
  const lists = [
    ...(head ? [head] : []),
    taskList,
    ...(after.length ? [list.copy(Fragment.from(after))] : []),
  ]
  const start = $pos.before(-2)

  tr.replaceWith(start, start + list.nodeSize, lists)
  tr.setSelection(TextSelection.create(tr.doc, start + (head?.nodeSize ?? 0) + TASK_CONTENT_START))
}

export const ComposerTaskInput = Extension.create({
  name: "composerTaskInput",
  addInputRules() {
    return [
      new InputRule({
        find: /^\[([ xX])\] $/u,
        handler: ({ state, range, match, chain }) => {
          const $from = state.doc.resolve(range.from)

          if ($from.parent.type.name !== "paragraph") return

          if ($from.node(-1).type.name !== "listItem") return

          if ($from.node(-2).type.name !== "bulletList") return

          const checked = (match[1] ?? " ").toLowerCase() === "x"

          chain()
            .command(({ tr }) => {
              convertBulletItemToTask(tr, range.from, range.to, checked)
              return true
            })
            .run()
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
    ComposerTaskInput,
  ]
}
