export type RichTextMark = "bold" | "italic" | "strike" | "code"

export interface RichTextSpan {
  text: string
  marks: RichTextMark[]
}

interface SourcePiece {
  start: number
  end: number
  marks: RichTextMark[]
}

interface Frame {
  delimiter: string
  mark: RichTextMark
  start: number
  pieces: SourcePiece[]
}

export const MARKDOWN_SOURCE_MARK = "markdownSource"
export const MARK_NESTING_ORDER: readonly RichTextMark[] = ["strike", "bold", "italic", "code"]
export const RICH_TEXT_DELIMITERS: Record<RichTextMark, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
}
const PATH_TOKEN = /(?:[\p{L}\p{N}_/.:@%+=&?#-]|(?<!~)~(?!~))+/gu
const FILE_EXTENSION = /^\.[a-z][a-z0-9]*(?::\d+){0,2}$/i
const EMPHASIS_ALTERNATIVES = /^_[^/]+_(?:\/_[^/]+_)+$/
const WORD_BEFORE = /[\p{L}\p{M}\p{N}_]$/u
const WORD_AFTER = /^[\p{L}\p{M}\p{N}_]/u

export function sameMarks(left: readonly RichTextMark[], right: readonly RichTextMark[]): boolean {
  return left.length === right.length && left.every((mark, index) => mark === right[index])
}

function pathUnderscores(token: string, offset: number, literal: Set<number>): void {
  let bodyEnd = token.length

  while (bodyEnd > 0 && ".:?".includes(token[bodyEnd - 1]!)) bodyEnd -= 1

  if (EMPHASIS_ALTERNATIVES.test(token.slice(0, bodyEnd))) return

  while (bodyEnd > 0 && token[bodyEnd - 1] === "_") bodyEnd -= 1
  const body = token.slice(0, bodyEnd)
  const isPath = body.includes("/")
    ? /^~?\/|[.:]/.test(body)
    : FILE_EXTENSION.test(body.slice(body.lastIndexOf(".")))

  if (!isPath) return
  let closesInside = false
  let start = body.indexOf("_")

  while (start !== -1) {
    let end = start

    while (body[end] === "_") end += 1

    if (start > 0) {
      literal.add(offset + start)
      closesInside ||= !WORD_AFTER.test(body.slice(end, end + 2))
    }

    start = body.indexOf("_", end)
  }

  if (closesInside && body[0] === "_") literal.add(offset)
}

function literalUnderscoreRuns(text: string): Set<number> {
  const literal = new Set<number>()

  if (!text.includes("_")) return literal

  for (const match of text.matchAll(PATH_TOKEN)) pathUnderscores(match[0], match.index, literal)
  return literal
}

function codeSpanEnd(text: string, index: number): number {
  const run = /^`+/.exec(text.slice(index))![0]
  const close = text.indexOf(run, index + run.length)
  const closes =
    run.length === 1 &&
    close > index + 1 &&
    !text.slice(index, close).includes("\n") &&
    text[close + 1] !== "`"
  return closes ? close : -1
}

function parsePieces(text: string): SourcePiece[] {
  const literalRuns = literalUnderscoreRuns(text)
  const root: SourcePiece[] = []
  const stack: Frame[] = []
  const push = (start: number, end: number, marks: RichTextMark[] = []) => {
    if (end <= start) return
    const pieces = stack.at(-1)?.pieces ?? root
    const last = pieces.at(-1)

    if (last?.end === start && sameMarks(last.marks, marks)) last.end = end
    else pieces.push({ start, end, marks })
  }
  let index = 0

  while (index < text.length) {
    const char = text[index]!

    if (char === "\\") {
      push(index, Math.min(index + 2, text.length))
      index += 2
      continue
    }

    if (char === "`") {
      const close = codeSpanEnd(text, index)
      const run = /^`+/.exec(text.slice(index))![0].length

      if (close === -1) {
        push(index, index + run)
        index += run
      } else {
        push(index + 1, close, ["code"])
        index = close + 1
      }

      continue
    }

    if (char !== "*" && char !== "_" && char !== "~") {
      push(index, index + 1)
      index += 1
      continue
    }

    let end = index

    while (text[end] === char) end += 1

    if (literalRuns.has(index)) {
      push(index, end)
      index = end
      continue
    }

    const before = text[index - 1] ?? ""
    const after = text[end] ?? ""
    const wordAfter = WORD_AFTER.test(text.slice(end, end + 2))
    const wordBefore = WORD_BEFORE.test(text.slice(Math.max(0, index - 2), index))
    const canClose = before !== "" && !/\s/.test(before) && (char !== "_" || !wordAfter)
    const canOpen = after !== "" && !/\s/.test(after) && (char !== "_" || !wordBefore)

    while (index < end) {
      const top = stack.at(-1)
      const opensNestedBold =
        top?.mark === "italic" &&
        end - index === 2 &&
        canOpen &&
        char !== "~" &&
        !stack.some((frame) => frame.mark === "bold")

      if (
        !opensNestedBold &&
        canClose &&
        top &&
        text.startsWith(top.delimiter, index) &&
        index + top.delimiter.length <= end
      ) {
        stack.pop()

        for (const piece of top.pieces) push(piece.start, piece.end, [top.mark, ...piece.marks])
        index += top.delimiter.length
      } else if (canOpen && (char !== "~" || end - index >= 2)) {
        const length = char === "~" || end - index >= 2 ? 2 : 1
        const mark: RichTextMark = char === "~" ? "strike" : length === 2 ? "bold" : "italic"

        if (stack.some((frame) => frame.mark === mark)) {
          push(index, end)
          index = end
          continue
        }

        stack.push({ delimiter: char.repeat(length), mark, start: index, pieces: [] })
        index += length
      } else {
        push(index, end)
        index = end
      }
    }
  }

  while (stack.length > 0) {
    const frame = stack.pop()!

    push(frame.start, frame.start + frame.delimiter.length)

    for (const piece of frame.pieces) push(piece.start, piece.end, piece.marks)
  }

  return root
}

export function parseInlineMarkdown(text: string): RichTextSpan[] {
  const spans: RichTextSpan[] = []

  for (const { start, end, marks } of parsePieces(text)) {
    const last = spans.at(-1)

    if (last && sameMarks(last.marks, marks)) last.text += text.slice(start, end)
    else spans.push({ text: text.slice(start, end), marks })
  }

  return spans
}

export function inlineMarkdownUnitMarks(text: string): Array<RichTextMark[] | null> {
  const result: Array<RichTextMark[] | null> = Array.from({ length: text.length }, () => null)

  for (const { start, end, marks } of parsePieces(text)) result.fill(marks, start, end)
  return result
}
