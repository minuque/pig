export const PANE_VIEWS = ["chat", "files"] as const

export type PaneView = (typeof PANE_VIEWS)[number]

export function stepView(view: PaneView, delta: number): PaneView {
  const index = Math.min(PANE_VIEWS.length - 1, Math.max(0, PANE_VIEWS.indexOf(view) + delta))
  return PANE_VIEWS[index] ?? view
}
