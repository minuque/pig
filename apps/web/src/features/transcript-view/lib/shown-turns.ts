export const EAGER_TURNS = 3
const MAX_SESSIONS = 10
const bySession = new Map<string, Set<string>>()

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
