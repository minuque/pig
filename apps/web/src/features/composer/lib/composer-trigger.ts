/**
 * 输入卡触发器：光标前最后一个 token 的 @ / 前缀。
 * 与 Synara composer-logic 同一思路：只向前退到空白，token 内部不空格。
 */

export type ComposerTrigger =
  | { kind: "mention"; start: number; query: string }
  | { kind: "command"; start: number; query: string }
  | null

/** 光标处的触发 token；无触发返回 null。@ 允许路径字符，/ 只认行首单词。 */
export function composerTriggerAt(text: string, caret: number): ComposerTrigger {
  const before = text.slice(0, caret)
  const start = before.search(/[^\s]*$/)

  if (start === -1) return null
  const token = before.slice(start)

  if (token.startsWith("@")) {
    // @"..." 引号路径：引号未闭合也算触发，候选选中后补全
    if (token.length >= 2 && token[1] === '"') {
      const inner = token.slice(2)
      const closed = inner.includes('"')
      return closed ? null : { kind: "mention", start, query: inner }
    }

    return { kind: "mention", start, query: token.slice(1) }
  }

  // / 只在行首触发，避免路径与除法误伤
  const lineStart = before.lastIndexOf("\n", start - 1) + 1

  if (token.startsWith("/") && start === lineStart && /^\/[^\s/]*$/.test(token)) {
    return { kind: "command", start, query: token.slice(1) }
  }

  return null
}

/** 需要引号包住的路径：空格、括号、引号、shell 元字符。 */
export function mentionPathNeedsQuoting(path: string): boolean {
  return /[\s()@"'`$\\]/.test(path)
}

/** 选中候替换触发 token：需要时 @"..."，结尾补一个空格。 */
export function applyTriggerChoice(
  text: string,
  caret: number,
  trigger: Exclude<ComposerTrigger, null>,
  value: string,
): { text: string; caret: number } {
  const raw =
    trigger.kind === "mention" && mentionPathNeedsQuoting(value)
      ? `@${JSON.stringify(value)}`
      : `${trigger.kind === "mention" ? "@" : "/"}${value}`
  const inserted = `${raw} `
  const next = text.slice(0, trigger.start) + inserted + text.slice(caret)
  return { text: next, caret: trigger.start + inserted.length }
}
