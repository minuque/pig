import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { basename } from "@features/composer/lib/command-menu-groups.js"
import { BLOCK_PREFIX, mentionPathNeedsQuoting } from "@features/composer/lib/composer-trigger.js"
import { codeSpanAt } from "@features/composer/lib/editor/rich-text.js"

export type PromptSegment =
  | { type: "text"; text: string }
  | { type: "mention"; path: string; source: string }
  | { type: "command"; name: string; skill: boolean; source: string }

export interface ChipJson {
  type: string
  attrs: Record<string, unknown>
}

const SKILL_PREFIX = "skill:"
const PATH_TOKEN = /^[\w./\\~:+-]+$/u
const EXTENSION = /\.[A-Za-z0-9]+$/u
const COMMAND = /^\/([^\s/]+)(?=\s|$)/u
const COMMAND_NAME = /^[A-Za-z0-9][\w.-]*$/u

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

function mentionAt(text: string, start: number): PromptSegment | undefined {
  if (text[start + 1] === '"') {
    const quoted = /^"((?:[^"\\\n]|\\.)*)"/u.exec(text.slice(start + 1))

    if (!quoted) return undefined
    const path = unquote(quoted[1] ?? "")

    if (!path.trim()) return undefined
    return { type: "mention", path, source: `@${quoted[0]}` }
  }

  const bare = /^[^\s@]+/u.exec(text.slice(start + 1))?.[0] ?? ""

  if (!looksLikePath(bare)) return undefined
  return { type: "mention", path: bare, source: `@${bare}` }
}

function commandAt(text: string, start: number, lineStart: number): PromptSegment | undefined {
  if (!BLOCK_PREFIX.test(text.slice(lineStart, start))) return undefined
  const raw = COMMAND.exec(text.slice(start))?.[1]

  if (!raw) return undefined
  const skill = raw.startsWith(SKILL_PREFIX)
  const name = skill ? raw.slice(SKILL_PREFIX.length) : raw

  if (!COMMAND_NAME.test(name)) return undefined
  return { type: "command", name, skill, source: `/${raw}` }
}

function codeSpanEnd(text: string, index: number): number {
  const span = codeSpanAt(text, index)

  if (span) return span.end
  let end = index

  while (text[end] === "`") end += 1
  return end
}

export function splitPromptSegments(text: string): PromptSegment[] {
  const segments: PromptSegment[] = []
  let plain = ""
  let lineStart = 0
  let index = 0
  const flush = () => {
    if (plain) segments.push({ type: "text", text: plain })
    plain = ""
  }

  while (index < text.length) {
    const char = text[index]!
    let token: PromptSegment | undefined

    if (char === "\\" || char === "`") {
      const end = char === "\\" ? index + 2 : codeSpanEnd(text, index)

      plain += text.slice(index, end)
      index = end
      continue
    }

    if (char === "\n") lineStart = index + 1

    if (char === "@" && (index === 0 || /\s/u.test(text[index - 1]!)))
      token = mentionAt(text, index)

    if (char === "/") token = commandAt(text, index, lineStart)

    if (!token || token.type === "text") {
      plain += char
      index += 1
      continue
    }

    flush()
    segments.push(token)
    index += token.source.length
  }

  flush()
  return segments
}

export function chipJson(segment: Exclude<PromptSegment, { type: "text" }>): ChipJson {
  if (segment.type === "mention") {
    return { type: "fileMention", attrs: { path: segment.path, label: basename(segment.path) } }
  }

  return {
    type: "commandChip",
    attrs: { name: segment.name, kind: segment.skill ? "skill" : null },
  }
}

export function chipSource(node: ProseMirrorNode): string {
  const attrs = node.attrs as Record<string, unknown>

  if (node.type.name === "fileMention") {
    const path = String(attrs["path"] ?? "")
    return mentionPathNeedsQuoting(path) ? `@${JSON.stringify(path)}` : `@${path}`
  }

  if (node.type.name === "commandChip") {
    const name = String(attrs["name"] ?? "")
    return attrs["kind"] === "skill" ? `/${SKILL_PREFIX}${name}` : `/${name}`
  }

  return ""
}

export function isChipNode(node: ProseMirrorNode | null | undefined): boolean {
  return !!node && node.isInline && node.isAtom && !node.isText
}
