export const SESSION_DROP_EVENT = "pig-session-drop"
const TARGET_ATTR = "data-session-drop"
const OVER_ATTR = "data-session-drop-over"
const DRAGGING_ATTR = "data-session-dragging"

export interface DroppedSession {
  id: string
  title: string
}

export const sessionDropTargetAttrs = { [TARGET_ATTR]: "" } as const
let over: HTMLElement | null = null

export function sessionDropTargetAt(point: { x: number; y: number }): HTMLElement | null {
  return (
    document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>(`[${TARGET_ATTR}]`) ?? null
  )
}

export function markSessionDropTarget(target: HTMLElement | null): void {
  if (target === over) return
  over?.removeAttribute(OVER_ATTR)
  target?.setAttribute(OVER_ATTR, "")
  over = target
}

export function dropSessions(target: HTMLElement, sessions: readonly DroppedSession[]): void {
  target.dispatchEvent(new CustomEvent(SESSION_DROP_EVENT, { detail: sessions }))
}

export function markSessionDragging(on: boolean): void {
  document.documentElement.toggleAttribute(DRAGGING_ATTR, on)
}
