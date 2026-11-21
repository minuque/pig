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
