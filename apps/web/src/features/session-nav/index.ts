import { computed, inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import { useDebounceFn } from "@vueuse/core"
import { useRouter } from "vue-router"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { SessionContext } from "@features/session-workbench/index.js"
import { useSessionCards } from "@features/session-nav/hooks/use-session-cards.js"
import { useSessionMarkers } from "@features/session-nav/hooks/use-session-markers.js"
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js"
import {
  conversationItemCount,
  sessionCardFoot,
  sessionOutcome,
} from "@features/session-nav/lib/session-list.js"
import type { SidebarSessionState } from "@features/session-nav/type.js"

export { sessionTitle, workspaceName, UNTITLED_SESSION } from "@features/session-nav/lib/format.js"

export type NavContext = ReturnType<typeof createNav>
export const navKey: InjectionKey<NavContext> = Symbol("nav")

const SESSION_OPEN_DEBOUNCE_MS = 180

function createNav(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: SessionContext,
) {
  const router = useRouter()
  const pendingSessionId = shallowRef<string>()
  const highlightedSessionId = computed(() => pendingSessionId.value ?? session.sessionId.value)
  const pushSession = useDebounceFn((id: string) => {
    void router.push({ name: "session", params: { sessionId: id } })
  }, SESSION_OPEN_DEBOUNCE_MS)

  function openSession(id: string) {
    if (id === session.sessionId.value) {
      cancelPendingOpen()
      return
    }
    pendingSessionId.value = id
    void pushSession(id)
  }

  function cancelPendingOpen() {
    pushSession.cancel()
    pendingSessionId.value = undefined
  }

  watch(session.sessionId, (id) => {
    if (id === pendingSessionId.value) {
      pendingSessionId.value = undefined
      return
    }
    if (pendingSessionId.value) cancelPendingOpen()
  })

  const navError = shallowRef("")
  const cards = useSessionCards(pi.connected, pi.sessions, session.sessionId)
  const nav = useWorkspaceNav(
    pi.sessions,
    cwd,
    navError,
    {
      sessionId: session.sessionId,
      router,
      refreshSessions: pi.refreshSessions,
    },
    cards.loadSessionCards,
  )
  const markers = useSessionMarkers(nav.listedSessions, session.sessionId)

  const activeSessionRunning = computed(() => session.projection.value?.running ?? false)
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
        state: SidebarSessionState | undefined
      }
    >()
    for (const item of nav.listedSessions.value) {
      const foot = sessionCardFoot(item.id, extras, live)
      const state: SidebarSessionState | undefined =
        liveId === item.id && activeSessionRunning.value
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

  return {
    groups: nav.groups,
    workspaces: nav.workspaces,
    listedSessions: nav.listedSessions,
    cardFootById,
    grouping: nav.grouping,
    setGrouping: nav.setGrouping,
    bumpGroup: nav.bumpGroup,
    toggleGroup: nav.toggleGroup,
    rowsFor: (searching: Parameters<typeof nav.rowsFor>[0]) =>
      nav.rowsFor(searching, markers.pinnedIds),
    pinnedIds: markers.pinnedIds,
    pinnedSessions: markers.pinnedSessions,
    togglePinned: markers.togglePinned,
    addingWorkspace: nav.addingWorkspace,
    navError,
    lastCwd: cwd.lastCwd,
    activeWorkspaceId: computed(() => session.projection.value?.cwd),
    activeSessionId: session.sessionId,
    highlightedSessionId,
    openSession,
    cancelPendingOpen,
    activeSessionRunning,
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
