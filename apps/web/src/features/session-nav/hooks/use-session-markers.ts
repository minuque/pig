import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { sessionRecency } from "@features/session-nav/lib/format.js"
import { isDraftSessionId, moveSessionId } from "@features/session-nav/lib/session-list.js"
import { readJson, readNumber, readStringArray, writeJson, writeNumber } from "@utils/storage.js"

const PINNED_KEY = "pig.sidebarPinnedSessions"
const SETTLED_KEY = "pig.sidebarSettledSessions"
const READ_AT_KEY = "pig.sidebarReadAt"
const EPOCH_KEY = "pig.sidebarEpoch"

/** 未读起算点只写一次：首次装上侧栏标记的那一刻，重启不重算。 */
function readEpoch(): number {
  const stored = readNumber(EPOCH_KEY)

  if (stored !== undefined) return stored
  const now = Date.now()
  writeNumber(EPOCH_KEY, now)
  return now
}

export function useSessionMarkers(
  sessions: MaybeRefOrGetter<readonly SessionMetadata[]>,
  activeSessionId: MaybeRefOrGetter<string | undefined>,
) {
  const pinnedIdList = shallowRef(readStringArray(PINNED_KEY))
  const settledIdList = shallowRef(readStringArray(SETTLED_KEY))
  const readAtById = shallowRef<Record<string, number>>(
    readJson<Record<string, number>>(READ_AT_KEY) ?? {},
  )
  const epoch = readEpoch()
  const pinnedIds = computed(() => new Set(pinnedIdList.value))
  const settledIds = computed(() => new Set(settledIdList.value))
  const pinnedSessions = computed(() =>
    toValue(sessions).filter((session) => pinnedIds.value.has(session.id)),
  )

  function togglePinned(id: string): void {
    pinnedIdList.value = pinnedIds.value.has(id)
      ? pinnedIdList.value.filter((item) => item !== id)
      : [...pinnedIdList.value, id]
    writeJson(PINNED_KEY, pinnedIdList.value)
  }

  function reorderPinned(id: string, toIndex: number): void {
    if (!pinnedIds.value.has(id)) return
    pinnedIdList.value = moveSessionId(pinnedIdList.value, id, toIndex)
    writeJson(PINNED_KEY, pinnedIdList.value)
  }

  /** 拖进置顶区：不在名单里的会话插到 slot。 */
  function pinAt(id: string, toIndex: number): void {
    pinnedIdList.value = moveSessionId(pinnedIdList.value, id, toIndex)
    writeJson(PINNED_KEY, pinnedIdList.value)
  }

  function settle(id: string): void {
    if (settledIds.value.has(id)) return
    settledIdList.value = [...settledIdList.value, id]
    writeJson(SETTLED_KEY, settledIdList.value)
    pinnedIdList.value = pinnedIdList.value.filter((item) => item !== id)
    writeJson(PINNED_KEY, pinnedIdList.value)
  }

  function unsettle(id: string): void {
    if (!settledIds.value.has(id)) return
    settledIdList.value = settledIdList.value.filter((item) => item !== id)
    writeJson(SETTLED_KEY, settledIdList.value)
  }

  function isUnread(session: SessionMetadata): boolean {
    if (isDraftSessionId(session.id)) return false

    if (session.id === toValue(activeSessionId)) return false
    return sessionRecency(session) > (readAtById.value[session.id] ?? epoch)
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
      writeJson(READ_AT_KEY, readAtById.value)
    },
    { immediate: true },
  )

  // 会话删掉后清掉残留，免得同一 id 复用时带着旧状态回来
  watch(
    () => toValue(sessions),
    (list) => {
      const ids = new Set(list.map((session) => session.id))
      const nextSettled = settledIdList.value.filter((id) => ids.has(id))

      if (nextSettled.length !== settledIdList.value.length) {
        settledIdList.value = nextSettled
        writeJson(SETTLED_KEY, nextSettled)
      }
    },
  )
  return {
    pinnedIds,
    pinnedOrder: computed(() => pinnedIdList.value),
    pinnedSessions,
    togglePinned,
    reorderPinned,
    pinAt,
    settledIds,
    isUnread,
    settle,
    unsettle,
  }
}
