export type ComposerTrigger =
  | { kind: "mention"; start: number; query: string }
  | { kind: "command"; start: number; query: string }
  | null

export const BLOCK_PREFIX =
  /^[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?|>[ \t]?|#{1,6}[ \t]+)*$/u

export function composerTriggerAt(text: string, caret: number): ComposerTrigger {
  const before = text.slice(0, caret)
  const start = before.search(/[^\s]*$/)

  if (start === -1) return null
  const token = before.slice(start)

  if (token.startsWith("@")) {
    if (token.length >= 2 && token[1] === '"') {
      const inner = token.slice(2)
      const closed = inner.includes('"')
      return closed ? null : { kind: "mention", start, query: inner }
    }

    return { kind: "mention", start, query: token.slice(1) }
  }

  const lineStart = before.lastIndexOf("\n", start - 1) + 1
  const prefix = before.slice(lineStart, start)

  if (token.startsWith("/") && BLOCK_PREFIX.test(prefix) && /^\/[^\s/]*$/.test(token)) {
    return { kind: "command", start, query: token.slice(1) }
  }

  return null
}

export const COMPOSER_MENTION_MIME = "application/x-pig-mention"

export function mentionPathNeedsQuoting(path: string): boolean {
  return /[\s()@"'`$\\]/.test(path)
}

export function mentionMarkdown(path: string): string {
  return mentionPathNeedsQuoting(path) ? `@${JSON.stringify(path)}` : `@${path}`
}

export function triggerKey(trigger: ComposerTrigger): string {
  return trigger ? `${trigger.kind}:${trigger.start}:${trigger.query}` : ""
}
