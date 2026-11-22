import type { JSONContent } from "@tiptap/core"
import { mentionPathNeedsQuoting } from "@features/composer/lib/composer-trigger.js"
import type { ComposerChip, ComposerCommandKind } from "@features/composer/type.js"

export interface ParsePromptOptions {
  commandNames?: ReadonlySet<string> | undefined
}

interface CommandChipAttrs {
  name: string
  kind?: ComposerCommandKind | undefined
}

const SKILL_PREFIX = "skill:"
const PATH_TOKEN = /^[\w./\\~:+-]+$/u
const EXTENSION = /\.[A-Za-z0-9]+$/u
const COMMAND = /^\/([^\s/]+)(?=\s|$)/u
const COMMAND_NAME = /^[A-Za-z0-9][\w.-]*$/u

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path
}

function looksLikePath(token: string): boolean {
  if (!PATH_TOKEN.test(token)) return false
  return token.includes("/") || EXTENSION.test(token)
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

function unquote(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
  }
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

function inlineNodes(line: string, options: ParsePromptOptions): JSONContent[] {
  const nodes: JSONContent[] = []
  let text = ""
  let index = 0

  function flush() {
    if (!text) return
    nodes.push({ type: "text", text })
    text = ""
  }

  const command = commandToken(line, options)

  if (command) {
    nodes.push({ type: "commandChip", attrs: command.attrs })
    index = command.length
  }

  while (index < line.length) {
    const atBoundary = index === 0 || /\s/u.test(line[index - 1] ?? "")
    const mention = line[index] === "@" && atBoundary ? mentionToken(line, index) : undefined

    if (mention) {
      flush()
      nodes.push({
        type: "fileMention",
        attrs: { path: mention.path, label: basename(mention.path) },
      })
      index += mention.length
      continue
    }

    text += line[index]
    index += 1
  }

  flush()
  return nodes
}

export function parsePromptToDoc(raw: string, options: ParsePromptOptions = {}): JSONContent {
  return {
    type: "doc",
    content: raw.split("\n").map((line) => {
      const content = inlineNodes(line, options)
      return content.length ? { type: "paragraph", content } : { type: "paragraph" }
    }),
  }
}

function serializeMention(attrs: Record<string, unknown> | undefined): string {
  const path = String(attrs?.["path"] ?? "")
  return mentionPathNeedsQuoting(path) ? `@${JSON.stringify(path)}` : `@${path}`
}

function serializeCommand(attrs: Record<string, unknown> | undefined): string {
  const name = String(attrs?.["name"] ?? "")
  return attrs?.["kind"] === "skill" ? `/${SKILL_PREFIX}${name}` : `/${name}`
}

function serializeInline(node: JSONContent): string {
  switch (node.type) {
    case "text":
      return node.text ?? ""
    case "fileMention":
      return serializeMention(node.attrs)
    case "commandChip":
      return serializeCommand(node.attrs)
    default:
      return node.text ?? ""
  }
}

export function serializeDocToPrompt(doc: JSONContent): string {
  return (doc.content ?? [])
    .map((block) => (block.content ?? []).map(serializeInline).join(""))
    .join("\n")
}

export function collectChips(doc: JSONContent): ComposerChip[] {
  const chips: ComposerChip[] = []

  for (const block of doc.content ?? []) {
    for (const node of block.content ?? []) {
      if (node.type === "fileMention") {
        const path = String(node.attrs?.["path"] ?? "")

        chips.push({
          kind: "file",
          path,
          label: String(node.attrs?.["label"] ?? "") || basename(path),
        })
      } else if (node.type === "commandChip") {
        const kind = node.attrs?.["kind"]

        chips.push({
          kind: "command",
          name: String(node.attrs?.["name"] ?? ""),
          commandKind: kind === "skill" || kind === "template" ? kind : undefined,
        })
      }
    }
  }

  return chips
}

export function hasPromptContent(raw: string): boolean {
  const doc = parsePromptToDoc(raw)
  return serializeDocToPrompt(doc).trim().length > 0 || collectChips(doc).length > 0
}
