import {
  type Command,
  type Editor,
  InputRule,
  mergeAttributes,
  wrappingInputRule,
} from "@tiptap/core"
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list"
import { TaskItem } from "@tiptap/extension-task-item"
import { TaskList } from "@tiptap/extension-task-list"
import { joinTextblockBackward, joinTextblockForward } from "@tiptap/pm/commands"
import {
  Fragment,
  type Node as ProseMirrorNode,
  type NodeType,
  type ResolvedPos,
} from "@tiptap/pm/model"
import { Selection, TextSelection, type Transaction } from "@tiptap/pm/state"
import { sourceAttr, withoutBlockChords } from "@features/composer/lib/editor/blocks.js"
import { LIST_NODE_NAMES } from "@features/composer/lib/editor/doc-serialize.js"
import { nextOrderedMarkerText } from "@features/composer/lib/editor/list-indent.js"
import { listNormalizationPlugin } from "@features/composer/lib/editor/list-normalize.js"

const LIST_ITEM_CONTENT = "paragraph list*"
const LIST_NESTING_KEYS = ["Tab", "Shift-Tab"]
const ORDERED_MARKER = /^\d+[.)]$/

function renumberFollowingItems(tr: Transaction, listPos: number, index: number, marker: string) {
  const list = tr.doc.nodeAt(listPos)

  if (!list) return
  let pos = listPos + 1
  let previous = marker

  list.forEach((child, _, childIndex) => {
    if (childIndex > index) {
      previous = nextOrderedMarkerText(previous)

      if (child.attrs["marker"] !== previous) {
        tr.setNodeMarkup(pos, undefined, { ...child.attrs, marker: previous })
      }
    }

    pos += child.nodeSize
  })
}

function alignListItemWithSiblings(tr: Transaction, itemType: string): void {
  const $pos = tr.selection.$from

  if ($pos.depth < 3 || $pos.node(-1).type.name !== itemType) return
  const item = $pos.node(-1)
  const list = $pos.node(-2)
  const index = $pos.index(-2)
  const sibling =
    index > 0 ? list.child(index - 1) : index + 1 < list.childCount ? list.child(index + 1) : null

  if (!sibling) return
  const attrs: Record<string, unknown> = { ...item.attrs, indent: sibling.attrs["indent"] }

  if (item.type.name === "taskItem") attrs["markerSpace"] = sibling.attrs["markerSpace"]
  else {
    const marker = typeof sibling.attrs["marker"] === "string" ? sibling.attrs["marker"] : "-"

    attrs["marker"] =
      index > 0 && ORDERED_MARKER.test(marker) ? nextOrderedMarkerText(marker) : marker
  }

  tr.setNodeMarkup($pos.before(-1), undefined, attrs)

  if (typeof attrs["marker"] === "string" && ORDERED_MARKER.test(attrs["marker"])) {
    renumberFollowingItems(tr, $pos.before(-2), index, attrs["marker"])
  }
}

export function listItemTypeAt($pos: ResolvedPos): "listItem" | "taskItem" | null {
  const name = $pos.depth > 1 ? $pos.node(-1).type.name : null
  return name === "listItem" || name === "taskItem" ? name : null
}

export function splitOrLiftListItem(editor: Editor, prepare: Command): boolean {
  const { $from } = editor.state.selection
  const itemType = listItemTypeAt($from)

  if (!itemType) return false
  const empty = $from.parent.content.size === 0
  const move: Command = ({ commands, tr }) => {
    const attrs = itemType === "taskItem" ? { checked: false } : { space: " " }
    const moved =
      commands.splitListItem(itemType, attrs) || (empty && commands.liftListItem(itemType))

    if (moved) alignListItemWithSiblings(tr, itemType)
    return moved
  }

  return editor.can().command(move) && editor.chain().command(prepare).command(move).run()
}

export function convertBulletItemToTask(
  tr: Transaction,
  from: number,
  to: number,
  checked: boolean,
): void {
  tr.delete(from, to)
  const $pos = tr.doc.resolve(from)
  const item = $pos.node(-1)
  const list = $pos.node(-2)
  const index = $pos.index(-2)
  const { schema } = tr.doc.type
  const before: ProseMirrorNode[] = []
  const after: ProseMirrorNode[] = []

  list.forEach((child, _, childIndex) => {
    if (childIndex < index) before.push(child)
    else if (childIndex > index) after.push(child)
  })
  const space = item.attrs["space"]
  const markerSpace = typeof space === "string" && space ? space : " "
  const task = schema.nodes["taskItem"]!.create(
    { checked, indent: item.attrs["indent"], markerSpace },
    item.content,
  )
  const lists = [
    ...(before.length > 0 ? [list.copy(Fragment.from(before))] : []),
    schema.nodes["taskList"]!.create(null, task),
    ...(after.length > 0 ? [list.copy(Fragment.from(after))] : []),
  ]
  const listStart = $pos.before(-2)

  tr.replaceWith(listStart, listStart + list.nodeSize, lists)
  const caret = listStart + (before.length > 0 ? lists[0]!.nodeSize : 0) + 3

  tr.setSelection(TextSelection.create(tr.doc, caret))
}

