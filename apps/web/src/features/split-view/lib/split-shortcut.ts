export type SplitCommand = "new-right" | "focus-next" | "focus-previous" | "close"

type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "defaultPrevented"
>

// 外部：Windows 上 Ctrl+Win 被系统占用，非 macOS 用 Ctrl+Alt
export function splitShortcut(event: KeyLike, mac: boolean): SplitCommand | null {
  if (event.defaultPrevented || event.repeat || event.shiftKey || !event.ctrlKey) return null

  if (!event.metaKey && !event.altKey) {
    if (event.code === "BracketRight") return "focus-next"

    if (event.code === "BracketLeft") return "focus-previous"
    return null
  }

  const chord = mac ? event.metaKey && !event.altKey : event.altKey && !event.metaKey

  if (!chord) return null

  if (event.code === "Backslash") return "new-right"
  return event.code === "KeyW" ? "close" : null
}

export type ViewCommand = { to: number } | { step: 1 | -1 }

export function viewShortcut(event: KeyLike, mac: boolean, typing = false): ViewCommand | null {
  if (event.defaultPrevented || event.shiftKey || event.altKey) return null

  if (event.ctrlKey && !event.metaKey && !event.repeat) {
    if (event.code === "PageUp" || (event.code === "ArrowLeft" && !typing)) return { step: -1 }

    if (event.code === "PageDown" || (event.code === "ArrowRight" && !typing)) return { step: 1 }
  }

  const digit = /^Digit([1-9])$/.exec(event.code)?.[1]
  const chord = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  return digit && chord && !event.repeat ? { to: Number(digit) - 1 } : null
}
