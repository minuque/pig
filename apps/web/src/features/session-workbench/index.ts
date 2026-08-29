import { computed, inject, onBeforeUnmount, provide, ref, watch, type InjectionKey } from "vue"
import { useRoute, useRouter } from "vue-router"
import { errorMessage } from "@client/http.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import { projectContextUsage } from "@features/chat-input/lib/context-usage.js"
import { catalogFromModels } from "@features/chat-input/types.js"
import { useChatInputBinding } from "@features/chat-input/hooks/use-chat-input-binding.js"
import { useSessionCards } from "@features/session-workbench/hooks/use-session-cards.js"
import { useRemoteSessions } from "@features/session-workbench/hooks/use-sessions.js"
import { useSessionRuntime } from "@features/session-workbench/hooks/use-session-runtime.js"
import {
  isSessionOpening,
  phaseLabel,
  projectOptimisticTranscript,
} from "@features/session-workbench/lib/session-state.js"

export type SessionContext = ReturnType<typeof createSession>
export const sessionKey: InjectionKey<SessionContext> = Symbol("session")

function createSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const route = useRoute()
  const router = useRouter()
  const sessionError = ref("")
  const cards = useSessionCards(pi.connected, pi.sessions)
  const remote = useRemoteSessions(pi.client)

  const sessionId = computed(() => {
    const raw = route.params.sessionId
    return typeof raw === "string" && raw.length > 0 ? raw : undefined
  })
  let initialized = false
  /** 路由参数与 RemoteSession 生命周期同步。 */
  async function syncRoute() {
    const id = sessionId.value
    if (!id) return remote.dispose()
    try {
      await remote.openSession(id)
    } catch (error) {
      sessionError.value = errorMessage(error)
      if (sessionId.value) await router.replace("/")
    }
  }
  watch(sessionId, () => {
    if (initialized) void syncRoute()
  })
  async function initialize() {
    initialized = true
    await syncRoute()
  }

  const sessionPending = computed(() =>
    isSessionOpening(sessionId.value, remote.remote.value?.id, remote.historySessionId.value),
  )
  const projection = computed(() => (sessionPending.value ? undefined : remote.projection.value))
  const catalog = computed(() => catalogFromModels(pi.models.value))
  const phase = computed(() => projection.value?.phase)
  const running = computed(() =>
    sessionPending.value ? false : (projection.value?.running ?? false),
  )
  const phaseText = computed(() => {
    const current = phase.value
    return running.value && current ? phaseLabel(current) : ""
  })
  const { preset } = useChatInputBinding({
    catalog,
    snapshot: remote.snapshot,
    phase,
    error: sessionError,
    setModel: remote.setModel,
    setThinking: remote.setThinking,
  })

  const runtime = useSessionRuntime({
    remote,
    sessionId,
    router,
    preset,
    sessionError,
    selectCwd: cwd.selectCwd,
  })
  const transcript = computed(() =>
    projectOptimisticTranscript(
      remote.transcript.value,
      runtime.clientState.value?.optimisticUser ?? null,
    ),
  )
  const sessionCwd = computed(() => projection.value?.cwd ?? cwd.lastCwd.value)
  const contextUsage = computed(() => projectContextUsage(remote.contextUsageEstimate.value))

  pi.bindAttachedReconnect(async () => {
    if (remote.remote.value) await remote.reconnect()
    else await pi.client.value?.reconnect()
  })

  onBeforeUnmount(() => {
    pi.bindAttachedReconnect()
    void remote.dispose()
  })

  return {
    sessionId,
    projection,
    phase,
    running,
    phaseText,
    sessionPending,
    connecting: computed(() => pi.connectionState.value === "connecting"),
    connected: pi.connected,
    connectionError: pi.connectionError,
    transcript,
    sessionCwd,
    contextUsage,
    catalog,
    preset,
    prompt: runtime.prompt,
    clientState: runtime.clientState,
    sessionError,
    creating: runtime.creating,
    aborting: runtime.aborting,
    createSession: runtime.createSession,
    createAndSubmit: runtime.createAndSubmit,
    submitText: runtime.submitText,
    abortSession: runtime.abortSession,
    applyThreadState: runtime.applyThreadState,
    sessionCards: cards.sessionCards,
    refreshSessionCards: cards.loadSessionCards,
    initialize,
  }
}

export function provideSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const session = createSession(pi, cwd)
  provide(sessionKey, session)
  return session
}

export function useSession(): SessionContext {
  const session = inject(sessionKey)
  if (!session) throw new Error("useSession() 需要在 provideSession() 之后调用")
  return session
}
