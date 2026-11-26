export type Side = "left" | "right"

export const PANE_VIEWS = ["chat", "files"] as const

export type PaneView = (typeof PANE_VIEWS)[number]

export interface SplitState {
  left: string | undefined
  right: string | undefined
  split: boolean
  focused: Side
  ratio: number
  views: Record<Side, PaneView>
}

export const SPLIT_CHAT_MIN = 480
const RATIO_MIN = 0.2
const RATIO_MAX = 0.8
export const emptySplit: SplitState = {
  left: undefined,
  right: undefined,
  split: false,
  focused: "left",
  ratio: 0.5,
  views: { left: "chat", right: "chat" },
}
const other = (side: Side): Side => (side === "left" ? "right" : "left")

export function sideShowing(state: SplitState, id: string | undefined): Side | undefined {
  if (!id) return undefined

  if (state.left === id) return "left"
  return state.split && state.right === id ? "right" : undefined
}

export function focusSide(state: SplitState, side: Side): SplitState {
  if (state.focused === side || (side === "right" && !state.split)) return state
  return { ...state, focused: side }
}

export function openInFocused(state: SplitState, id: string | undefined): SplitState {
  const shown = sideShowing(state, id)

  if (shown) return focusSide(state, shown)

  if (state[state.focused] === id) return state
  const next = { ...state, [state.focused]: id }
  return id ? next : setView(next, state.focused, "chat")
}

export function openToSide(state: SplitState, id: string | undefined): SplitState {
  const shown = sideShowing(state, id)

  if (shown) return focusSide(state, shown)

  const target = state.split ? other(state.focused) : "right"
  const next = { ...state, [target]: id, split: true, focused: target }
  return id ? next : setView(next, target, "chat")
}

export function leaveSession(state: SplitState, id: string): SplitState {
  const side = sideShowing(state, id)
  return side ? setView({ ...state, [side]: undefined }, side, "chat") : state
}

export function newOnRight(state: SplitState): SplitState {
  return setView({ ...state, split: true, right: undefined, focused: "right" }, "right", "chat")
}

export function closeSide(state: SplitState, side: Side): SplitState {
  if (!state.split) return state
  const keptSide = other(side)
  return {
    ...state,
    left: state[keptSide],
    right: undefined,
    split: false,
    focused: "left",
    views: { left: state.views[keptSide], right: "chat" },
  }
}

export function setView(state: SplitState, side: Side, view: PaneView): SplitState {
  if (state.views[side] === view) return state
  return { ...state, views: { ...state.views, [side]: view } }
}

export function stepView(state: SplitState, side: Side, delta: number): SplitState {
  const index = PANE_VIEWS.indexOf(state.views[side]) + delta
  const view = PANE_VIEWS[Math.min(PANE_VIEWS.length - 1, Math.max(0, index))]
  return view ? setView(state, side, view) : state
}

export function setRatio(state: SplitState, ratio: number, width?: number): SplitState {
  const floor = width && fitsSplit(width) ? SPLIT_CHAT_MIN / width : RATIO_MIN
  const min = Math.max(RATIO_MIN, floor)
  const max = Math.min(RATIO_MAX, 1 - floor)
  return { ...state, ratio: Math.min(max, Math.max(min, ratio)) }
}

export function fitsSplit(width: number): boolean {
  return width >= SPLIT_CHAT_MIN * 2
}

export function serializeSplit(state: SplitState): string {
  return JSON.stringify(state)
}

const optionalId = (value: unknown) => (typeof value === "string" && value ? value : undefined)
const paneView = (value: unknown): PaneView => PANE_VIEWS.find((view) => view === value) ?? "chat"

export function parseSplit(raw: string | undefined): SplitState {
  try {
    const value = JSON.parse(raw ?? "") as Partial<Record<keyof SplitState, unknown>>

    if (
      typeof value.split !== "boolean" ||
      (value.focused !== "left" && value.focused !== "right") ||
      typeof value.ratio !== "number"
    )
      return emptySplit

    const views = (value.views ?? {}) as Partial<Record<Side, unknown>>
    const state: SplitState = {
      left: optionalId(value.left),
      right: value.split ? optionalId(value.right) : undefined,
      split: value.split,
      focused: value.split ? value.focused : "left",
      ratio: value.ratio,
      views: { left: paneView(views.left), right: value.split ? paneView(views.right) : "chat" },
    }
    return setRatio(state, state.ratio)
  } catch {
    return emptySplit
  }
}
