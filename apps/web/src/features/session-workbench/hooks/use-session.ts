import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  watch,
} from "vue"
import { useRoute, useRouter } from "vue-router"
import { RemoteSession } from "@earendil-works/pi-coding-agent/client"
import type {
  ModelRef,
  RemoteSessionState,
  ThinkingLevel,
  Unsubscribe,
} from "@/types/common-type.js"
import { errorMessage } from "@client/http.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import { contextUsage } from "@client/platform.js"
import {
  catalogFromModels,
  projectContextUsage,
  thinkingLevelOf,
  useComposerBinding,
} from "@features/composer/index.js"
import { useSessionHistory } from "@features/session-workbench/hooks/use-session-history.js"
import {
  createAbortableOpen,
  isDisconnectedError,
  isOpenAborted,
} from "@features/session-workbench/hooks/abortable-open.js"
import { coalesceByFrame } from "@features/session-workbench/lib/coalesce-by-frame.js"
import {
  bindIdleSends,
  isSessionOpening,
  optimisticUserMessage,
  phaseLabel,
  projectClientTranscript,
  projectSessionSnapshot,
  sessionState,
  withPendingAssistant,
} from "@features/session-workbench/lib/session-state.js"
import type { SessionClientState } from "@features/session-workbench/type.js"

interface CreateSessionInput {
  cwd: string
  model?: ModelRef
  thinkingLevel?: ThinkingLevel
}

