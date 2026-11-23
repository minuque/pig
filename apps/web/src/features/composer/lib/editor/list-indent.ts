import { splitPromptSegments } from "@features/composer/lib/editor/chip-tokens.js"

export interface ListEdit {
  start: number
  end: number
  replacement: string
  cursorAfter: number
}

type ListMarker =
  | { kind: "ordered"; indent: string; numberText: string; delimiter: "." | ")"; space: string }
  | { kind: "task"; indent: string; space: string }
  | { kind: "bullet"; indent: string; bullet: string; space: string }

interface ParsedMarker {
  marker: ListMarker
  contentColumn: number
}

type TokenRange = { start: number; end: number }

function indentWidth(line: string, fromColumn = 0): number {
  let column = fromColumn

  for (const char of line) {
    if (char === " ") column += 1
    else if (char === "\t") column += 4 - (column % 4)
    else break
  }

  return column - fromColumn
}

function contentColumn(indent: string, markerWidth: number, padding: string): number {
  const markerEnd = indentWidth(indent) + markerWidth
  const space = indentWidth(padding, markerEnd)
  return markerEnd + (space >= 1 && space <= 4 ? space : 1)
}

function parseMarker(line: string): ParsedMarker | null {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? ""
  const rest = line.slice(indent.length)
  const ordered = /^(\d+)([.)])((?:[ \t]+)|\s*$)/.exec(rest)

  if (ordered?.[1] !== undefined && ordered[2] !== undefined) {
    const space = ordered[3] ?? ""
    const delimiter = ordered[2] === ")" ? ")" : "."
    return {
      marker: { kind: "ordered", indent, numberText: ordered[1], delimiter, space },
      contentColumn: contentColumn(indent, ordered[1].length + 1, space),
    }
  }

  const task = /^-(\s)\[[ xX]\]((?:[ \t]+)|\s*$)/.exec(rest)

  if (task?.[1] !== undefined) {
    return {
      marker: { kind: "task", indent, space: task[2] ?? "" },
      contentColumn: contentColumn(indent, 1, task[1]),
    }
  }

  const bullet = /^([-*+])((?:[ \t]+)|\s*$)/.exec(rest)

  if (bullet?.[1] === undefined) return null
  const space = bullet[2] ?? ""
  return {
    marker: { kind: "bullet", indent, bullet: bullet[1], space },
    contentColumn: contentColumn(indent, 1, space),
  }
}

export function nextOrderedMarkerText(marker: string): string {
  const numberText = marker.slice(0, -1)
  const delimiter = marker.slice(-1)
  const number = Number.parseInt(numberText, 10)
  const next = Number.isSafeInteger(number)
    ? String(number + 1).padStart(numberText.length, "0")
    : numberText
  return `${next}${delimiter}`
}

function inlineTokenRanges(value: string): TokenRange[] {
  const ranges: TokenRange[] = []
  let offset = 0

  for (const segment of splitPromptSegments(value)) {
    const end = offset + (segment.type === "text" ? segment.text : segment.source).length

    if (segment.type !== "text") ranges.push({ start: offset, end })
    offset = end
  }

  return ranges
}

function insideToken(tokens: readonly TokenRange[], cursor: number): boolean {
  return tokens.some((range) => cursor > range.start && cursor < range.end)
}

function currentLine(value: string, cursor: number) {
  const start = value.lastIndexOf("\n", cursor - 1) + 1
  const endIndex = value.indexOf("\n", cursor)
  const end = endIndex === -1 ? value.length : endIndex
  return { start, end, text: value.slice(start, end) }
}

function* markersAbove(value: string, lineStart: number): Generator<ParsedMarker> {
  while (lineStart > 0) {
    const lineEnd = lineStart - 1

    lineStart = value.lastIndexOf("\n", lineEnd - 1) + 1
    const parsed = parseMarker(value.slice(lineStart, lineEnd))

    if (!parsed) return
    yield parsed
  }
}

function parentMarker(value: string, lineStart: number, marker: ListMarker): ListMarker | null {
  const width = indentWidth(marker.indent)

  for (const above of markersAbove(value, lineStart)) {
    if (indentWidth(above.marker.indent) < width) return above.marker
  }

  return null
}

