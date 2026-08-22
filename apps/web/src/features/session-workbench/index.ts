import { computed, inject, onBeforeUnmount, provide, ref, type InjectionKey } from "vue";
import { useRoute, useRouter } from "vue-router";
import { errorMessage } from "@client/http.js";
import type { useLocalWorkspaces } from "@client/local-cwd.js";
import type { usePiClient } from "@client/pi-client.js";
import { catalogFromModels } from "@features/chat-input/types.js";
import { useChatInputBinding } from "@features/chat-input/hooks/use-chat-input-binding.js";
import { useRemoteSessions } from "@features/session-workbench/hooks/use-sessions.js";
import { useSessionRoute } from "@features/session-workbench/hooks/use-session-route.js";
import { useSessionRuntime } from "@features/session-workbench/hooks/use-session-runtime.js";
import { isSessionPending } from "@features/session-workbench/lib/session-state.js";

export type SessionContext = ReturnType<typeof createSession>;
export const sessionKey: InjectionKey<SessionContext> = Symbol("session");

function createSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const route = useRoute();
  const router = useRouter();
  const sessionError = ref("");
  const remote = useRemoteSessions(pi.client);

  const { sessionId, initialize } = useSessionRoute({
    route,
    router,
    error: sessionError,
    errorMessage,
    openSession: remote.openSession,
    dispose: remote.dispose,
  });

  const sessionPending = computed(() => isSessionPending(sessionId.value, remote.remote.value?.id));
  const projection = computed(() => (sessionPending.value ? undefined : remote.projection.value));
  const catalog = computed(() => catalogFromModels(pi.models.value));
  const phase = computed(() => projection.value?.phase);
  const { preset } = useChatInputBinding({
    catalog,
    snapshot: remote.snapshot,
    phase,
    error: sessionError,
    setModel: remote.setModel,
    setThinking: remote.setThinking,
  });

  const runtime = useSessionRuntime({
    remote,
    sessionId,
    router,
    preset,
    sessionError,
    selectCwd: cwd.selectCwd,
  });

  pi.bindAttachedReconnect(async () => {
    if (remote.remote.value) await remote.reconnect();
    else await pi.client.value?.reconnect();
  });

  onBeforeUnmount(() => {
    pi.bindAttachedReconnect();
    void remote.dispose();
  });

  return {
    sessionId,
    projection,
    phase,
    sessionPending,
    connecting: computed(() => pi.connectionState.value === "connecting"),
    connected: pi.connected,
    connectionError: pi.connectionError,
    transcript: computed(() => (sessionPending.value ? [] : remote.transcript.value)),
    catalog,
    preset,
    prompt: runtime.prompt,
    clientState: runtime.clientState,
    sessionError,
    creating: runtime.creating,
    aborting: runtime.aborting,
    queuedSteerCount: computed(() => projection.value?.queuedSteerCount ?? 0),
    createSession: runtime.createSession,
    submitText: runtime.submitText,
    abortSession: runtime.abortSession,
    applyThreadState: runtime.applyThreadState,
    loadEarlier: remote.loadEarlier,
    loadingEarlier: remote.loadingEarlier,
    earlierExhausted: remote.earlierExhausted,
    initialize,
  };
}

export function provideSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const session = createSession(pi, cwd);
  provide(sessionKey, session);
  return session;
}

export function useSession(): SessionContext {
  const session = inject(sessionKey);
  if (!session) throw new Error("useSession() 需要在 provideSession() 之后调用");
  return session;
}
