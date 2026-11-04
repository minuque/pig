import { computed, inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import { useRouter } from "vue-router"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { SessionContext } from "@features/session-workbench/index.js"
import { useSessionCards } from "@features/session-nav/hooks/use-session-cards.js"
import { useSessionMarkers } from "@features/session-nav/hooks/use-session-markers.js"
import { useSessionOpen } from "@features/session-nav/hooks/use-session-open.js"
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js"
import {
  conversationItemCount,
  sessionCardFoot,
  sessionOutcome,
} from "@features/session-nav/lib/session-list.js"
import type { SidebarPlacement, SidebarSessionState } from "@features/session-nav/type.js"

export { sessionTitle, workspaceName, untitledSession } from "@features/session-nav/lib/format.js"

export type NavContext = ReturnType<typeof createNav>

export const navKey: InjectionKey<NavContext> = Symbol("nav")

function createNav(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: SessionContext,
) {
  const router = useRouter()
  const {
    highlightedSessionId: baseHighlightedSessionId,
    openSession: baseOpenSession,
    cancelPendingOpen,
    primeSession,
  } = useSessionOpen(session.sessionId, router, session.loadHistory)
  const navError = shallowRef("")
  const cards = useSessionCards(pi.connected)
  const activeSessionRunning = computed(() => session.projection.value?.running ?? false)
  const nav = useWorkspaceNav(pi.sessions, cwd, navError, {
    sessionId: session.sessionId,
    running: activeSessionRunning,
    router,
    refreshSessions: pi.refreshSessions,
  })
  const markers = useSessionMarkers(nav.listedSessions, session.sessionId)
  const highlightedSessionId = computed(
    () => baseHighlightedSessionId.value ?? nav.draftSessionId.value,
  )
  const cardFootById = computed(() => {
    const liveId = session.sessionId.value
    const liveOutcome = sessionOutcome(session.transcript.value)
    const live =
      liveId && session.projection.value
        ? {
            sessionId: liveId,
            messageCount: conversationItemCount(session.transcript.value),
            model: session.projection.value.model,
            ...(liveOutcome ? { outcome: liveOutcome } : {}),
          }
        : undefined
    const extras = cards.sessionCards.value
    const feet = new Map<
      string,
      {
        messageCount: number | undefined
        model: { provider: string; id: string } | undefined
        state: SidebarSessionState | undefined
      }
    >()

    for (const item of nav.listedSessions.value) {
      const foot = sessionCardFoot(item.id, extras, live)
      const isRunning =
        (liveId === item.id && activeSessionRunning.value) ||
        session.backgroundRunningIds.value.has(item.id)
      const state: SidebarSessionState | undefined = isRunning
        ? "running"
        : foot.outcome === "error"
          ? "error"
          : markers.isUnread(item)
            ? "unread"
            : undefined

      feet.set(item.id, { ...foot, state })
    }

    return feet
  })
  /** 分段只看这两件事：在跑、已归档。 */
  const placements = computed(() => {
    const map = new Map<string, SidebarPlacement>()

    for (const item of nav.listedSessions.value) {
      map.set(item.id, {
        running: cardFootById.value.get(item.id)?.state === "running",
        settled: markers.settledIds.value.has(item.id),
      })
    }

    return map
  })

  function placementOf(id: string): SidebarPlacement {
    return placements.value.get(id) ?? { running: false, settled: false }
  }

  /** 每个在跑的会话从什么时候开始跑：本地记，协议列表不带开始时间。 */
  const runningSince = shallowRef<Record<string, number>>({})
  const runningIds = computed(
    () =>
      new Set(
        [...cardFootById.value].filter(([, foot]) => foot.state === "running").map(([id]) => id),
      ),
  )

  watch(
    runningIds,
    (ids) => {
      const next: Record<string, number> = {}
      const previous = runningSince.value
      const now = Date.now()

      for (const id of ids) next[id] = previous[id] ?? now
      runningSince.value = next
    },
    { immediate: true },
  )

  /** 页签全部关掉后回欢迎页。 */
  function closeSession(): void {
    cancelPendingOpen()
    void router.replace("/")
  }

  return {
    groups: nav.groups,
    listedSessions: nav.listedSessions,
    cardFootById,
    revealMore: nav.revealMore,
    collapseGroup: nav.collapseGroup,
    sectionsFor: (include?: Parameters<typeof nav.sectionsFor>[2]) =>
      nav.sectionsFor(markers.pinnedOrder, placementOf, include),
    sort: nav.sort,
    setSort: nav.setSort,
    moreBySection: nav.moreBySection,
    runningSince,
    settledIds: markers.settledIds,
    settle: markers.settle,
    unsettle: markers.unsettle,
    expandedSections: nav.expandedSections,
    toggleSection: nav.toggleSection,
    pinnedIds: markers.pinnedIds,
    pinnedSessions: markers.pinnedSessions,
    togglePinned: markers.togglePinned,
    reorderPinned: markers.reorderPinned,
    pinAt: markers.pinAt,
    addingWorkspace: nav.addingWorkspace,
    connected: pi.connected,
    navError,
    lastCwd: cwd.lastCwd,
    activeWorkspaceId: computed(() => session.projection.value?.cwd),
    highlightedSessionId,
    openSession: baseOpenSession,
    primeSession,
    closeSession,
    cancelPendingOpen,
    setDraftSession: nav.setDraftSession,
    addWorkspace: nav.addWorkspace,
    renameSession: nav.renameSession,
    deleteSession: nav.deleteSession,
  }
}

export function provideNav(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: SessionContext,
) {
  const nav = createNav(pi, cwd, session)
  provide(navKey, nav)
  return nav
}

export function useNav(): NavContext {
  const nav = inject(navKey)

  if (!nav) throw new Error("useNav() 需要在 provideNav() 之后调用")
  return nav
}
