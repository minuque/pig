import { Extension } from "@tiptap/core"
import { closeHistory, isHistoryTransaction } from "@tiptap/pm/history"
import type { Transaction } from "@tiptap/pm/state"
import { ReplaceStep } from "@tiptap/pm/transform"

export const UNDO_GROUP_DELAY = 1000

export type ChangeKind = "insert" | "delete" | "other"

const CLIPBOARD_EDIT_META = "composerClipboardEdit"
const COMPOSITION_REPLACE_META = "composerCompositionReplace"

export function markAsClipboardEdit(tr: Transaction, event: "paste" | "cut"): Transaction {
  return tr.setMeta(CLIPBOARD_EDIT_META, event)
}

export function markAsCompositionReplace(tr: Transaction): Transaction {
  return closeHistory(tr).setMeta(COMPOSITION_REPLACE_META, true)
}

function stepKind(step: ReplaceStep): ChangeKind {
  const inserts = step.slice.size > 0
  const deletes = step.to > step.from

  if (inserts && !deletes) return "insert"
  return deletes && !inserts ? "delete" : "other"
}

function changeKindOf(tr: Transaction): ChangeKind | null {
  if (!tr.docChanged) return null
  const uiEvent = tr.getMeta("uiEvent")

  if (uiEvent === "paste" || uiEvent === "drop" || uiEvent === "cut") return "other"

  if (tr.getMeta(CLIPBOARD_EDIT_META) != null) return "other"

  if (tr.getMeta("composition") != null || tr.getMeta(COMPOSITION_REPLACE_META)) return "insert"
  let kind: ChangeKind | null = null

  for (const step of tr.steps) {
    if (!(step instanceof ReplaceStep)) return "other"
    const next = stepKind(step)

    if (kind !== null && kind !== next) return "other"
    kind = next
  }

  return kind
}

export function groupUndoByChangeKind(
  tr: Transaction,
  previous: ChangeKind | null,
): ChangeKind | null {
  if (isHistoryTransaction(tr)) return "other"
  const kind = changeKindOf(tr)

  if (kind === null) return previous

  if (previous !== null && (kind !== previous || kind === "other")) closeHistory(tr)
  return kind
}

export const ComposerUndoGrouping = Extension.create<
  Record<string, never>,
  { previous: ChangeKind | null }
>({
  name: "composerUndoGrouping",
  addStorage: () => ({ previous: null }),
  dispatchTransaction({ transaction, next }) {
    this.storage.previous = groupUndoByChangeKind(transaction, this.storage.previous)
    next(transaction)
  },
})
