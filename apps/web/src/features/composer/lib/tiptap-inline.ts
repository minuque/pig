import type { JSONContent } from "@tiptap/core"
import { basename } from "@features/composer/lib/command-menu-groups.js"
import { mentionPathNeedsQuoting } from "@features/composer/lib/composer-trigger.js"
import type { ComposerCommandKind } from "@features/composer/type.js"

export type InlineMark = "bold" | "italic" | "strike" | "code"

export interface ParsePromptOptions {
  commandNames?: ReadonlySet<string> | undefined
}

export interface PromptNode {
  type: string
  at: number
  text?: string | undefined
  attrs?: Record<string, unknown> | undefined
  marks?: readonly string[] | undefined
  content?: readonly PromptNode[] | undefined
}

export interface MarkdownSink {
  virtual(at: number, markdown: string): void
  mapped(at: number, length: number, markdown: string): void
}

interface InlineSpan {
  text: string
  marks: readonly InlineMark[]
}

interface Level {
  mark: InlineMark | null
  delimiter: string
  spans: InlineSpan[]
}

interface CommandChipAttrs {
  name: string
  kind?: ComposerCommandKind | undefined
}

const MARK_ORDER: readonly InlineMark[] = ["strike", "bold", "italic", "code"]
const SKILL_PREFIX = "skill:"
const PATH_TOKEN = /^[\w./\\~:+-]+$/u
const EXTENSION = /\.[A-Za-z0-9]+$/u
const COMMAND = /^\/([^\s/]+)(?=\s|$)/u
const COMMAND_NAME = /^[A-Za-z0-9][\w.-]*$/u

function sortMarks(marks: readonly InlineMark[]): InlineMark[] {
  return MARK_ORDER.filter((mark) => marks.includes(mark))
}

function sameMarks(left: readonly InlineMark[], right: readonly InlineMark[]): boolean {
  return left.length === right.length && left.every((mark, index) => mark === right[index])
}

function canonicalMarks(marks: readonly string[]): InlineMark[] {
  return sortMarks(
    marks.filter((mark): mark is InlineMark => MARK_ORDER.includes(mark as InlineMark)),
  )
}

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/u.test(char)
}

