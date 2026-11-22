import type { JSONContent } from "@tiptap/core"
import { basename } from "@features/composer/lib/command-menu-groups.js"
import { fromJson, writeMarkdown } from "@features/composer/lib/tiptap-blocks.js"
import type { ParsePromptOptions, PromptNode } from "@features/composer/lib/tiptap-inline.js"
import { parseBlocks } from "@features/composer/lib/tiptap-parse.js"
import type { ComposerChip } from "@features/composer/type.js"

export type { ParsePromptOptions } from "@features/composer/lib/tiptap-inline.js"

export function parsePromptToDoc(raw: string, options: ParsePromptOptions = {}): JSONContent {
  const blocks = parseBlocks(raw.split("\n"), options)
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] }
}

export function serializeDocToPrompt(doc: JSONContent): string {
  return writeMarkdown(fromJson(doc)).text
}

function chipsOf(node: PromptNode): ComposerChip[] {
  const chips: ComposerChip[] = []

  for (const child of node.content ?? []) {
    if (child.type === "fileMention") {
      const path = String(child.attrs?.["path"] ?? "")

      chips.push({
        kind: "file",
        path,
        label: String(child.attrs?.["label"] ?? "") || basename(path),
      })
      continue
    }

    if (child.type === "commandChip") {
      const kind = child.attrs?.["kind"]

      chips.push({
        kind: "command",
        name: String(child.attrs?.["name"] ?? ""),
        commandKind: kind === "skill" || kind === "template" ? kind : undefined,
      })
      continue
    }

    chips.push(...chipsOf(child))
  }

  return chips
}

export function collectChips(doc: JSONContent): ComposerChip[] {
  return chipsOf(fromJson(doc))
}

export function hasPromptContent(raw: string): boolean {
  const doc = parsePromptToDoc(raw)
  return serializeDocToPrompt(doc).trim().length > 0 || collectChips(doc).length > 0
}
