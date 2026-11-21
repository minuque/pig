import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, posix, relative, resolve, sep } from "node:path"

import type { Environment } from "@pig/environment/source"

// 外部：<file> 块与内联内容的形状同 Pi CLI processFileArguments

const MENTION_PATTERN = /(^|\s)@(?:"((?:\\.|[^"\\])*)"|([^\s@]+))/g
const MAX_MENTION_FILES = 16
const MAX_INLINE_BYTES = 512 * 1024
const MAX_TOTAL_INLINE_BYTES = 2 * 1024 * 1024
const BINARY_BYTES = /[\u0000-\u0008\u000e-\u001f]/

interface MentionToken {
  start: number
  end: number
  path: string
}

function findMentionTokens(text: string): MentionToken[] {
  const tokens: MentionToken[] = []

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const at = match.index + match[1]!.length
    const raw = match[2] !== undefined ? match[2] : (match[3] ?? "")
    const tail = match.index + match[0].length

    if (tail < text.length && !/\s/.test(text[tail]!)) continue
    const path = match[2] !== undefined ? raw.replace(/\\(["\\])/g, "$1") : raw

    if (!path || isAbsolute(path)) continue
    tokens.push({ start: at, end: tail, path })
  }

  return tokens
}

function escapeFileName(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function escapeFileContent(value: string): string {
  return value.replace(/<\/(file)/gi, "<\\/$1")
}

interface MentionSource {
  locate(path: string): Promise<string | undefined>
  size(path: string): Promise<number | undefined>
  read(path: string): Promise<string>
}

export function expandFileMentions(
  text: string,
  cwd: string,
  env?: Environment,
): Promise<string> | string {
  const tokens = findMentionTokens(text)

  if (!tokens.length) return text
  return (env ? Promise.resolve(remoteSource(env, cwd)) : localSource(cwd)).then((source) =>
    source ? expandTokens(text, tokens, source) : text,
  )
}

function insideRoot(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

async function localSource(cwd: string): Promise<MentionSource | undefined> {
  const root = await realpath(cwd).catch(() => undefined)

  if (!root) return undefined
  return {
    locate: async (path) => {
      const target = await realpath(resolve(root, path))
      return insideRoot(root, target) ? target : undefined
    },
    size: async (path) => {
      const stats = await stat(path)
      return stats.isFile() ? stats.size : undefined
    },
    read: (path) => readFile(path, "utf-8"),
  }
}

function remoteSource(env: Environment, root: string): MentionSource {
  const base = posix.resolve(root)
  return {
    locate: async (path) => {
      const target = posix.resolve(base, path)
      return target === base || target.startsWith(`${base.replace(/\/$/, "")}/`)
        ? target
        : undefined
    },
    size: async (path) => {
      const stats = await env.stat(path)
      return stats?.kind === "file" ? stats.size : undefined
    },
    read: async (path) => (await env.readFile(path)).toString("utf8"),
  }
}

async function expandTokens(
  text: string,
  tokens: MentionToken[],
  source: MentionSource,
): Promise<string> {
  const blocks: string[] = []
  const seen = new Set<string>()
  let inlineBytes = 0

  for (const token of tokens.slice(0, MAX_MENTION_FILES)) {
    try {
      const target = await source.locate(token.path)

      if (!target || seen.has(target)) continue
      seen.add(target)
      const size = await source.size(target)

      if (!size) continue

      if (size > MAX_INLINE_BYTES || inlineBytes + size > MAX_TOTAL_INLINE_BYTES) {
        blocks.push(
          `<file name="${escapeFileName(target)}">超出内联配额，未内联；请用 read 工具查看。</file>`,
        )
        continue
      }

      const content = await source.read(target)

      if (BINARY_BYTES.test(content)) {
        blocks.push(`<file name="${escapeFileName(target)}">二进制文件，未内联。</file>`)
        continue
      }

      inlineBytes += size
      blocks.push(`<file name="${escapeFileName(target)}">\n${escapeFileContent(content)}\n</file>`)
    } catch {}
  }

  if (!blocks.length) return text
  return `${text}\n\n${blocks.join("\n")}`
}

export function mentionPaths(text: string): string[] {
  return findMentionTokens(text).map((token) => token.path)
}
