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
  TranscriptItem,
  Unsubscribe,
} from "@/types/common-type.js"
import { errorMessage } from "@client/http.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { contextUsage, sessionTranscript } from "@client/platform.js"
import { projectContextUsage } from "@features/composer/lib/context-usage.js"
import { useComposerBinding } from "@features/composer/hooks/use-composer-binding.js"
import { catalogFromModels, thinkingLevelOf } from "@features/composer/lib/model-preset.js"
import {
  createAbortableOpen,
  isDisconnectedError,
  isOpenAborted,
} from "@features/session-workbench/lib/abortable-open.js"
import {
  adoptWelcomeOptimistic,
  applyUserRowAliases,
  confirmedUserRowAlias,
  isSessionOpening,
  mergeLiveTranscript,
  optimisticUserMessage,
  PENDING_SESSION_ID,
  phaseLabel,
  projectOptimisticTranscript,
  projectSessionSnapshot,
  sessionState,
} from "@features/session-workbench/lib/session-state.js"
import type { OptimisticUserMessage, SessionProjection } from "@features/session-workbench/type.js"

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

  // 替换操作串行化：同一时刻至多一个 open/create，避免并发 lease
  let replaceChain: Promise<void> = Promise.resolve()
  // 最新想打开的 session：快速连点时跳过中间 id，只落地最后一次
  let wantedId: string | undefined
  let abortInflightOpen: (() => void) | undefined
  const { raceRemoteOpen, discard } = createAbortableOpen()

  const contextUsageEstimate = shallowRef<ContextUsageEstimate>()
  let contextUsageRequest = 0

  const history = shallowRef<TranscriptItem[]>([])
  const turnTimings = shallowRef<TurnTiming[]>([])
  const historySessionId = shallowRef<string>()
  const historyHasMore = shallowRef(false)
  const loadingOlder = shallowRef(false)
  const heldLive = shallowRef<TranscriptItem[]>([])
  let historyRequest = 0
  let olderRequest = 0

  const snapshot = computed(() => state.value?.snapshot)
  const remoteProjection = computed<SessionProjection | undefined>(() =>
    snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined,
  )
  const liveTranscript = computed(() => {
    const persisted = historySessionId.value === wantedId ? history.value : []
    return mergeLiveTranscript(persisted, heldLive.value)
  })

  function attach(next: RemoteSession) {
    const previous = remote.value
    detach()
    if (previous && previous !== next) void discard(previous)
    remote.value = next
    let usageRevision: number | undefined
    unsubscribeState = next.subscribe((nextState) => {
      state.value = nextState
      if (nextState.transcript.length > 0)
        heldLive.value = mergeLiveTranscript(heldLive.value, nextState.transcript)
      const revision = nextState.snapshot?.revision
      const attachedId = next.id
      if (revision !== undefined && revision !== usageRevision && attachedId) {
        usageRevision = revision
        void refreshContextUsage(attachedId)
        if (historySessionId.value !== attachedId) void loadHistory(attachedId)
      }
    })
  }

  function detach() {
    contextUsageRequest += 1
    unsubscribeState?.()
    unsubscribeState = undefined
    remote.value = undefined
    state.value = undefined
    contextUsageEstimate.value = undefined
    if (historySessionId.value !== wantedId) {
      history.value = []
      turnTimings.value = []
      historySessionId.value = undefined
      historyHasMore.value = false
    }
    heldLive.value = []
  }

  async function loadHistory(id: string) {
    const request = ++historyRequest
    olderRequest += 1
    loadingOlder.value = false
    try {
      const { items, timings, hasMore } = await sessionTranscript(id)
      if (request !== historyRequest || wantedId !== id) return
      history.value = items
      turnTimings.value = timings
      historyHasMore.value = hasMore
      historySessionId.value = id
    } catch {
      if (request !== historyRequest || wantedId !== id) return
      if (historySessionId.value !== id) {
        history.value = []
        turnTimings.value = []
        historyHasMore.value = false
        historySessionId.value = id
      }
    }
  }

  async function loadOlderHistory() {
    const id = wantedId
    const before = history.value[0]?.id
    if (!id || !before || !historyHasMore.value || loadingOlder.value) return
    const request = ++olderRequest
    loadingOlder.value = true
    try {
      const { items, timings, hasMore } = await sessionTranscript(id, before)
      if (request !== olderRequest || wantedId !== id) return
      const known = new Set(history.value.map((item) => item.id))
      const older = items.filter((item) => !known.has(item.id))
      if (older.length > 0) {
        history.value = older.concat(history.value)
        const seen = new Set(turnTimings.value.map((item) => item.userId))
        turnTimings.value = turnTimings.value.concat(
          timings.filter((item) => !seen.has(item.userId)),
        )
      }
      historyHasMore.value = hasMore
    } catch {
      if (request !== olderRequest || wantedId !== id) return
    } finally {
      if (request === olderRequest) loadingOlder.value = false
    }
  }

  async function refreshContextUsage(id: string | undefined) {
    if (!id) return
    const request = ++contextUsageRequest
    try {
      const usage = await contextUsage(id)
      if (request !== contextUsageRequest || remote.value?.id !== id) return
      contextUsageEstimate.value = usage ?? undefined
    } catch {
      // 占用估算是辅助信息；失败时保留上次结果，不覆盖会话主错误。
    }
  }

  function release() {
    const previous = remote.value
    detach()
    if (previous) void discard(previous)
  }

  /** 串行执行替换操作：前一次失败不阻塞后续。 */
  function enqueueReplace<T>(run: () => Promise<T>): Promise<T> {
    const next = replaceChain.then(run, run)
    replaceChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /** 打开已有 Session：历史走 HTTP，协议 snapshot 不含全文。已附加同 id 时幂等跳过。 */
  async function openRemoteSession(id: string) {
    if (wantedId !== id) abortInflightOpen?.()
    wantedId = id
    if (historySessionId.value !== id) {
      history.value = []
      turnTimings.value = []
      heldLive.value = []
      historySessionId.value = undefined
      historyHasMore.value = false
    }
    void loadHistory(id)
    return enqueueReplace(async () => {
      if (wantedId !== id) return
      if (remote.value?.id === id) return
      const target = pi.client.value
      if (!target) return
      release()
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const current = pi.client.value
        if (!current || wantedId !== id) return
        const raced = raceRemoteOpen(id, () => RemoteSession.open(current, id))
        abortInflightOpen = raced.abort
        try {
          const next = await raced.promise
          if (wantedId !== id) {
            await discard(next)
            return
          }
          attach(next)
          return
        } catch (error) {
          if (wantedId !== id || isOpenAborted(error)) return
          if (isDisconnectedError(error) && historySessionId.value === id) return
          if (!isDisconnectedError(error) || attempt === 7) throw error
          await new Promise((resolve) => {
            window.setTimeout(resolve, 40 * (attempt + 1))
          })
        } finally {
          if (abortInflightOpen === raced.abort) abortInflightOpen = undefined
        }
      }
    })
  }

  /** 在指定 cwd 创建新 Session（cwd 来自本地 Workspace preference）。 */
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
      wantedId = next.id
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
    wantedId = undefined
    abortInflightOpen?.()
    abortInflightOpen = undefined
    const current = remote.value
    detach()
    if (current) await discard(current)
  }

  let initialized = false

  /** 路由参数与 RemoteSession 生命周期同步。 */
  async function syncRoute() {
    const id = sessionId.value
    if (!id) return dispose()
    try {
      await openRemoteSession(id)
    } catch (error) {
      sessionError.value = errorMessage(error)
      if (sessionId.value && history.value.length === 0) await router.replace("/")
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
    if (id) {
      wantedId = id
      await loadHistory(id)
    } else await dispose()
    if (pi.connected.value) void syncRoute()
  }

  const sessionPending = computed(() =>
    isSessionOpening(sessionId.value, remote.value?.id, historySessionId.value),
  )
  const projection = computed(() => (sessionPending.value ? undefined : remoteProjection.value))
  const catalog = computed(() => catalogFromModels(pi.models.value))
  const phase = computed(() => projection.value?.phase)
  const running = computed(() =>
    sessionPending.value ? false : (projection.value?.running ?? false),
  )
  const phaseText = computed(() => {
    const current = phase.value
    return running.value && current ? phaseLabel(current) : ""
  })

  const { preset } = useComposerBinding({
    catalog,
    snapshot,
    phase,
    error: sessionError,
    setModel,
    setThinking,
  })

  const states = reactive(new Map<string, ReturnType<typeof sessionState>>())
  const creatingCwd = ref<string>()
  const idleDraft = shallowRef("")
  const submitting = ref(false)
  const aborting = ref(false)
  const welcomeOptimistic = shallowRef<OptimisticUserMessage | null>(null)

  const clientState = computed(() => {
    const id = sessionId.value
    return id ? sessionState(states, id) : undefined
  })
  const prompt = computed({
    get: () => clientState.value?.draft ?? idleDraft.value,
    set: (value: string) => {
      if (clientState.value) clientState.value.draft = value
      else idleDraft.value = value
    },
  })

  async function createSession(nextCwd: string) {
    if (creatingCwd.value) return
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
      if (!nextId || sessionId.value !== routeSessionAtStart) return undefined
      cwd.selectCwd(nextCwd)
      adoptWelcomeOptimistic(states, nextId, welcomeOptimistic.value)
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

  async function submitText(text: string) {
    const current = clientState.value
    const normalized = text.trim()
    if (!current || !normalized || submitting.value) return

    submitting.value = true
    sessionError.value = ""
    const optimistic =
      current.optimisticUser ??
      optimisticUserMessage(
        sessionId.value ?? PENDING_SESSION_ID,
        normalized,
        liveTranscript.value.map((item) => item.id),
      )
    current.optimisticUser = optimistic
    current.draft = ""

    try {
      await submitRemote(normalized)
    } catch (error) {
      if (!current.draft) current.draft = text
      sessionError.value = errorMessage(error)
      throw error
    } finally {
      const alias = confirmedUserRowAlias(liveTranscript.value, optimistic)
      if (alias) current.userRowIds[alias.serverId] = alias.clientId
      if (current.optimisticUser?.item.id === optimistic.item.id) current.optimisticUser = null
      submitting.value = false
    }
  }

  async function abortSession() {
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

  /** 欢迎页首次 Prompt：立刻投影用户句，再创建 Session 并发送。 */
  async function createAndSubmit(nextCwd: string, text: string) {
    const normalized = text.trim()
    if (!normalized || creatingCwd.value || welcomeOptimistic.value) return

    const previousDraft = idleDraft.value
    welcomeOptimistic.value = optimisticUserMessage(PENDING_SESSION_ID, normalized)
    idleDraft.value = ""

    try {
      const nextId = await createSession(nextCwd)
      if (!nextId || sessionId.value !== nextId || remote.value?.id !== nextId) return
      await submitText(text)
    } catch (error) {
      if (!sessionId.value && !idleDraft.value) idleDraft.value = previousDraft || text
      throw error
    } finally {
      welcomeOptimistic.value = null
    }
  }

  watch(
    [liveTranscript, () => clientState.value?.optimisticUser],
    ([items, optimistic]) => {
      const current = clientState.value
      if (!current || !optimistic) return
      const alias = confirmedUserRowAlias(items, optimistic)
      if (alias) current.userRowIds[alias.serverId] = alias.clientId
    },
    { flush: "sync" },
  )

  const transcript = computed(() =>
    applyUserRowAliases(
      projectOptimisticTranscript(
        liveTranscript.value,
        clientState.value?.optimisticUser ?? (sessionId.value ? null : welcomeOptimistic.value),
      ),
      clientState.value?.userRowIds,
    ),
  )
  const sessionCwd = computed(() => projection.value?.cwd ?? cwd.lastCwd.value)
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
    phaseText,
    sessionPending,
    connecting: computed(() => pi.connectionState.value === "connecting"),
    connected: pi.connected,
    connectionError: pi.connectionError,
    transcript,
    historyHasMore,
    loadingOlder,
    loadOlderHistory,
    turnTimings: computed(() =>
      historySessionId.value === sessionId.value ? turnTimings.value : [],
    ),
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
    createAndSubmit,
    submitText,
    abortSession,
    initialize,
    remote,
    dispose,
    teardown,
  }
}
