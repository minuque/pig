const HISTORY_LIMIT = 50

export interface PromptHistory {
  readonly size: number
  entries(): readonly string[]
  push(text: string): void
  prev(currentDraft: string): string | undefined
  next(): string | undefined
  resetCursor(): void
}

export function createPromptHistory(limit: number = HISTORY_LIMIT): PromptHistory {
  const entries: string[] = []
  let cursor: number | null = null
  let stash: string | undefined

  function resetCursor() {
    cursor = null
    stash = undefined
  }

  function push(text: string) {
    const value = text.trim()

    if (!value) return

    if (entries[entries.length - 1] !== value) {
      entries.push(value)

      if (entries.length > limit) entries.splice(0, entries.length - limit)
    }

    resetCursor()
  }

  function prev(currentDraft: string): string | undefined {
    if (!entries.length) return undefined

    if (cursor === null) {
      stash = currentDraft
      cursor = 0
    } else if (cursor < entries.length - 1) {
      cursor += 1
    }

    return entries[entries.length - 1 - cursor]
  }

  function next(): string | undefined {
    if (cursor === null) return undefined

    if (cursor > 0) {
      cursor -= 1
      return entries[entries.length - 1 - cursor]
    }

    const restored = stash ?? ""

    resetCursor()
    return restored
  }

  return {
    get size() {
      return entries.length
    },
    entries: () => [...entries],
    push,
    prev,
    next,
    resetCursor,
  }
}
