import { Mark, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import {
  serializeEditorDoc,
  type RichDocMap,
  type RichRun,
} from "@features/composer/lib/editor/doc-serialize.js"
import { MARKDOWN_SOURCE_MARK } from "@features/composer/lib/editor/rich-text.js"

function runOwnsOffset(run: Readonly<RichRun>, flatOffset: number): boolean {
  const end = run.flatStart + run.docLen
  return flatOffset < end || (flatOffset === end && run.nodeName === "codeBlock")
}

export function flatToMarkdown(map: RichDocMap, flatOffset: number): number {
  const bounded = Math.max(0, Math.min(flatOffset, map.docLength))

  for (const run of map.runs) {
    if (!runOwnsOffset(run, bounded)) continue

    if (run.kind === "text" || run.kind === "token") {
      return run.mdStart + run.openLen + (bounded - run.flatStart)
    }

    return run.mdStart + (bounded - run.flatStart)
  }

  const last = map.runs.at(-1)
  return last ? last.mdStart + last.mdLen : 0
}

export function markdownToFlat(map: RichDocMap, markdownOffset: number): number {
  for (const run of map.runs) {
    if (markdownOffset >= run.mdStart + run.mdLen) continue

    if (run.kind === "prefix") return run.flatStart

    if (run.kind === "break") return run.flatStart + (markdownOffset - run.mdStart)
    const within = markdownOffset - run.mdStart

    if (within <= run.openLen) return run.flatStart

    if (run.kind === "token" || within >= run.openLen + run.docLen) {
      return run.flatStart + run.docLen
    }

    return run.flatStart + (within - run.openLen)
  }

  return map.docLength
}

export function flatToPm(map: RichDocMap, flatOffset: number): number {
  const bounded = Math.max(0, Math.min(flatOffset, map.docLength))

  for (const run of map.runs) {
    if (bounded < run.flatStart + run.docLen) return run.pmPos + (bounded - run.flatStart)
  }

  const last = map.runs.at(-1)
  return last ? last.pmPos + last.docLen : 1
}

export function pmToFlat(map: RichDocMap, pmPos: number): number {
  for (const run of map.runs) {
    if (pmPos < run.pmPos || pmPos > run.pmPos + run.docLen) continue
    return run.flatStart + Math.min(pmPos - run.pmPos, run.docLen)
  }

  let best = 0

  for (const run of map.runs) {
    if (run.pmPos <= pmPos) best = run.flatStart + run.docLen
  }

  return Math.max(0, Math.min(best, map.docLength))
}

export function serializedMarkdownOffset(
  value: string,
  serialized: string,
  offset: number,
): number {
  if (value === serialized) return offset
  let index = 0
  let mapped = 0
  let target = -1

  while (index < value.length && mapped < serialized.length) {
    if (index === offset && target < 0) target = mapped

    if (value[index] === serialized[mapped] || serialized[mapped] !== "\n") index += 1
    mapped += 1
  }

  if (index !== value.length || mapped !== serialized.length) return offset
  return target < 0 ? mapped + (offset - index) : target
}

export function markdownOffsetAt(doc: ProseMirrorNode, pmPos: number): number {
  const map = serializeEditorDoc(doc)
  return flatToMarkdown(map, pmToFlat(map, pmPos))
}

export function positionAtMarkdown(doc: ProseMirrorNode, offset: number): number {
  const map = serializeEditorDoc(doc)
  return flatToPm(map, markdownToFlat(map, offset))
}

function styleMarks(marks: readonly Mark[]): readonly Mark[] {
  return marks.filter((mark) => mark.type.name !== MARKDOWN_SOURCE_MARK)
}

function styledEdge(state: EditorState) {
  const { selection } = state

  if (!selection.empty) return null
  const { $from } = selection

  if (!$from.parent.inlineContent) return null
  const before = styleMarks($from.nodeBefore?.marks ?? Mark.none)
  const after = styleMarks($from.nodeAfter?.marks ?? Mark.none)

  if (Mark.sameSet(before, after)) return null
  return { before, after, current: styleMarks(state.storedMarks ?? $from.marks()) }
}

export function caretTakesMarksBefore(state: EditorState): boolean {
  const edge = styledEdge(state)
  return edge !== null && Mark.sameSet(edge.current, edge.before)
}

export function stepCaretAcrossStyledEdge(
  state: EditorState,
  direction: -1 | 1,
): Transaction | null {
  const edge = styledEdge(state)

  if (!edge) return null

  if (!Mark.sameSet(edge.current, edge.before) && !Mark.sameSet(edge.current, edge.after)) {
    return null
  }

  const target = direction === -1 ? edge.before : edge.after

  if (Mark.sameSet(edge.current, target)) return null
  return state.tr.setStoredMarks(target)
}
