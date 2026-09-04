import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { sessionRecency } from "@features/session-nav/lib/format.js"

const PINNED_KEY = "pig.sidebarPinnedSessions"

function loadStringArray(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 存储不可用时偏好仅存活于本页 */
  }
}

export function useSessionMarkers(
  sessions: MaybeRefOrGetter<readonly SessionMetadata[]>,
  activeSessionId: MaybeRefOrGetter<string | undefined>,
) {
  const pinnedIdList = shallowRef(loadStringArray(PINNED_KEY))
  // 未读只活在本次运行：启动前完成的不算，关应用即丢
  const runStartAt = Date.now()
  const readAtById = shallowRef<Record<string, number>>({})
  const pinnedIds = computed(() => new Set(pinnedIdList.value))
  const pinnedSessions = computed(() =>
    toValue(sessions).filter((session) => pinnedIds.value.has(session.id)),
  )

  function togglePinned(id: string): void {
    pinnedIdList.value = pinnedIds.value.has(id)
      ? pinnedIdList.value.filter((item) => item !== id)
      : [...pinnedIdList.value, id]
    save(PINNED_KEY, pinnedIdList.value)
  }

  function isUnread(session: SessionMetadata): boolean {
    if (session.id === toValue(activeSessionId)) return false
    return sessionRecency(session) > (readAtById.value[session.id] ?? runStartAt)
  }

  watch(
    [() => toValue(activeSessionId), () => toValue(sessions)],
    ([sessionId, currentSessions]) => {
      if (!sessionId) return
      const session = currentSessions.find((item) => item.id === sessionId)
      if (!session) return
      const readAt = sessionRecency(session)
      if (readAtById.value[sessionId] === readAt) return
      readAtById.value = { ...readAtById.value, [sessionId]: readAt }
    },
    { immediate: true },
  )

  return { pinnedIds, pinnedSessions, togglePinned, isUnread }
}