/** Route、RemoteSession、历史合并、草稿与提交。不接管卡片，切 Session 不滚动。 */
export function useSessionLifecycle(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const route = useRoute()
  const router = useRouter()
  const sessionError = ref("")
  const sessionId = computed(() => {
    const raw = route.params.sessionId
    return typeof raw === "string" && raw.length > 0 ? raw : undefined
  })
  const remote = shallowRef<RemoteSession>()
  const state = shallowRef<RemoteSessionState>()
  let unsubscribeState: Unsubscribe | undefined
  let cancelCoalesced: (() => void) | undefined
  let replaceChain: Promise<void> = Promise.resolve()
  let abortInflightOpen: (() => void) | undefined
  const { raceRemoteOpen, discard } = createAbortableOpen()
  const history = useSessionHistory()
  const contextUsageEstimate = shallowRef<ContextUsageEstimate>()
  let contextUsageRequest = 0
  const snapshot = computed(() => state.value?.snapshot)
  const liveTranscript = history.liveTranscript

  function attach(next: RemoteSession) {
    const previous = remote.value
    detach()

    if (previous && previous !== next) void discard(previous)
    remote.value = next
    let usageRevision: number | undefined
    // 每 token 一个事件，整流成每帧一次发布，避免每 token 重建整条时间线
    const coalesced = coalesceByFrame<RemoteSessionState>((nextState) => {
      state.value = nextState
      const attachedId = next.id

      if (nextState.transcript.length > 0 && attachedId)
        history.overlayLive(attachedId, nextState.transcript)
      const revision = nextState.snapshot?.revision

      if (revision === undefined || revision === usageRevision || !attachedId) return
      const hadRevision = usageRevision !== undefined
      usageRevision = revision
      void refreshContextUsage(attachedId)

      if (hadRevision) void history.loadHistory(attachedId, { force: true })
      else void history.loadHistory(attachedId)
    })

    cancelCoalesced = coalesced.cancel
    unsubscribeState = next.subscribe((nextState) => coalesced.push(nextState))
  }

  function detach() {
    contextUsageRequest += 1
    unsubscribeState?.()
    unsubscribeState = undefined
    cancelCoalesced?.()
    cancelCoalesced = undefined
    remote.value = undefined
    state.value = undefined
    contextUsageEstimate.value = undefined
  }

  async function refreshContextUsage(id: string | undefined) {
    if (!id) return
    const request = ++contextUsageRequest

    try {
      const usage = await contextUsage(id)

      if (request !== contextUsageRequest || remote.value?.id !== id) return
      contextUsageEstimate.value = usage ?? undefined
    } catch {
      /* 占用估算失败不挡主流程 */
    }
  }

  function release() {
    const previous = remote.value
    detach()

    if (previous) void discard(previous)
  }

  function enqueueReplace<T>(run: () => Promise<T>): Promise<T> {
    const next = replaceChain.then(run, run)
    replaceChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /** 打开已有 Session：历史走 HTTP。断线等 pi.connected 再 open 一次。 */
  async function openRemoteSession(id: string) {
    if (history.activeId.value !== id) abortInflightOpen?.()
    history.setActive(id)
    void history.loadHistory(id)
    return enqueueReplace(async () => {
      if (history.activeId.value !== id || remote.value?.id === id) return

      if (!pi.client.value) return
      release()

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const current = pi.client.value

        if (!current || history.activeId.value !== id) return
        const raced = raceRemoteOpen(id, () => RemoteSession.open(current, id))
        abortInflightOpen = raced.abort

        try {
          const next = await raced.promise

          if (history.activeId.value !== id) {
            await discard(next)
            return
          }

          attach(next)
          return
        } catch (error) {
          if (history.activeId.value !== id || isOpenAborted(error)) return

          if (!isDisconnectedError(error)) throw error

          if (attempt === 0 && pi.connected.value) continue

          if (pi.connected.value) throw error
          return
        } finally {
          if (abortInflightOpen === raced.abort) abortInflightOpen = undefined
        }
      }
    })
  }

  async function createRemoteSession(nextCwd: string, options?: Omit<CreateSessionInput, "cwd">) {
    const routeSessionAtStart = sessionId.value
    return enqueueReplace(async () => {
      const target = pi.client.value

      if (!target) throw new Error("PiClient 未连接")

      const next = await RemoteSession.create(target, {
        cwd: nextCwd,
        ...(options?.model !== undefined ? { model: options.model } : {}),
        ...(options?.thinkingLevel !== undefined ? { thinkingLevel: options.thinkingLevel } : {}),
      })

      if (sessionId.value !== routeSessionAtStart) {
        await discard(next)
        return undefined
      }

      history.setActive(next.id)
      attach(next)
      return next.id
    })
  }

  async function submitRemote(text: string) {
    await remote.value?.submit(text)
  }

  async function abortRemote() {
    await remote.value?.abort()
  }

  async function setModel(model: ModelRef) {
    await remote.value?.setModel(model)
  }

  async function setThinking(thinkingLevel: ThinkingLevel) {
    await remote.value?.setThinking(thinkingLevel)
  }

  async function reconnect() {
    await remote.value?.reconnect()
  }

  async function dispose() {
    history.setActive(undefined)
    abortInflightOpen?.()
    abortInflightOpen = undefined
    const current = remote.value
    detach()

    if (current) await discard(current)
  }

  let initialized = false

  async function syncRoute() {
    const id = sessionId.value

    if (!id) return dispose()

    try {
      await openRemoteSession(id)
    } catch (error) {
      sessionError.value = errorMessage(error)

      if (sessionId.value && liveTranscript.value.length === 0) await router.replace("/")
    }
  }

  const stopRouteSync = watch(sessionId, () => {
    if (initialized) void syncRoute()
  })
  const stopClientSync = watch(
    () => pi.connected.value,
    (connected) => {
      if (initialized && connected) void syncRoute()
    },
  )

  async function initialize() {
    initialized = true
    const id = sessionId.value

    if (id) history.setActive(id)
    else await dispose()

    if (pi.connected.value) void syncRoute()
    else if (id) await history.loadHistory(id)
  }

  const sessionPending = computed(() =>
    isSessionOpening(sessionId.value, remote.value?.id, history.historyReadyId.value),
  )
  const projection = computed(() => {
    const current = snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined
    return !sessionId.value || current?.id === sessionId.value ? current : undefined
  })
  const catalog = computed(() => catalogFromModels(pi.models.value))
  const phase = computed(() => projection.value?.phase)
  const running = computed(() => projection.value?.running ?? false)
  const phaseText = computed(() => (running.value && phase.value ? phaseLabel(phase.value) : ""))
  const { preset } = useComposerBinding({
    catalog,
    snapshot,
    phase,
    setModel,
    setThinking,
  })
  const states = reactive(new Map<string, ReturnType<typeof sessionState>>())
  const idleState = reactive<SessionClientState>({ draft: "", sends: [] })
  const creatingCwd = ref<string>()
  const submitting = ref(false)
  const aborting = ref(false)
  let sendEpoch = 0
  const clientState = computed(() => {
    const id = sessionId.value
    return id ? sessionState(states, id) : idleState
  })
  const prompt = computed({
    get: () => clientState.value.draft,
    set: (value: string) => {
      clientState.value.draft = value
    },
  })

  async function createSession(nextCwd: string) {
    if (creatingCwd.value) return
    const epoch = sendEpoch
    const routeSessionAtStart = sessionId.value
    creatingCwd.value = nextCwd
    sessionError.value = ""

    try {
      const next = preset.value
      const nextId = await createRemoteSession(
        nextCwd,
        next
          ? { model: next.model, thinkingLevel: thinkingLevelOf(next.thinkingLevel) }
          : undefined,
      )

      if (epoch !== sendEpoch) {
        idleState.sends = []

        if (!sessionId.value) {
          history.setActive(undefined)
          release()
        }

        return undefined
      }

      if (!nextId || sessionId.value !== routeSessionAtStart) {
        idleState.sends = []
        return undefined
      }

      cwd.selectCwd(nextCwd)
      bindIdleSends(states, nextId, idleState)

      if (nextId !== sessionId.value) {
        await router.push({ name: "session", params: { sessionId: nextId } })
      }

      return nextId
    } catch (error) {
      sessionError.value = errorMessage(error)
      throw error
    } finally {
      creatingCwd.value = undefined
    }
  }

  async function sendPrompt(text: string, cwd?: string) {
    const normalized = text.trim()

    if (!normalized || submitting.value) return

    if (!sessionId.value && (!cwd || creatingCwd.value)) return
    const epoch = ++sendEpoch

    submitting.value = true
    sessionError.value = ""
    const thread = clientState.value
    const previousDraft = thread.draft
    const send = optimisticUserMessage(
      normalized,
      liveTranscript.value.map((item) => item.id),
    )

    thread.sends.push(send)
    thread.draft = ""

    try {
      if (!sessionId.value) {
        const nextId = await createSession(cwd!)

        if (epoch !== sendEpoch) return

        if (!nextId || sessionId.value !== nextId || remote.value?.id !== nextId) return
      }

      if (epoch !== sendEpoch) return
      await submitRemote(normalized)
    } catch (error) {
      if (epoch !== sendEpoch) return
      const current = clientState.value

      if (!current.draft) current.draft = previousDraft || text
      const index = current.sends.findIndex((item) => item.item.id === send.item.id)

      if (index >= 0) current.sends.splice(index, 1)
      sessionError.value = errorMessage(error)
      throw error
    } finally {
      if (epoch === sendEpoch) submitting.value = false
    }
  }

  async function abortSession() {
    sendEpoch += 1
    submitting.value = false

    if (!remote.value) {
      idleState.sends = []
      clientState.value.sends = []
    }

    if (aborting.value) return
    aborting.value = true

    try {
      await abortRemote()
    } catch (error) {
      sessionError.value = errorMessage(error)
    } finally {
      aborting.value = false
    }
  }

  const turnPending = computed(() => submitting.value || running.value)
  const transcript = computed(() =>
    withPendingAssistant(
      projectClientTranscript(liveTranscript.value, clientState.value.sends),
      turnPending.value,
    ),
  )
  const sessionCwd = computed(
    () =>
      projection.value?.cwd ??
      pi.sessions.value.find((item) => item.id === sessionId.value)?.cwd ??
      (sessionId.value ? undefined : cwd.lastCwd.value),
  )
  const projectedUsage = computed(() => projectContextUsage(contextUsageEstimate.value))

  pi.bindAttachedReconnect(async () => {
    if (remote.value) await reconnect()
    else await pi.client.value?.reconnect()
  })

  function teardown() {
    stopRouteSync()
    stopClientSync()
    pi.bindAttachedReconnect()
    void dispose()
  }

  if (getCurrentInstance()) onBeforeUnmount(teardown)
  return {
    sessionId,
    projection,
    phase,
    running,
    turnPending,
    phaseText,
    sessionPending,
    connecting: computed(() => pi.connectionState.value === "connecting"),
    connected: pi.connected,
    connectionError: pi.connectionError,
    transcript,
    historyHasMore: history.historyHasMore,
    loadingOlder: history.loadingOlder,
    loadOlderHistory: history.loadOlderHistory,
    turnTimings: history.turnTimings,
    sessionCwd,
    contextUsage: projectedUsage,
    catalog,
    preset,
    prompt,
    clientState,
    sessionError,
    creating: creatingCwd,
    aborting,
    createSession,
    sendPrompt,
    abortSession,
    initialize,
    remote,
    dispose,
    teardown,
  }
}