function backspaceAcrossList(editor: Editor): boolean {
  const { state } = editor
  const { $from, empty } = state.selection

  if (!empty || $from.parentOffset !== 0) return false
  const itemType = listItemTypeAt($from)

  if (itemType && $from.index(-1) === 0) {
    const lift: Command = ({ commands, tr }) => {
      const moved = commands.liftListItem(itemType)

      if (moved) alignListItemWithSiblings(tr, itemType)
      return moved
    }

    return editor.chain().command(lift).run() || joinTextblockBackward(state, editor.view.dispatch)
  }

  const before = $from.depth === 1 ? $from.node(0).maybeChild($from.index(0) - 1) : null

  if (before && LIST_NODE_NAMES.has(before.type.name) && $from.parent.type.name !== "codeBlock") {
    return joinTextblockBackward(state, editor.view.dispatch)
  }

  return false
}

function deleteAcrossList(editor: Editor): boolean {
  const { state } = editor
  const { $from, empty } = state.selection

  if (!empty || !$from.parent.isTextblock || $from.depth === 0) return false

  if ($from.parentOffset !== $from.parent.content.size) return false
  const next = Selection.findFrom(state.doc.resolve($from.after()), 1, true)

  if (!next) return false

  if (next.$from.parent.type.name === "codeBlock") return $from.parent.type.name !== "codeBlock"

  if (!listItemTypeAt($from) && !listItemTypeAt(next.$from)) return false
  return joinTextblockForward(state, editor.view.dispatch)
}

function listMarkerInputRule(find: RegExp, listType: "bulletList" | "orderedList"): InputRule {
  return new InputRule({
    find,
    handler: ({ state, range, match, chain }) => {
      const marker = match.groups?.["marker"] ?? "-"
      const space = match.groups?.["space"] ?? " "
      const carried = match.groups?.["carried"] ?? ""
      const $from = state.doc.resolve(range.from)

      if ($from.parent.type.name !== "paragraph" || $from.depth !== 1) return null
      const start = listType === "orderedList" ? { start: Number.parseInt(marker, 10) || 1 } : {}
      const command = chain()
        .deleteRange(range)
        .wrapInList(listType, start)
        .updateAttributes("listItem", { marker, space })

      if (carried) command.insertContent(carried)
      command.run()
      return undefined
    },
  })
}

const bulletToTaskInputRule = new InputRule({
  find: /^\[([ xX])\] $/,
  handler: ({ state, range, match, chain }) => {
    const $from = state.doc.resolve(range.from)
    const item = $from.node(-1)

    if ($from.parent.type.name !== "paragraph" || item?.type.name !== "listItem") return null

    if (!["-", "*", "+"].includes(String(item.attrs["marker"] ?? ""))) return null
    const checked = (match[1] ?? " ").toLowerCase() === "x"

    chain()
      .command(({ tr }) => {
        convertBulletItemToTask(tr, range.from, range.to, checked)
        return true
      })
      .run()
    return undefined
  },
})

function taskInputRule(type: NodeType): InputRule {
  const rule = wrappingInputRule({
    find: /^- \[([ xX])\] $/,
    type,
    getAttributes: (match) => ({ checked: match[1]?.toLowerCase() === "x" }),
  })
  return new InputRule({
    find: rule.find,
    handler: (props) =>
      props.state.doc.resolve(props.range.from).depth === 1 ? rule.handler(props) : null,
  })
}

const ComposerListItem = ListItem.extend({
  content: LIST_ITEM_CONTENT,
  addAttributes() {
    return {
      ...this.parent?.(),
      indent: sourceAttr(""),
      marker: sourceAttr("-"),
      space: sourceAttr(" "),
    }
  },
  addKeyboardShortcuts() {
    return {
      ...withoutBlockChords(this.parent?.(), LIST_NESTING_KEYS),
      Backspace: () => this.editor.commands.undoInputRule() || backspaceAcrossList(this.editor),
      Delete: () => deleteAcrossList(this.editor),
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const marker = String(node.attrs["marker"])
    return ["li", mergeAttributes(HTMLAttributes, { "data-marker": marker }), 0]
  },
})
const ComposerBulletList = BulletList.extend({
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), listNormalizationPlugin(() => this.editor.view.composing)]
  },
  addKeyboardShortcuts() {
    return withoutBlockChords(this.parent?.(), ["Mod-Shift-8"])
  },
  addInputRules() {
    return [
      listMarkerInputRule(/^(?<marker>[*+])(?<space>\s)$/, "bulletList"),
      listMarkerInputRule(/^(?<marker>-)(?<space>[ \t]+)(?<carried>[^\s[])$/, "bulletList"),
    ]
  },
})
const ComposerOrderedList = OrderedList.extend({
  addKeyboardShortcuts() {
    return withoutBlockChords(this.parent?.(), ["Mod-Shift-7"])
  },
  addInputRules() {
    return [listMarkerInputRule(/^(?<marker>\d+[.)])(?<space>\s)$/, "orderedList")]
  },
})
const ComposerTaskList = TaskList.extend({
  addKeyboardShortcuts() {
    return withoutBlockChords(this.parent?.(), ["Mod-Shift-9"])
  },
})
const ComposerTaskItem = TaskItem.extend({
  content: LIST_ITEM_CONTENT,
  addAttributes() {
    return {
      ...this.parent?.(),
      indent: sourceAttr(""),
      markerSpace: sourceAttr(" "),
      contentSpace: { default: null, rendered: false },
    }
  },
  addKeyboardShortcuts() {
    return withoutBlockChords(this.parent?.(), LIST_NESTING_KEYS)
  },
  addInputRules() {
    return [taskInputRule(this.type), bulletToTaskInputRule]
  },
}).configure({ nested: true })
export const ComposerListExtensions = [
  ComposerBulletList,
  ComposerOrderedList,
  ComposerListItem,
  ComposerTaskList,
  ComposerTaskItem,
]
