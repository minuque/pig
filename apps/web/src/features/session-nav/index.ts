import { computed, inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import { useRouter } from "vue-router"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { useGatewayClient } from "@client/gateway-connection.js"
import type { FocusedSession } from "@features/split-view/index.js"
import type { ArchiveProjectView } from "@features/settings/index.js"
import { useProjectPrefs } from "@features/session-nav/hooks/use-project-prefs.js"
import { useSessionCards } from "@features/session-nav/hooks/use-session-cards.js"
import { useSessionMarkers } from "@features/session-nav/hooks/use-session-markers.js"
import { useSessionOpen } from "@features/session-nav/hooks/use-session-open.js"
import { useRevealNewSessions } from "@features/session-nav/hooks/use-reveal-new-sessions.js"
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js"
import { projectMonogram, sessionRecency, workspaceName } from "@features/session-nav/lib/format.js"
import { projectIconColorOf, projectIconTone } from "@features/session-nav/lib/project-prefs.js"
import {
  conversationItemCount,
  sessionCardFoot,
  sessionOutcome,
} from "@features/session-nav/lib/session-list.js"
import { sessionTitle } from "@features/session/index.js"
import type {
  SidebarPlacement,
  SidebarRowFoot,
  SidebarSessionState,
} from "@features/session-nav/type.js"

export { workspaceName } from "@features/session-nav/lib/format.js"

export {
  SESSION_DROP_EVENT,
  sessionDropTargetAttrs,
  type DroppedSession,
} from "@features/session-nav/lib/context-drag.js"

export type NavContext = ReturnType<typeof createNav>

export const navKey: InjectionKey<NavContext> = Symbol("nav")

function createNav(
  pi: ReturnType<typeof useGatewayClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: FocusedSession,
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
    shownIds: session.shownIds,
    isRunning: (id) =>
      (session.sessionId.value === id && activeSessionRunning.value) ||
      session.backgroundRunningIds.value.has(id),
    leave: session.leave,
    refreshSessions: pi.refreshSessions,
  })
  const markers = useSessionMarkers(nav.allSessions, session.shownIds)
  const { iconOf } = useProjectPrefs()
  const projectByCwd = computed(() => {
    const map = new Map<string, ArchiveProjectView>()
    const cwds = new Set<string>(nav.workspaces.value)

    for (const item of nav.allSessions.value) {
      if (item.cwd) cwds.add(item.cwd)
    }

    for (const cwd of cwds) {
      const name = workspaceName(cwd)
      const choice = iconOf(cwd)
      let host: string | undefined

      if (cwd.startsWith("ssh://")) {
        try {
          host = new URL(cwd).host || undefined
        } catch {
          host = undefined
        }
      }

      map.set(cwd, {
        cwd,
        name,
        monogram: projectMonogram(name),
        tone: projectIconTone(choice?.color ?? projectIconColorOf(cwd)),
        iconName: choice?.name,
        host,
      })
    }

    return map
  })
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
    const feet = new Map<string, SidebarRowFoot>()
    const byId = new Map(nav.allSessions.value.map((item) => [item.id, item]))

    for (const item of nav.allSessions.value) {
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
      const parent = item.parentSessionId ? byId.get(item.parentSessionId) : undefined

      feet.set(item.id, {
        ...foot,
        state,
        ...(parent
          ? {
              parent: {
                id: parent.id,
                title: sessionTitle(parent),
                cwd: parent.cwd,
                updatedAt: sessionRecency(parent),
                model: sessionCardFoot(parent.id, extras, live).model,
              },
            }
          : {}),
      })
    }

    return feet
  })
  const runningIds = computed(() => {
    const ids = new Set(session.backgroundRunningIds.value)
    const liveId = session.sessionId.value

    if (liveId && activeSessionRunning.value) ids.add(liveId)
    return ids
  })
  const placements = computed(() => {
    const running = runningIds.value
    const settled = markers.settledIds.value
    const map = new Map<string, SidebarPlacement>()

    for (const item of nav.listedSessions.value) {
      map.set(item.id, { running: running.has(item.id), settled: settled.has(item.id) })
    }

    return map
  })

  function placementOf(id: string): SidebarPlacement {
    return placements.value.get(id) ?? { running: false, settled: false }
  }

  useRevealNewSessions(nav.listedSessions, placements, nav.expandSection, pi.connected)

  const runningSince = shallowRef<Record<string, number>>({})

  watch(
    runningIds,
    (ids) => {
      const previous = runningSince.value
      const previousIds = Object.keys(previous)

      if (previousIds.length === ids.size && previousIds.every((id) => ids.has(id))) return

      const next: Record<string, number> = {}
      const now = Date.now()

      for (const id of ids) next[id] = previous[id] ?? now
      runningSince.value = next
    },
    { immediate: true },
  )

  function closeSession(): void {
    cancelPendingOpen()
    void router.replace("/")
  }

  return {
    groups: nav.groups,
    allSessions: nav.allSessions,
    listedSessions: nav.listedSessions,
    projectByCwd,
    runningIds,
    cardFootById,
    revealMore: nav.revealMore,
    collapseGroup: nav.collapseGroup,
    sectionsFor: (include?: Parameters<typeof nav.sectionsFor>[2]) =>
      nav.sectionsFor(markers.pinnedOrder, placementOf, include),
    moreBySection: nav.moreBySection,
    runningSince,
    settledIds: markers.settledIds,
    settle: markers.settle,
    unsettle: markers.unsettle,
    expandedSections: nav.expandedSections,
    toggleSection: nav.toggleSection,
    expandSection: nav.expandSection,
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
    addRemoteWorkspace: nav.addRemoteWorkspace,
    renameSession: nav.renameSession,
    deleteSession: nav.deleteSession,
    deleteSessions: nav.deleteSessions,
    archiveSessions: nav.archiveSessions,
    unarchiveSessions: nav.unarchiveSessions,
  }
}

export function provideNav(
  pi: ReturnType<typeof useGatewayClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: FocusedSession,
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
