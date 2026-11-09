/** 打开会话时直接挂载内容的末尾回合数；更早的滚到附近再挂。 */
export const EAGER_TURNS = 3
const MAX_SESSIONS = 10
const bySession = new Map<string, Set<string>>()

/** 某会话里已挂载过内容的回合；切回时照原样挂载，版面与离开时一致。 */
export function shownTurnsOf(sessionId: string): Set<string> {
  const known = bySession.get(sessionId)
  bySession.delete(sessionId)
  const turns = known ?? new Set<string>()
  bySession.set(sessionId, turns)

  for (const key of bySession.keys()) {
    if (bySession.size <= MAX_SESSIONS) break
    bySession.delete(key)
  }

  return turns
}
