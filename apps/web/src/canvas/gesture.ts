export type PointerIntent = "pan" | "move" | "ignore"

export type WheelIntent = "zoom" | "pan" | "native"

export type ScrollBox = {
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
  overflowX: string
  overflowY: string
}

const SCROLLABLE = new Set(["auto", "scroll", "overlay"])

export function focusAllowsSpacePan(
  tagName: string,
  role: string | null,
  editable: boolean,
): boolean {
  if (editable) return false

  if (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    tagName === "BUTTON" ||
    tagName === "A"
  ) {
    return false
  }

  if (!role) return true
  return ![
    "button",
    "checkbox",
    "link",
    "menuitem",
    "radio",
    "slider",
    "switch",
    "textbox",
  ].includes(role)
}

export function pointerIntent(input: {
  button: number
  buttons: number
  spaceHeld: boolean
  spaceAllowed: boolean
  onHandle: boolean
  onEmpty: boolean
  onControls: boolean
}): PointerIntent {
  const middle = input.button === 1 || (input.buttons & 4) === 4

  if (middle) return "pan"

  if (input.button !== 0) return "ignore"

  if (input.spaceHeld && input.spaceAllowed) return "pan"

  if (input.onControls) return "ignore"

  if (input.onHandle) return "move"

  if (input.onEmpty) return "pan"
  return "ignore"
}

export function canScrollBox(box: ScrollBox, axis: "x" | "y", delta: number): boolean {
  if (delta === 0) return false

  if (axis === "y") {
    if (!SCROLLABLE.has(box.overflowY)) return false

    if (box.scrollHeight <= box.clientHeight + 1) return false

    if (delta > 0) return box.scrollTop + box.clientHeight < box.scrollHeight - 1
    return box.scrollTop > 0
  }

  if (!SCROLLABLE.has(box.overflowX)) return false

  if (box.scrollWidth <= box.clientWidth + 1) return false

  if (delta > 0) return box.scrollLeft + box.clientWidth < box.scrollWidth - 1
  return box.scrollLeft > 0
}

export function wheelIntent(input: {
  ctrlKey: boolean
  metaKey: boolean
  deltaX: number
  deltaY: number
  canScrollX: boolean
  canScrollY: boolean
}): WheelIntent {
  if (input.ctrlKey || input.metaKey) return "zoom"

  if (input.canScrollX || input.canScrollY) return "native"

  if (input.deltaX !== 0 || input.deltaY !== 0) return "pan"
  return "native"
}

export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const line = 16
  const page = 400
  const pixels = deltaMode === 1 ? deltaY * line : deltaMode === 2 ? deltaY * page : deltaY
  return Math.exp(-pixels * 0.0015)
}