export function longestBacktickRun(text: string): number {
  return Math.max(0, ...[...text.matchAll(/`+/gu)].map((match) => match[0].length))
}

function topLevel(levels: readonly Level[]): Level {
  return levels[levels.length - 1]!
}

function emitText(levels: Level[], text: string): void {
  if (!text) return
  const spans = topLevel(levels).spans
  const last = spans[spans.length - 1]

  if (last && last.marks.length === 0) last.text += text
  else spans.push({ text, marks: [] })
}

function emitCode(levels: Level[], text: string): void {
  topLevel(levels).spans.push({ text, marks: ["code"] })
}

function mergeInto(target: InlineSpan[], span: InlineSpan, mark: InlineMark | null): void {
  const marks = mark ? sortMarks([...span.marks, mark]) : span.marks
  const last = target[target.length - 1]

  if (last && sameMarks(last.marks, marks)) last.text += span.text
  else target.push({ text: span.text, marks })
}

function closeLevel(levels: Level[]): void {
  const frame = levels.pop()

  if (!frame) return
  const target = topLevel(levels).spans

  for (const span of frame.spans) mergeInto(target, span, frame.mark)
}

function dropLevel(levels: Level[]): void {
  const frame = levels.pop()

  if (!frame) return
  const target = topLevel(levels).spans

  emitText(levels, frame.delimiter)

  for (const span of frame.spans) mergeInto(target, span, null)
}

function hasLevel(levels: readonly Level[], mark: InlineMark): boolean {
  return levels.some((level) => level.mark === mark)
}

function findClosingFence(text: string, start: number, run: number): number {
  let cursor = start

  while (cursor < text.length) {
    const next = text.indexOf("`", cursor)

    if (next === -1) return -1
    let end = next + 1

    while (text[end] === "`") end += 1

    if (end - next === run) return next
    cursor = end
  }

  return -1
}

function readCode(text: string, index: number, levels: Level[]): number {
  const run = /^`+/u.exec(text.slice(index))![0].length
  const fence = "`".repeat(run)
  const close = findClosingFence(text, index + run, run)

  if (close === -1) {
    emitText(levels, fence)
    return index + run
  }

  let content = text.slice(index + run, close)

  if (content.length > 1 && content.startsWith(" ") && content.endsWith(" ")) {
    content = content.slice(1, -1)
  }

  if (!content) {
    emitText(levels, text.slice(index, close + run))
    return close + run
  }

  emitCode(levels, content)
  return close + run
}

function inlineCodeEnd(text: string, index: number): number {
  const run = /^`+/u.exec(text.slice(index))![0].length
  const close = findClosingFence(text, index + run, run)
  return close === -1 ? index + run : close + run
}

function readStar(text: string, index: number, levels: Level[]): number {
  const run = /^\*+/u.exec(text.slice(index))![0].length
  const canOpen = !isSpace(text[index + run])
  const canClose = !isSpace(text[index - 1])
  let remaining = run
  let cursor = index

  while (remaining > 0) {
    const frame = topLevel(levels)
    const needed = frame.mark === "bold" ? 2 : frame.mark === "italic" ? 1 : 0

    if (canClose && needed > 0 && remaining >= needed) {
      closeLevel(levels)
      remaining -= needed
      cursor += needed
      continue
    }

    if (canOpen) {
      const take = remaining >= 2 ? 2 : 1
      const mark = take === 2 ? "bold" : "italic"

      if (!hasLevel(levels, mark)) {
        levels.push({ mark, delimiter: "*".repeat(take), spans: [] })
        remaining -= take
        cursor += take
        continue
      }
    }

    emitText(levels, "*".repeat(remaining))
    cursor += remaining
    remaining = 0
  }

  return cursor
}

function readStrike(text: string, index: number, levels: Level[]): number {
  const run = /^~+/u.exec(text.slice(index))![0].length

  if (run < 2) {
    emitText(levels, "~".repeat(run))
    return index + run
  }

  const canOpen = !isSpace(text[index + run])
  const canClose = !isSpace(text[index - 1])

  if (canClose && topLevel(levels).mark === "strike") closeLevel(levels)
  else if (canOpen && !hasLevel(levels, "strike"))
    levels.push({ mark: "strike", delimiter: "~~", spans: [] })
  else emitText(levels, "~~")
  return index + 2
}

export function parseInlineSpans(text: string): InlineSpan[] {
  const levels: Level[] = [{ mark: null, delimiter: "", spans: [] }]
  let index = 0

  while (index < text.length) {
    const char = text[index]!

    if (char === "\\") {
      emitText(levels, text.slice(index, index + 2))
      index += 2
      continue
    }

    if (char === "`") {
      index = readCode(text, index, levels)
      continue
    }

    if (char === "*") {
      index = readStar(text, index, levels)
      continue
    }

    if (char === "~") {
      index = readStrike(text, index, levels)
      continue
    }

    emitText(levels, char)
    index += 1
  }

  while (levels.length > 1) dropLevel(levels)
  return topLevel(levels).spans
}

export function parseInlineMarkdown(text: string): JSONContent[] {
  return parseInlineSpans(text).map((span) => ({
    type: "text",
    text: span.text,
    ...(span.marks.length ? { marks: span.marks.map((mark) => ({ type: mark })) } : {}),
  }))
}

function looksLikePath(token: string): boolean {
  if (!PATH_TOKEN.test(token) || token.endsWith("/")) return false
  return token.includes("/") || EXTENSION.test(token)
}

function unquote(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
  }
}

function mentionToken(line: string, start: number): { path: string; length: number } | undefined {
  if (line[start + 1] === '"') {
    const quoted = /^"((?:[^"\\]|\\.)*)"/u.exec(line.slice(start + 1))

    if (!quoted) return undefined
    const path = unquote(quoted[1] ?? "")

    if (!path.trim()) return undefined
    return { path, length: 1 + quoted[0]!.length }
  }

  const bare = /^[^\s@]+/u.exec(line.slice(start + 1))?.[0] ?? ""

  if (!looksLikePath(bare)) return undefined
  return { path: bare, length: 1 + bare.length }
}

