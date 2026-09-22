import type { SessionMetadata } from "@/types/common-type.js"

/** 取路径最后一段作为展示名；路径为空或仅分隔符时原样返回。 */
export function workspaceName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/** 未命名 Session 的列表/标题回退文案。 */
export const UNTITLED_SESSION = "新会话"

/** 列表标题：Pi sessionName，否则「新会话」。 */
export function sessionTitle(session: Pick<SessionMetadata, "sessionName">): string {
  const name = session.sessionName?.trim()
  return name || UNTITLED_SESSION
}

/** 最近活动时刻：优先 updatedAt。 */
export function sessionRecency(session: Pick<SessionMetadata, "createdAt" | "updatedAt">): number {
  return session.updatedAt ?? session.createdAt
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 侧栏相对时间：刚刚，否则四舍五入到分钟、小时、天、周、月、年。 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ""
  const delta = Math.max(0, now - timestamp)

  if (delta < MINUTE) return "刚刚"

  if (delta < HOUR) return `${Math.round(delta / MINUTE)}m`

  if (delta < DAY) return `${Math.round(delta / HOUR)}h`
  const days = delta / DAY

  if (days < 7) return `${Math.round(days)}d`

  if (days < 30) return `${Math.round(days / 7)}w`

  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}
