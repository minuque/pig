import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, posix, relative, resolve, sep } from "node:path"

import type { Environment } from "@pig/environment/source"

/**
 * @ 文件引用展开：把 prompt 里的 @path / @"quoted path" 展开为
 * <file name="abs">…</file> 文本块（与 Pi CLI processFileArguments 同一形状），
 * 读不到的文件按纯文本留下，agent 仍能用 read 工具自己找。
 *
 * 只处理 token 级 @（空白或行首起），避免吃掉邮件地址与代码示例。
 */

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

/** 内容原样保留（与 Pi CLI 一致），只防 </file> 提前闭合块；保留原文大小写。 */
function escapeFileContent(value: string): string {
  return value.replace(/<\/(file)/gi, "<\\/$1")
}

interface MentionSource {
  locate(path: string): Promise<string | undefined>
  size(path: string): Promise<number | undefined>
  read(path: string): Promise<string>
}

/**
 * 展开 prompt 中的 @ 引用。返回展开后的文本；
 * 引用不存在的路径、目录、二进制、超限文件都保留原文 token。
 * 零 mention 时同步短路：调用方可以把它当纯函数串在 prompt 链路里。
 * 给了环境时按该环境里的 POSIX 根解析（远程会话）。
 */
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

/** 远端：按 POSIX 路径解析，文件经环境读。 */
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
      // 别名按真实路径去重
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
