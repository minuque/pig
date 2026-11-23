import type { Command } from "@tiptap/core"
import type { MarkType, Node as ProseMirrorNode } from "@tiptap/pm/model"
import {
  AllSelection,
  NodeSelection,
  type Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state"
import type { Mapping } from "@tiptap/pm/transform"
import { serializeEditorDoc } from "@features/composer/lib/editor/doc-serialize.js"
import {
  inlineMarkdownUnitMarks,
  MARKDOWN_SOURCE_MARK,
  type RichTextMark,
} from "@features/composer/lib/editor/rich-text.js"

export type TextRange = { from: number; to: number }

type StyledRange = TextRange & {
  escapedOpener: boolean
  markers: { at: number; closing: boolean; text: string }[]
}

type Units = ReadonlyArray<RichTextMark[] | null>

export const STYLE_MARKS: RichTextMark[] = ["bold", "italic", "strike", "code"]
const ATOM_TEXT = "￼"
const DELIMITER = /[*_~`]/

function collectStyledRanges(doc: ProseMirrorNode): StyledRange[] {
  const ranges: StyledRange[] = []
  const map = serializeEditorDoc(doc)
  let range: StyledRange | null = null
  let openLength = 0

  for (const run of map.runs) {
    if (run.nodeName === "codeBlock") continue

    if (run.openLen > 0) {
      let backslashes = 0

      while (map.value[run.mdStart - backslashes - 1] === "\\") backslashes += 1
      range ??= {
        from: run.pmPos,
        to: run.pmPos,
        escapedOpener: backslashes % 2 !== 0,
        markers: [],
      }
      range.markers.push({
        at: run.pmPos,
        closing: false,
        text: map.value.slice(run.mdStart, run.mdStart + run.openLen),
      })
    }

    if (range === null) continue
    range.to = run.pmPos + run.docLen

    if (run.closeLen > 0) {
      const end = run.mdStart + run.mdLen

      range.markers.push({
        at: range.to,
        closing: true,
        text: map.value.slice(end - run.closeLen, end),
      })
    }

    openLength += run.openLen - run.closeLen

    if (openLength === 0) {
      ranges.push(range)
      range = null
    }
  }

  return ranges
}

export function sameUnitMarks(left: RichTextMark[] | null, right: RichTextMark[] | null): boolean {
  if (left === null || right === null) return left === right
  return left.length === right.length && left.every((mark) => right.includes(mark))
}

export function forEachUnitRun(
  units: Units,
  visit: (start: number, end: number, marks: RichTextMark[] | null) => void,
): void {
  let start = 0

  while (start < units.length) {
    let end = start + 1

    while (end < units.length && sameUnitMarks(units[end]!, units[start]!)) end += 1
    visit(start, end, units[start]!)
    start = end
  }
}

export function regionUnits(doc: ProseMirrorNode, { from, to }: TextRange) {
  const text = doc.textBetween(from, to, undefined, ATOM_TEXT)
  return { text, units: inlineMarkdownUnitMarks(text) }
}

export function withAdjacentDelimiters(doc: ProseMirrorNode, region: TextRange): TextRange {
  const before = doc.resolve(region.from).nodeBefore
  const after = doc.resolve(region.to).nodeAfter
  let { from, to } = region

  if (before?.isText && before.marks.length === 0) {
    const text = before.text!
    let count = 0

    while (count < text.length && DELIMITER.test(text[text.length - 1 - count]!)) count += 1
    let backslashes = 0

    while (text[text.length - 1 - count - backslashes] === "\\") backslashes += 1

    if (count > 0 && backslashes % 2 === 1) count -= 1
    from -= count
  }

  if (after?.isText && after.marks.length === 0) {
    const text = after.text!
    let count = 0

    while (count < text.length && DELIMITER.test(text[count]!)) count += 1
    to += count
  }

  return { from, to }
}

function revealsFaithfully(doc: ProseMirrorNode, range: StyledRange): boolean {
  if (range.escapedOpener) return false
  const adjacent = withAdjacentDelimiters(doc, range)

  if (adjacent.from !== range.from || adjacent.to !== range.to) return false

  const markers = [...range.markers].sort(
    (left, right) => left.at - right.at || Number(right.closing) - Number(left.closing),
  )
  const expected: Array<RichTextMark[] | null> = []
  let text = ""
  let next = 0
  const addMarkers = (pos: number) => {
    for (; next < markers.length && markers[next]!.at <= pos; next++) {
      text += markers[next]!.text
      expected.push(...markers[next]!.text.split("").map(() => null))
    }
  }

  doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isInline) return true
    const marks = STYLE_MARKS.filter((name) => node.marks.some((mark) => mark.type.name === name))
    const from = Math.max(pos, range.from)
    const content = node.isText ? node.text!.slice(from - pos, range.to - pos) : ATOM_TEXT

    for (let index = 0; index < content.length; index++) {
      addMarkers(from + index)
      text += content[index]
      expected.push(marks)
    }

    return false
  })
  addMarkers(range.to)
  return inlineMarkdownUnitMarks(text).every((marks, index) =>
    sameUnitMarks(marks, expected[index]!),
  )
}

export function touches(selection: Selection, { from, to }: TextRange): boolean {
  return selection.empty
    ? selection.from >= from && selection.from <= to
    : selection.from < to && selection.to > from
}

export function sourceRegions(doc: ProseMirrorNode, type: MarkType): TextRange[] {
  const regions: TextRange[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let current: TextRange | null = null

    node.forEach((child, offset) => {
      const start = pos + 1 + offset

      if (!type.isInSet(child.marks)) current = null
      else if (current) current.to = start + child.nodeSize
      else {
        current = { from: start, to: start + child.nodeSize }
        regions.push(current)
      }
    })
    return false
  })
  return regions
}

export function collapseRegion(tr: Transaction, region: TextRange, type: MarkType): void {
  const { schema } = tr.doc.type
  const { units } = regionUnits(tr.doc, region)
  const deletions: TextRange[] = []

  tr.removeMark(region.from, region.to, type)
  forEachUnitRun(units, (start, end, marks) => {
    if (marks === null) deletions.push({ from: region.from + start, to: region.from + end })

    for (const name of marks ?? []) {
      const markType = schema.marks[name]

      if (markType) tr.addMark(region.from + start, region.from + end, markType.create())
    }
  })

  for (const { from, to } of deletions.reverse()) tr.delete(from, to)
}

export function collapseMarkdownSource(
  tr: Transaction,
  keep: (region: TextRange) => boolean = () => false,
): TextRange[] {
  const type = tr.doc.type.schema.marks[MARKDOWN_SOURCE_MARK]

  if (!type) return []
  const regions: TextRange[] = []

  for (const region of sourceRegions(tr.doc, type)) {
    const extended = withAdjacentDelimiters(tr.doc, region)
    const previous = regions.at(-1)

    if (previous && extended.from <= previous.to) previous.to = Math.max(previous.to, extended.to)
    else regions.push(extended)
  }

  for (const region of [...regions].reverse()) {
    if (keep(region)) tr.addMark(region.from, region.to, type.create())
    else collapseRegion(tr, region, type)
  }

  return regions
}

export const collapseShownMarkdownSource: Command = ({ tr }) => {
  const { selection } = tr
  const type = tr.doc.type.schema.marks[MARKDOWN_SOURCE_MARK]
  const marks = tr.storedMarks ?? selection.$from.marks()
  const regions = collapseMarkdownSource(tr)

  if (type && selection.empty && regions.some(({ to }) => to === selection.from)) {
    tr.setStoredMarks(type.removeFromSet(marks))
  }

  return true
}

function mapSelection(tr: Transaction, selection: Selection, map: (pos: number) => number) {
  if (selection instanceof AllSelection) return new AllSelection(tr.doc)

  if (selection instanceof NodeSelection) {
    const pos = map(selection.from)

    if (tr.doc.nodeAt(pos)) return NodeSelection.create(tr.doc, pos)
  }

  return TextSelection.create(tr.doc, map(selection.anchor), map(selection.head))
}

export function mapRange(mapping: Mapping, { from, to }: TextRange): TextRange {
  return { from: mapping.map(from, 1), to: mapping.map(to, -1) }
}

export function revealStyledText(
  tr: Transaction,
  type: MarkType,
  typed: boolean,
  takesBefore: boolean,
): TextRange[] {
  const { schema } = tr.doc.type
  const { selection } = tr
  const ranges = collectStyledRanges(tr.doc).filter(
    (range) => touches(selection, range) && revealsFaithfully(tr.doc, range),
  )
  const revealed: { range: TextRange; step: number }[] = []
  const insertions: { at: number; length: number; closing: boolean }[] = []

  for (const range of [...ranges].reverse()) {
    for (const name of STYLE_MARKS) {
      const markType = schema.marks[name]

      if (markType) tr.removeMark(range.from, range.to, markType)
    }

    let length = 0
    const markers = [...range.markers].sort(
      (left, right) => right.at - left.at || Number(left.closing) - Number(right.closing),
    )

    for (const { at, closing, text } of markers) {
      tr.insert(at, schema.text(text, [type.create()]))
      insertions.push({ at, length: text.length, closing })
      length += text.length
    }

    tr.addMark(range.from, range.to + length, type.create())
    revealed.push({ range: { from: range.from, to: range.to + length }, step: tr.steps.length })
  }

  if (ranges.length === 0) return []

  const map = (pos: number) => {
    let next = pos

    for (const { at, length, closing } of insertions) {
      const inside = typed && selection.empty && (closing ? takesBefore : !takesBefore)
      const shifts = at === pos && (selection instanceof NodeSelection || closing !== inside)

      if (at < pos || shifts) next += length
    }

    return next
  }

  tr.setSelection(mapSelection(tr, selection, map))
  return revealed.map(({ range, step }) => mapRange(tr.mapping.slice(step), range))
}