function commandToken(
  line: string,
  options: ParsePromptOptions,
): { attrs: CommandChipAttrs; length: number } | undefined {
  const raw = COMMAND.exec(line)?.[1]

  if (!raw) return undefined
  const skill = raw.startsWith(SKILL_PREFIX)
  const name = skill ? raw.slice(SKILL_PREFIX.length) : raw

  if (!COMMAND_NAME.test(name)) return undefined

  const names = options.commandNames

  if (names && !names.has(raw) && !names.has(name)) return undefined
  return { attrs: skill ? { name, kind: "skill" } : { name }, length: 1 + raw.length }
}

export function parseLine(line: string, options: ParsePromptOptions = {}): JSONContent[] {
  const nodes: JSONContent[] = []
  let text = ""
  let index = 0

  function flush() {
    if (!text) return
    nodes.push(...parseInlineMarkdown(text))
    text = ""
  }

  const command = commandToken(line, options)

  if (command) {
    nodes.push({ type: "commandChip", attrs: command.attrs })
    index = command.length
  }

  while (index < line.length) {
    const char = line[index]!

    if (char === "\\") {
      text += line.slice(index, index + 2)
      index += 2
      continue
    }

    if (char === "`") {
      const end = inlineCodeEnd(line, index)

      text += line.slice(index, end)
      index = end
      continue
    }

    const atBoundary = index === 0 || /\s/u.test(line[index - 1] ?? "")
    const mention = char === "@" && atBoundary ? mentionToken(line, index) : undefined

    if (mention) {
      flush()
      nodes.push({
        type: "fileMention",
        attrs: { path: mention.path, label: basename(mention.path) },
      })
      index += mention.length
      continue
    }

    text += char
    index += 1
  }

  flush()
  return nodes
}

function serializeMention(attrs: Record<string, unknown> | undefined): string {
  const path = String(attrs?.["path"] ?? "")
  return mentionPathNeedsQuoting(path) ? `@${JSON.stringify(path)}` : `@${path}`
}

function serializeCommand(attrs: Record<string, unknown> | undefined): string {
  const name = String(attrs?.["name"] ?? "")
  return attrs?.["kind"] === "skill" ? `/${SKILL_PREFIX}${name}` : `/${name}`
}

export function chipToken(type: string, attrs: Record<string, unknown> | undefined): string {
  if (type === "fileMention") return serializeMention(attrs)

  if (type === "commandChip") return serializeCommand(attrs)
  return ""
}

function markAffixes(
  text: string,
  rawMarks: readonly string[],
): { prefix: string; suffix: string } {
  const marks = canonicalMarks(rawMarks)
  let prefix = ""
  let suffix = ""

  if (marks.includes("strike")) {
    prefix += "~~"
    suffix = `~~${suffix}`
  }

  if (marks.includes("bold")) {
    prefix += "**"
    suffix = `**${suffix}`
  }

  if (marks.includes("italic")) {
    prefix += "*"
    suffix = `*${suffix}`
  }

  if (marks.includes("code")) {
    const fence = "`".repeat(longestBacktickRun(text) + 1)
    const pad = text.startsWith("`") || text.endsWith("`") ? " " : ""

    prefix += `${fence}${pad}`
    suffix = `${pad}${fence}${suffix}`
  }

  return { prefix, suffix }
}

export function writeInline(node: PromptNode, sink: MarkdownSink): void {
  const children = node.content ?? []
  let index = 0

  while (index < children.length) {
    const child = children[index]!

    if (child.type !== "text") {
      sink.mapped(child.at, 1, chipToken(child.type, child.attrs))
      index += 1
      continue
    }

    const marks = child.marks ?? []
    let text = child.text ?? ""

    index += 1

    while (index < children.length) {
      const next = children[index]!

      if (
        next.type !== "text" ||
        !sameMarks(canonicalMarks(next.marks ?? []), canonicalMarks(marks))
      )
        break
      text += next.text ?? ""
      index += 1
    }

    if (!text) continue
    const { prefix, suffix } = markAffixes(text, marks)

    sink.virtual(child.at, prefix)
    sink.mapped(child.at, text.length, text)
    sink.virtual(child.at + text.length, suffix)
  }
}
