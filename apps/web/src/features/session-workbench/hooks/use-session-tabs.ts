import { computed, shallowRef, watch, type ComputedRef, type Ref } from "vue"
import {
  moveSessionTab,
  openSessionTab,
  sessionTabAfterClose,
  sessionTabAfterCloseMany,
  sessionTabsInCloseScope,
  type SessionTab,
} from "@features/session-workbench/lib/session-tabs.js"

const TABS_KEY = "pig.openSessionTabs"

function loadTabs(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(TABS_KEY) ?? "[]")
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

function saveTabs(ids: readonly string[]): void {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(ids))
  } catch {
    /* 存储不可用时标签仅存活于本页 */
  }
}

export interface SessionTabSource {
  id: string
  title: string
}

export function useSessionTabs(input: {
  activeSessionId: Ref<string | undefined>
  sessions: ComputedRef<readonly SessionTabSource[]>
  open: (id: string) => void
}) {
  const ids = shallowRef(loadTabs())
  const tabs = computed<SessionTab[]>(() => {
    const byId = new Map(input.sessions.value.map((session) => [session.id, session]))
    return ids.value.flatMap((id) => {
      const session = byId.get(id)
      return session ? [{ id, title: session.title }] : []
    })
  })

  function commit(next: string[]): void {
    ids.value = next
    saveTabs(next)
  }

  function openTab(id: string): void {
    commit(openSessionTab(ids.value, id))
  }

  function moveTab(draggedId: string, overId: string): void {
    commit(moveSessionTab(ids.value, draggedId, overId))
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
      const known = new Set(input.sessions.value.map((session) => session.id))
      const next = ids.value.filter((id) => known.has(id))

      if (next.length !== ids.value.length) commit(next)
    },
  )
  return { tabs, openTab, moveTab, closeTab, closeScope }
}
