type KeyLike = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "defaultPrevented"
>

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
