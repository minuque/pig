import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

/**
 * @ 文件引用展开：把 prompt 里的 @path / @"quoted path" 展开为
 * <file name="abs">…</file> 文本块（与 Pi CLI processFileArguments 同一形状），
 * 读不到的文件按纯文本留下，agent 仍能用 read 工具自己找。
 *
 * 只处理 token 级 @（空白或行首起），避免吃掉邮件地址与代码示例。
 */

const MENTION_PATTERN = /(^|\s)@(?:"((?:\\.|[^"\\])*)"|([^\s@]+))/g
const MAX_MENTION_FILES = 16
/** 单文件内联上限 512KB；图片等二进制不内联，只留路径让 agent 自取。 */
const MAX_INLINE_BYTES = 512 * 1024
/** 一次 prompt 内联总量上限，防长文本撑爆上下文。 */
const MAX_TOTAL_INLINE_BYTES = 2 * 1024 * 1024
const BINARY_BYTES = /[\u0000-\u0008\u000e-\u001f]/

interface MentionToken {
  start: number
  end: number
  /** @"..." 里的转义还原后的路径。 */
  path: string
}

/** token 边界：@前必须是行首或空白（已含在捕获组1），token 后到空白/结尾。 */
function findMentionTokens(text: string): MentionToken[] {
  const tokens: MentionToken[] = []

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const at = match.index + match[1]!.length
    const raw = match[2] !== undefined ? match[2] : (match[3] ?? "")
    const tail = match.index + match[0].length

    // token 后面必须是空白或结尾；@x,y 之类不展
    if (tail < text.length && !/\s/.test(text[tail]!)) continue
    const path = match[2] !== undefined ? raw.replace(/\\(["\\])/g, "$1") : raw

    if (!path || isAbsolute(path)) continue
    tokens.push({ start: at, end: tail, path })
  }

  return tokens
}

/** name 属性里路径的 " 会破坏属性边界；& 与 < 顺手转义，内容不受影响。 */
function escapeFileName(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

/** 内容原样保留（与 Pi CLI 一致），只防 </file> 提前闭合块。 */
function escapeFileContent(value: string): string {
  return value.replace(/<\/file/gi, "<\\/file")
}

/**
 * 展开 prompt 中的 @ 引用。返回展开后的文本；
 * 引用不存在的路径、目录、二进制、超限文件都保留原文 token。
 * 零 mention 时同步短路：调用方可以把它当纯函数串在 prompt 链路里。
 */
export function expandFileMentions(text: string, cwd: string): Promise<string> | string {
  const tokens = findMentionTokens(text)

  if (!tokens.length) return text
  return expandTokens(text, tokens, cwd)
}

/** 真实路径是否在 root 之内（含 root 自身）。相对结果是空，或在 root 下的非 .. 路径才算。 */
function insideRoot(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

async function expandTokens(text: string, tokens: MentionToken[], cwd: string): Promise<string> {
  const blocks: string[] = []
  const seen = new Set<string>()
  /** 真实 root 一次解析：symlink 比对用真实路径，不用字面前缀。 */
  let realRoot: string | undefined

  try {
    realRoot = await realpath(cwd)
  } catch {
    return text
  }

  let inlineBytes = 0

  for (const token of tokens.slice(0, MAX_MENTION_FILES)) {
    const absolute = resolve(realRoot, token.path)

    try {
      // realpath 解析 symlink/junction，越界目标不展开；别名按真实路径去重
      const realTarget = await realpath(absolute)

      if (!insideRoot(realRoot, realTarget) || seen.has(realTarget)) continue
      seen.add(realTarget)
      const stats = await stat(realTarget)

      if (!stats.isFile() || stats.size === 0) continue

      if (stats.size > MAX_INLINE_BYTES || inlineBytes + stats.size > MAX_TOTAL_INLINE_BYTES) {
        blocks.push(
          `<file name="${escapeFileName(realTarget)}">超出内联配额，未内联；请用 read 工具查看。</file>`,
        )
        continue
      }

      const content = await readFile(realTarget, "utf-8")

      if (BINARY_BYTES.test(content)) {
        blocks.push(`<file name="${escapeFileName(realTarget)}">二进制文件，未内联。</file>`)
        continue
      }

      inlineBytes += stats.size
      blocks.push(
        `<file name="${escapeFileName(realTarget)}">\n${escapeFileContent(content)}\n</file>`,
      )
    } catch {
      // 读不到的路径保留原 token，agent 可自行 read 或澄清
    }
  }

  if (!blocks.length) return text
  return `${text}\n\n${blocks.join("\n")}`
}

/** 供单测与将来调试：只解析不读盘。 */
export function mentionPaths(text: string): string[] {
  return findMentionTokens(text).map((token) => token.path)
}
