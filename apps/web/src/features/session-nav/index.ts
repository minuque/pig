import { computed, inject, provide, ref, type InjectionKey } from "vue";
import { useRouter } from "vue-router";
import type { useLocalWorkspaces } from "@client/local-cwd.js";
import type { usePiClient } from "@client/pi-client.js";
import type { SessionContext } from "@features/session-workbench/index.js";
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js";

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
    router,
    refreshSessions: pi.refreshSessions,
  });

  return {
    groups: nav.groups,
    workspaces: nav.workspaces,
    listedSessions: nav.listedSessions,
    projectScope: nav.projectScope,
    addingWorkspace: nav.addingWorkspace,
    navError,
    lastCwd: cwd.lastCwd,
    activeWorkspaceId: computed(() => session.projection.value?.cwd),
    activeSessionId: session.sessionId,
    activeSessionRunning: computed(() => session.projection.value?.running ?? false),
    addWorkspace: nav.addWorkspace,
    revokeWorkspace: nav.revokeWorkspace,
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
