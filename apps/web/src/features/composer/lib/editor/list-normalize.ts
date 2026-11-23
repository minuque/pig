import { combineTransactionSteps, getChangedRanges } from "@tiptap/core"
import { isHistoryTransaction } from "@tiptap/pm/history"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state"
import { canJoin, findWrapping } from "@tiptap/pm/transform"
import { parseListPrefix, type ListLinePrefix } from "@features/composer/lib/editor/doc-parse.js"

export function paragraphText(node: ProseMirrorNode): string {
  return node.textBetween(0, node.content.size, undefined, "￼")
}

function joinCompatibleLists(tr: Transaction, pos: number): void {
  const $pos = tr.doc.resolve(pos)
  const before = $pos.nodeBefore
  const after = $pos.nodeAfter
  const delimiter = (list: ProseMirrorNode) =>
    String(list.firstChild?.attrs["marker"] ?? "").slice(-1)

  if (
    before &&
    after &&
    before.type === after.type &&
    delimiter(before) === delimiter(after) &&
    canJoin(tr.doc, pos)
  ) {
    tr.join(pos)
  }
}

function keepsGesture(prefix: ListLinePrefix, content: string): boolean {
  if (prefix.kind === "task") return !prefix.contentSpace
  return (
    prefix.kind === "bullet" &&
    prefix.marker === "-" &&
    (!content || /^\[(?:[ xX]\]?)?$/.test(content))
  )
}

function itemAttrs(prefix: ListLinePrefix): Record<string, unknown> {
  if (prefix.kind === "task") {
    const { checked, indent, markerSpace, contentSpace } = prefix
    return { checked, indent, markerSpace, contentSpace }
  }

  return { indent: prefix.indent, marker: prefix.marker, space: prefix.space }
}

function listTypeName(prefix: ListLinePrefix): string {
  if (prefix.kind === "task") return "taskList"
  return prefix.kind === "ordered" ? "orderedList" : "bulletList"
}

function normalizeAt(state: EditorState, tr: Transaction, pos: number): "keep" | "done" {
  if (state.doc.resolve(pos).depth !== 0) return "done"
  const node = state.doc.nodeAt(pos)

  if (node?.type.name !== "paragraph") return "done"
  const text = paragraphText(node)
  const parsed = parseListPrefix(text)

  if (!parsed || parsed.prefix.indent) return "done"
  const { prefix, markerLength } = parsed
  const marks = Object.values(state.schema.marks)

  if (marks.some((mark) => node.rangeHasMark(0, markerLength, mark))) return "done"
  const active = state.selection.$from.depth === 1 && state.selection.$from.before(1) === pos

  if (active && keepsGesture(prefix, text.slice(markerLength))) return "keep"

  if (prefix.kind !== "task" && !prefix.space) return "done"
  const listType = state.schema.nodes[listTypeName(prefix)]

  if (!listType) return "done"
  const attrs = prefix.kind === "ordered" ? { start: Number.parseInt(prefix.marker, 10) || 1 } : {}
  const range = tr.doc.resolve(pos + 1).blockRange()
  const wrapping = range && findWrapping(range, listType, attrs)

  if (!range || !wrapping) return "done"
  tr.wrap(range, wrapping)
  tr.setNodeMarkup(pos + 1, undefined, itemAttrs(prefix))
  tr.delete(pos + 3, pos + 3 + markerLength)
  joinCompatibleLists(tr, pos + tr.doc.nodeAt(pos)!.nodeSize)
  joinCompatibleLists(tr, pos)
  return "done"
}

function collectPending(
  pending: Set<number>,
  oldState: EditorState,
  state: EditorState,
  transactions: readonly Transaction[],
): Set<number> {
  const changes = combineTransactionSteps(oldState.doc, [...transactions])
  const next = new Set(
    [...pending].flatMap((pos) => {
      const mapped = changes.mapping.mapResult(pos, 1)
      return mapped.deleted ? [] : [mapped.pos]
    }),
  )

  for (const { newRange } of getChangedRanges(changes)) {
    state.doc.nodesBetween(newRange.from, newRange.to, (node, pos) => {
      if (node.type.name !== "paragraph") return false
      const parsed = parseListPrefix(paragraphText(node))

      if (parsed && newRange.from <= pos + 1 + parsed.markerLength) next.add(pos)
      return false
    })
  }

  return next
}

export function listNormalizationPlugin(isComposing: () => boolean): Plugin {
  let pending = new Set<number>()
  return new Plugin({
    key: new PluginKey("composerListNormalization"),
    props: {
      handleDOMEvents: {
        compositionend(view) {
          setTimeout(() => {
            if (!view.isDestroyed && !view.composing && pending.size > 0) {
              view.dispatch(view.state.tr)
            }
          })
          return false
        },
      },
    },
    appendTransaction(transactions, oldState, state) {
      const undoesInputRule = oldState.plugins.some(
        (plugin) => plugin.spec.isInputRules && plugin.getState(oldState),
      )

      if (undoesInputRule || transactions.some(isHistoryTransaction)) {
        pending.clear()
        return null
      }

      if (pending.size === 0 && !transactions.some((tr) => tr.docChanged)) return null
      pending = collectPending(pending, oldState, state, transactions)

      if (isComposing() || transactions.some((tr) => tr.getMeta("composition") != null)) {
        return null
      }

      const tr = state.tr
      const kept: number[] = []

      for (const pos of [...pending].sort((a, b) => b - a)) {
        if (normalizeAt(state, tr, pos) === "keep") kept.push(pos)
      }

      pending = new Set(kept.map((pos) => tr.mapping.map(pos, 1)))
      return tr.docChanged ? tr : null
    },
  })
}
