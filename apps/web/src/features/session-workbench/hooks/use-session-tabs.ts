import { computed, shallowRef, watch, type ComputedRef, type Ref } from "vue"
import { readStringArray, writeJson } from "@utils/storage.js"
import {
  moveSessionTab,
  openSessionTab,
  sessionTabAfterClose,
  sessionTabAfterCloseMany,
  sessionTabsInCloseScope,
  type SessionTab,
} from "@features/session-workbench/lib/session-tabs.js"

const TABS_KEY = "pig.openSessionTabs"

export interface SessionTabSource {
  id: string
  title: string
}

export function useSessionTabs(input: {
  activeSessionId: Ref<string | undefined>
  sessions: ComputedRef<readonly SessionTabSource[]>
  open: (id: string) => void
}) {
  const ids = shallowRef(readStringArray(TABS_KEY))
  const tabs = computed<SessionTab[]>(() => {
    const byId = new Map(input.sessions.value.map((session) => [session.id, session]))
    return ids.value.flatMap((id) => {
      const session = byId.get(id)
      return session ? [{ id, title: session.title }] : []
    })
  })

  function commit(next: string[]): void {
    ids.value = next
    writeJson(TABS_KEY, next)
  }

  function openTab(id: string): void {
    commit(openSessionTab(ids.value, id))
  }

  function moveTab(draggedId: string, overId?: string): void {
    const next = moveSessionTab(ids.value, draggedId, overId)

    // 边界处反复悬停会算出同一顺序，不提交以避免多余重排
    if (next.join("\n") !== ids.value.join("\n")) commit(next)
  }

  function closeTabs(closedIds: readonly string[], anchorId: string): void {
    const nextActive = sessionTabAfterCloseMany(ids.value, closedIds, anchorId)
    const closingActive = closedIds.includes(input.activeSessionId.value ?? "")

    commit(ids.value.filter((id) => !closedIds.includes(id)))

    if (closingActive && nextActive) input.open(nextActive)
  }

  function closeTab(id: string): void {
    const nextActive = sessionTabAfterClose(ids.value, id)
    const closingActive = id === input.activeSessionId.value

    commit(ids.value.filter((item) => item !== id))

    if (closingActive && nextActive) input.open(nextActive)
  }

  function closeScope(anchorId: string, scope: "left" | "right" | "others"): void {
    closeTabs(sessionTabsInCloseScope(ids.value, anchorId, scope), anchorId)
  }

  watch(
    input.activeSessionId,
    (sessionId) => {
      if (sessionId) openTab(sessionId)
    },
    { immediate: true },
  )

  watch(
    () => input.sessions.value.map((session) => session.id).join("\n"),
    () => {
      // 列表未就绪或断开时不清持久化标签，只过滤确定存在的集合
      if (input.sessions.value.length === 0) return
      const known = new Set(input.sessions.value.map((session) => session.id))
      const next = ids.value.filter((id) => known.has(id))

      if (next.length !== ids.value.length) commit(next)
    },
  )
  return { tabs, openTab, moveTab, closeTab, closeScope }
}
