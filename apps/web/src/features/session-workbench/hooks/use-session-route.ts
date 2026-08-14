import { computed, watch, type Ref } from "vue";
import type { RouteLocationNormalizedLoadedGeneric, Router } from "vue-router";

interface SessionRouteOptions {
  route: RouteLocationNormalizedLoadedGeneric;
  router: Router;
  error: Ref<string>;
  errorMessage(error: unknown): string;
  openSession(id: string): Promise<void>;
  dispose(): Promise<void>;
}

/** 路由参数与 RemoteSession 生命周期同步。 */
export function useSessionRoute(options: SessionRouteOptions) {
  const sessionId = computed(() => {
    const raw = options.route.params.sessionId;
    return typeof raw === "string" && raw.length > 0 ? raw : undefined;
  });
  let initialized = false;

  async function sync() {
    const id = sessionId.value;
    if (!id) return options.dispose();
    try {
      await options.openSession(id);
    } catch (error) {
      options.error.value = options.errorMessage(error);
      if (sessionId.value) await options.router.replace("/");
    }
  }
  watch(sessionId, () => {
    if (initialized) void sync();
  });

  async function initialize() {
    initialized = true;
    await sync();
  }

  return { sessionId, initialize };
}
