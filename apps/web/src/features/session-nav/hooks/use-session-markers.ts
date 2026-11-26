import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { sessionRecency } from "@features/session-nav/lib/format.js"
import { isDraftSessionId, moveSessionId } from "@features/session-nav/lib/session-list.js"
import { readJson, readNumber, readStringArray, writeJson, writeNumber } from "@utils/storage.js"

const PINNED_KEY = "pig.sidebarPinnedSessions"
const SETTLED_KEY = "pig.sidebarSettledSessions"
const READ_AT_KEY = "pig.sidebarReadAt"
const EPOCH_KEY = "pig.sidebarEpoch"

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
  const shownIds = () => {
    const value = toValue(activeSessionId)
    return value ? [value] : []
  }
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
    if (pinnedIds.value.has(id)) {
      pinnedIdList.value = pinnedIdList.value.filter((item) => item !== id)
      writeJson(PINNED_KEY, pinnedIdList.value)
      return
    }

    unsettle(id)
    pinnedIdList.value = [...pinnedIdList.value, id]
    writeJson(PINNED_KEY, pinnedIdList.value)
  }

  function reorderPinned(id: string, toIndex: number): void {
    if (!pinnedIds.value.has(id)) return
    pinnedIdList.value = moveSessionId(pinnedIdList.value, id, toIndex)
    writeJson(PINNED_KEY, pinnedIdList.value)
  }

  function pinAt(id: string, toIndex: number): void {
    unsettle(id)
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

    if (shownIds().includes(session.id)) return false
    return sessionRecency(session) > (readAtById.value[session.id] ?? epoch)
  }

  watch(
    [shownIds, () => toValue(sessions)],
    ([ids, currentSessions]) => {
      let next = readAtById.value

      for (const sessionId of ids) {
        const session = currentSessions.find((item) => item.id === sessionId)

        if (!session || next[sessionId] === sessionRecency(session)) continue
        next = { ...next, [sessionId]: sessionRecency(session) }
      }

      if (next === readAtById.value) return
      readAtById.value = next
      writeJson(READ_AT_KEY, next)
    },
    { immediate: true },
  )

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
