import { computed, inject, provide, ref, type InjectionKey } from "vue"
import { useRouter } from "vue-router"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { SessionContext } from "@features/session-workbench/index.js"
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js"
import { sessionCardFoot } from "@features/session-nav/sidebar.js"
import { conversationItemCount } from "@features/transcript-view/lib/transcript-format.js"

export type NavContext = ReturnType<typeof createNav>
export const navKey: InjectionKey<NavContext> = Symbol("nav")

function createNav(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: SessionContext,
) {
  const router = useRouter()
  const navError = ref("")
  const nav = useWorkspaceNav(pi.sessions, cwd, navError, {
    sessionId: session.sessionId,
    router,
    refreshSessions: pi.refreshSessions,
    refreshSessionCards: session.refreshSessionCards,
  })

  const cardFootById = computed(() => {
    const liveId = session.sessionId.value
    const live =
      liveId && session.projection.value
        ? {
            sessionId: liveId,
            messageCount: conversationItemCount(session.transcript.value),
            model: session.projection.value.model,
          }
        : undefined
    const extras = session.sessionCards.value
    const feet = new Map<string, { messageCount: number | undefined; modelProvider: string }>()
    for (const item of nav.listedSessions.value) {
      feet.set(item.id, sessionCardFoot(item.id, extras, live))
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
    rowsFor: nav.rowsFor,
    addingWorkspace: nav.addingWorkspace,
    navError,
    lastCwd: cwd.lastCwd,
    activeWorkspaceId: computed(() => session.projection.value?.cwd),
    activeSessionId: session.sessionId,
    activeSessionRunning: computed(() => session.projection.value?.running ?? false),
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
