/** 侧栏会话拖出列表、落到别处时派发的事件；detail 是被拖的会话。 */
export const SESSION_DROP_EVENT = "pig-session-drop"
const TARGET_ATTR = "data-session-drop"
const OVER_ATTR = "data-session-drop-over"

export interface DroppedSession {
  id: string
  title: string
}

/** 绑到能接会话的元素上。 */
export const sessionDropTargetAttrs = { [TARGET_ATTR]: "" } as const
let over: HTMLElement | null = null

export function sessionDropTargetAt(point: { x: number; y: number }): HTMLElement | null {
  return (
    document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>(`[${TARGET_ATTR}]`) ?? null
  )
}

/** 指针下的落点打上 over 标记，供落点自己画高亮；传 null 清掉。 */
export function markSessionDropTarget(target: HTMLElement | null): void {
  if (target === over) return
  over?.removeAttribute(OVER_ATTR)
  target?.setAttribute(OVER_ATTR, "")
  over = target
}

export function dropSessions(target: HTMLElement, sessions: readonly DroppedSession[]): void {
  target.dispatchEvent(new CustomEvent(SESSION_DROP_EVENT, { detail: sessions }))
}
