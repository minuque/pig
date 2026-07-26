import { computed, type ComputedRef } from "vue";
import { useRoute } from "vue-router";
import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from "vue-router";
import {
  SessionIdSchema,
  WorkspaceIdSchema,
  type SessionId,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import WorkbenchShell from "@/features/workbench/components/WorkbenchShell.vue";

/**
 * The Router is the single owner of selected Workspace/Session IDs. Hash
 * history is used because the Gateway static file server only serves exact
 * paths; deep links therefore survive reloads.
 */
const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: WorkbenchShell },
  {
    path: "/workspaces/:workspaceId",
    name: "workspace",
    component: WorkbenchShell,
  },
  {
    path: "/workspaces/:workspaceId/sessions/:sessionId",
    name: "session",
    component: WorkbenchShell,
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export function createAppRouter() {
  return createRouter({ history: createWebHashHistory(), routes });
}

/** Validated route-owned IDs; invalid params degrade to "none selected". */
export function useRouteIds(): {
  workspaceId: ComputedRef<WorkspaceId | undefined>;
  sessionId: ComputedRef<SessionId | undefined>;
} {
  const route = useRoute();
  const workspaceId = computed(() => {
    const parsed = WorkspaceIdSchema.safeParse(route.params.workspaceId);
    return parsed.success ? parsed.data : undefined;
  });
  const sessionId = computed(() => {
    const parsed = SessionIdSchema.safeParse(route.params.sessionId);
    return parsed.success ? parsed.data : undefined;
  });
  return { workspaceId, sessionId };
}
