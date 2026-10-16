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
  /** 路由上正在显示的会话。高亮可能停在还没落地的页签上，关闭以路由为准。 */
  routeSessionId: Ref<string | undefined>
  sessions: ComputedRef<readonly SessionTabSource[]>
  open: (id: string) => void
  /** 一个不剩时回欢迎页。 */
  close: () => void
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

    commit(ids.value.filter((id) => !closedIds.includes(id)))
    settleAfterClose(nextActive)
  }

  function closeTab(id: string): void {
    const nextActive = sessionTabAfterClose(ids.value, id)

    commit(ids.value.filter((item) => item !== id))
    settleAfterClose(nextActive)
  }

  /** 路由还停在已打开的页签上就不动。否则打开下一个；一个不剩就回欢迎页。 */
  function settleAfterClose(nextActive: string | undefined): void {
    const route = input.routeSessionId.value

    if (route && ids.value.includes(route)) return

    const next = nextActive && ids.value.includes(nextActive) ? nextActive : ids.value[0]

    if (next) input.open(next)
    else input.close()
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
  return { tabs, moveTab, closeTab, closeScope }
}