function renumberFollowing(
  value: string,
  afterLineEnd: number,
  marker: Extract<ListMarker, { kind: "ordered" }>,
): { end: number; text: string } | null {
  const baseWidth = indentWidth(marker.indent)
  const parts: string[] = []
  let expected = Number.parseInt(marker.numberText, 10) + 2
  let position = afterLineEnd
  let copiedUntil = afterLineEnd

  while (position < value.length && Number.isSafeInteger(expected)) {
    const lineStart = position + 1
    const nextBreak = value.indexOf("\n", lineStart)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak

    position = lineEnd
    const line = value.slice(lineStart, lineEnd)
    const width = indentWidth(line)

    if (line.trim() === "" || width < baseWidth) break

    if (width > baseWidth) continue
    const current = parseMarker(line)?.marker

    if (current?.kind !== "ordered" || current.delimiter !== marker.delimiter) break
    const numberStart = lineStart + current.indent.length
    const replacement = current.numberText.startsWith("0")
      ? String(expected).padStart(current.numberText.length, "0")
      : String(expected)

    if (replacement !== current.numberText) {
      parts.push(value.slice(copiedUntil, numberStart), replacement)
      copiedUntil = numberStart + current.numberText.length
    }

    expected += 1
  }

  return parts.length === 0 ? null : { end: copiedUntil, text: parts.join("") }
}

function nestedNumber(marker: ListMarker, previous: ListMarker | undefined) {
  if (marker.kind !== "ordered") return { replacedLength: 0, text: "" }
  const continues = previous?.kind === "ordered" && previous.delimiter === marker.delimiter
  return {
    replacedLength: marker.numberText.length,
    text: continues
      ? nextOrderedMarkerText(`${previous.numberText}${marker.delimiter}`).slice(0, -1)
      : "1",
  }
}

function caretAfter(
  start: number,
  replacedEnd: number,
  lineStart: number,
  indent: string,
  replacement: string,
) {
  return start < replacedEnd
    ? lineStart + indent.length
    : start - replacedEnd + lineStart + replacement.length
}

function readLine(value: string, start: number, end: number) {
  if (!Number.isInteger(start) || start !== end || start < 0 || start > value.length) return null
  const line = currentLine(value, start)
  const parsed = parseMarker(line.text)

  if (!parsed || insideToken(inlineTokenRanges(value), start)) return null
  return { line, marker: parsed.marker }
}

export function listIndentForTab(value: string, start: number, end: number): ListEdit | null {
  const read = readLine(value, start, end)

  if (!read) return null
  const { line, marker } = read
  const width = indentWidth(marker.indent)
  let previousChild: ListMarker | undefined

  for (const above of markersAbove(value, line.start)) {
    const aboveWidth = indentWidth(above.marker.indent)

    if (aboveWidth < width) break

    if (aboveWidth > width) {
      if (!previousChild || aboveWidth < indentWidth(previousChild.indent)) {
        previousChild = above.marker
      }

      continue
    }

    const indent =
      previousChild?.indent ?? above.marker.indent + " ".repeat(above.contentColumn - aboveWidth)
    const number = nestedNumber(marker, previousChild)
    const replacedEnd = line.start + marker.indent.length + number.replacedLength
    const replacement = indent + number.text
    return {
      start: line.start,
      end: replacedEnd,
      replacement,
      cursorAfter: caretAfter(start, replacedEnd, line.start, indent, replacement),
    }
  }

  return { start: line.start, end: line.start, replacement: "  ", cursorAfter: start + 2 }
}

export function listOutdentForTab(value: string, start: number, end: number): ListEdit | null {
  const read = readLine(value, start, end)

  if (!read?.marker.indent) return null
  const { line, marker } = read
  const parent = parentMarker(value, line.start, marker)
  const indent = parent?.indent ?? marker.indent.replace(/^(?:\t| {1,2})/, "")
  const ordered =
    parent?.kind === "ordered" && marker.kind === "ordered" && parent.delimiter === marker.delimiter
      ? parent
      : null
  const number = ordered ? nestedNumber(marker, ordered) : { replacedLength: 0, text: "" }
  const replacedEnd = line.start + marker.indent.length + number.replacedLength
  const replacement = indent + number.text
  const cursorAfter = caretAfter(start, replacedEnd, line.start, indent, replacement)
  const renumbered = ordered ? renumberFollowing(value, line.end, ordered) : null

  if (renumbered) {
    return {
      start: line.start,
      end: renumbered.end,
      replacement: replacement + value.slice(replacedEnd, line.end) + renumbered.text,
      cursorAfter,
    }
  }

  return { start: line.start, end: replacedEnd, replacement, cursorAfter }
}
