import { computed, inject, provide, ref, type InjectionKey } from "vue";
import { useRouter } from "vue-router";
import type { useLocalWorkspaces } from "@client/local-cwd.js";
import type { usePiClient } from "@client/pi-client.js";
import type { SessionContext } from "@features/session-workbench/index.js";
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js";
import { modelDisplayNames, sessionCardFoot } from "@features/session-nav/sidebar.js";

export type NavContext = ReturnType<typeof createNav>;
export const navKey: InjectionKey<NavContext> = Symbol("nav");

function createNav(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: SessionContext,
) {
  const router = useRouter();
  const navError = ref("");
  const nav = useWorkspaceNav(pi.sessions, cwd, navError, {
    sessionId: session.sessionId,
    connected: pi.connected,
    router,
    refreshSessions: pi.refreshSessions,
  });

  const cardFootById = computed(() => {
    const names = modelDisplayNames(session.catalog.value);
    const liveId = session.sessionId.value;
    const live =
      liveId && session.projection.value
        ? {
            sessionId: liveId,
            // 快照窗口截断 transcript；条数由 sessionCardFoot 与 extras 取 max。
            messageCount: session.transcript.value.length,
            model: session.projection.value.model,
          }
        : undefined;
    const extras = nav.sessionCards.value;
    const feet = new Map<
      string,
      { messageCount: number | undefined; modelLabel: string; modelProvider: string }
    >();
    for (const item of nav.listedSessions.value) {
      feet.set(item.id, sessionCardFoot(item.id, extras, live, names));
    }
    return feet;
  });

  return {
    groups: nav.groups,
    workspaces: nav.workspaces,
    listedSessions: nav.listedSessions,
    cardFootById,
    projectScope: nav.projectScope,
    toggleProjectScope: nav.toggleProjectScope,
    clearProjectScope: nav.clearProjectScope,
    addingWorkspace: nav.addingWorkspace,
    navError,
    lastCwd: cwd.lastCwd,
    activeWorkspaceId: computed(() => session.projection.value?.cwd),
    activeSessionId: session.sessionId,
    activeSessionRunning: computed(() => session.projection.value?.running ?? false),
    addWorkspace: nav.addWorkspace,
    renameSession: nav.renameSession,
    deleteSession: nav.deleteSession,
  };
}

export function provideNav(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  session: SessionContext,
) {
  const nav = createNav(pi, cwd, session);
  provide(navKey, nav);
  return nav;
}

export function useNav(): NavContext {
  const nav = inject(navKey);
  if (!nav) throw new Error("useNav() 需要在 provideNav() 之后调用");
  return nav;
}
