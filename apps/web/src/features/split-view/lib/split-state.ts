export type Side = "left" | "right"

/** 两侧各显示的会话；undefined 是新会话页。未分屏时只有 left。 */
export interface SplitState {
  left: string | undefined
  right: string | undefined
  split: boolean
  focused: Side
  /** 左侧占主区的比例。 */
  ratio: number
}

/** 分屏时每侧对话的最小宽度。 */
export const SPLIT_CHAT_MIN = 480
const RATIO_MIN = 0.2
const RATIO_MAX = 0.8
export const emptySplit: SplitState = {
  left: undefined,
  right: undefined,
  split: false,
  focused: "left",
  ratio: 0.5,
}
const other = (side: Side): Side => (side === "left" ? "right" : "left")

/** 显示该会话的一侧；同一会话只在一侧出现。 */
export function sideShowing(state: SplitState, id: string | undefined): Side | undefined {
  if (!id) return undefined

  if (state.left === id) return "left"
  return state.split && state.right === id ? "right" : undefined
}

export function focusSide(state: SplitState, side: Side): SplitState {
  if (state.focused === side || (side === "right" && !state.split)) return state
  return { ...state, focused: side }
}

/** 在聚焦的一侧打开；已在另一侧就只改聚焦。 */
export function openInFocused(state: SplitState, id: string | undefined): SplitState {
  const shown = sideShowing(state, id)

  if (shown) return focusSide(state, shown)

  if (state[state.focused] === id) return state
  return { ...state, [state.focused]: id }
}

/** 在另一侧打开：未分屏时开出右侧；已在某侧就只改聚焦。 */
export function openToSide(state: SplitState, id: string | undefined): SplitState {
  const shown = sideShowing(state, id)

  if (shown) return focusSide(state, shown)

  if (!state.split) return { ...state, split: true, right: id, focused: "right" }
  const target = other(state.focused)
  return { ...state, [target]: id, focused: target }
}

/** 关闭一侧：留下的一侧成为唯一的左侧。 */
export function closeSide(state: SplitState, side: Side): SplitState {
  if (!state.split) return state
  const kept = side === "left" ? state.right : state.left
  return { ...state, left: kept, right: undefined, split: false, focused: "left" }
}

export function setRatio(state: SplitState, ratio: number): SplitState {
  return { ...state, ratio: Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio)) }
}

export function fitsSplit(width: number): boolean {
  return width >= SPLIT_CHAT_MIN * 2
}

export function serializeSplit(state: SplitState): string {
  return JSON.stringify(state)
}

const optionalId = (value: unknown) => (typeof value === "string" && value ? value : undefined)

export function parseSplit(raw: string | undefined): SplitState {
  try {
    const value = JSON.parse(raw ?? "") as Partial<Record<keyof SplitState, unknown>>

    if (
      typeof value.split !== "boolean" ||
      (value.focused !== "left" && value.focused !== "right") ||
      typeof value.ratio !== "number"
    )
      return emptySplit

    const state: SplitState = {
      left: optionalId(value.left),
      right: value.split ? optionalId(value.right) : undefined,
      split: value.split,
      focused: value.split ? value.focused : "left",
      ratio: value.ratio,
    }
    return setRatio(state, state.ratio)
  } catch {
    return emptySplit
  }
}
