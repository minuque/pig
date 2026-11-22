export type ComposerTrigger =
  | { kind: "mention"; start: number; query: string }
  | { kind: "command"; start: number; query: string }
  | null

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

  if (token.startsWith("/") && start === lineStart && /^\/[^\s/]*$/.test(token)) {
    return { kind: "command", start, query: token.slice(1) }
  }

  return null
}

export function mentionPathNeedsQuoting(path: string): boolean {
  return /[\s()@"'`$\\]/.test(path)
}

export function triggerKey(trigger: ComposerTrigger): string {
  return trigger ? `${trigger.kind}:${trigger.start}:${trigger.query}` : ""
}
