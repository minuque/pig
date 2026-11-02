import type {
  SidebarRowFoot,
  SidebarSession,
  SidebarSessionState,
  SidebarStateGlyph,
} from "@features/session-nav/type.js"

/** 页脚只统计这三个状态；错误态留在行内，不进页脚。 */
export type FooterStatus = "running" | "unread" | "draft"

export const FOOTER_STATUSES: readonly FooterStatus[] = ["running", "unread", "draft"]

/** 行内图标与页脚统计共用一条优先级：运行中 > 未读 > 草稿 > 错误。 */
export function sessionGlyph(
  session: Pick<SidebarSession, "draft">,
  state: SidebarSessionState | undefined,
): SidebarStateGlyph | undefined {
  if (state === "running") return "running"

  if (state === "unread") return "unread"

  if (session.draft) return "draft"

  if (state === "error") return "error"
  return undefined
}

/** 按页脚状态分桶，保持传入顺序。 */
export function statusBuckets(
  sessions: readonly SidebarSession[],
  footById: ReadonlyMap<string, Pick<SidebarRowFoot, "state">>,
): Record<FooterStatus, SidebarSession[]> {
  const buckets: Record<FooterStatus, SidebarSession[]> = { running: [], unread: [], draft: [] }

  for (const session of sessions) {
    const glyph = sessionGlyph(session, footById.get(session.id)?.state)

    if (glyph === "running" || glyph === "unread" || glyph === "draft") buckets[glyph].push(session)
  }

  return buckets
}

/** 轮换到下一个；当前不在池里就从第一个开始。 */
export function nextInCycle<T extends { id: string }>(
  items: readonly T[],
  currentId?: string,
): T | undefined {
  if (items.length === 0) return undefined
  const index = items.findIndex((item) => item.id === currentId)
  return items[(index + 1) % items.length]
}
