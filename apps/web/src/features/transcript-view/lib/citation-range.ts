const CONTROL_SELECTOR = 'button, input, textarea, select, [role="button"], [contenteditable]'
const EXCLUDED_SELECTOR = `${CONTROL_SELECTOR}, [hidden], [aria-hidden="true"], script, style, template, noscript, svg`
const BLOCK_SELECTOR =
  "address, article, aside, blockquote, dd, div, dl, dt, figcaption, figure, footer, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, td, th, tr, ul"

interface TextChunk {
  node: Text
  start: number
  end: number
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ")
}

export function rawTextOffset(text: string, normalizedOffset: number): number {
  let offset = 0

  for (const match of text.matchAll(/\s+|\S+/g)) {
    const token = match[0]
    const whitespace = /\s/.test(token[0]!)
    const length = whitespace ? 1 : token.length

    if (normalizedOffset <= offset + length) {
      return (
        match.index +
        (whitespace && normalizedOffset > offset ? token.length : normalizedOffset - offset)
      )
    }

    offset += length
  }

  return text.length
}

export function findCitationText(
  text: string,
  quoteText: string,
): { start: number; end: number } | null {
  const quote = normalizeWhitespace(quoteText).trim()

  if (!quote) return null
  const normalized = normalizeWhitespace(text)
  const start = normalized.indexOf(quote)

  if (start === -1) return null
  return { start, end: start + quote.length }
}

function readCitationText(root: HTMLElement): { text: string; chunks: TextChunk[] } {
  const parts: string[] = []
  const chunks: TextChunk[] = []
  let length = 0
  let separator = false
  const append = (node: Text, text: string) => {
    if (separator && length > 0) {
      parts.push("\n")
      length += 1
    }

    separator = false
    chunks.push({ node, start: length, end: length + text.length })
    parts.push(text)
    length += text.length
  }
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text

      if (text.length > 0) append(text, text.data)
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element

    if (element.matches(EXCLUDED_SELECTOR)) return
    const block = element.matches(BLOCK_SELECTOR)

    if (block || element.tagName === "BR") separator = true

    for (const child of element.childNodes) visit(child)

    if (block) separator = true
  }

  visit(root)
  return { text: parts.join(""), chunks }
}

export function resolveCitationRange(root: HTMLElement, quoteText: string): Range | null {
  if (root.closest(EXCLUDED_SELECTOR) !== null) return null
  const stream = readCitationText(root)
  const match = findCitationText(stream.text, quoteText)

  if (!match) return null
  const start = rawTextOffset(stream.text, match.start)
  const end = rawTextOffset(stream.text, match.end)
  const first = stream.chunks.find((chunk) => chunk.end > start)
  const last = stream.chunks.findLast((chunk) => chunk.start < end)

  if (!first || !last) return null
  const range = root.ownerDocument.createRange()

  range.setStart(first.node, Math.max(0, start - first.start))
  range.setEnd(last.node, Math.min(last.node.length, end - last.start))

  if (
    range.collapsed ||
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  ) {
    return null
  }

  return range
}
