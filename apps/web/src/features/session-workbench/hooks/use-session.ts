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
  UserTranscriptItem,
} from "@/types/common-type.js"
import { errorMessage } from "@client/http.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { contextUsage, sessionTranscript } from "@client/platform.js"
import { projectContextUsage } from "@features/chat-input/lib/context-usage.js"
import { useChatInputBinding } from "@features/chat-input/hooks/use-chat-input-binding.js"
import { catalogFromModels, thinkingLevelOf } from "@features/chat-input/lib/model-preset.js"
import {
  isSessionOpening,
  mergeLiveTranscript,
  phaseLabel,
  projectOptimisticTranscript,
  projectSessionSnapshot,
  sessionState,
} from "@features/session-workbench/lib/session-state.js"
import type { SessionProjection } from "@features/session-workbench/type.js"

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

  const contextUsageEstimate = shallowRef<ContextUsageEstimate>()
  let contextUsageRequest = 0

  const history = shallowRef<TranscriptItem[]>([])
  const turnTimings = shallowRef<TurnTiming[]>([])
  const historySessionId = shallowRef<string>()
  const heldLive = shallowRef<TranscriptItem[]>([])
  let historyRequest = 0

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
    // 替换旧实例：释放其 lease（RemoteSession.dispose 幂等，可重复调用）
    if (previous && previous !== next) void previous.dispose()
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
        void loadHistory(attachedId)
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
    }
    heldLive.value = []
  }

  async function loadHistory(id: string) {
    const request = ++historyRequest
    try {
      const { items, timings } = await sessionTranscript(id)
      if (request !== historyRequest || wantedId !== id) return
      history.value = items
      turnTimings.value = timings
      historySessionId.value = id
    } catch {
      if (request !== historyRequest || wantedId !== id) return
      if (historySessionId.value !== id) {
        history.value = []
        turnTimings.value = []
        historySessionId.value = id
      }
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
    if (previous) void previous.dispose()
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
    wantedId = id
    if (historySessionId.value !== id) {
      history.value = []
      turnTimings.value = []
      heldLive.value = []
      historySessionId.value = undefined
    }
    void loadHistory(id)
    return enqueueReplace(async () => {
      if (wantedId !== id) return
      if (remote.value?.id === id) return
      const target = pi.client.value
      if (!target) throw new Error("PiClient 未连接")
      release()
      try {
        const next = await RemoteSession.open(target, id)
        if (wantedId !== id) {
          await next.dispose()
          return
        }
        attach(next)
      } catch (error) {
        if (wantedId !== id) return
        throw error
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
        await next.dispose()
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
    const current = remote.value
    detach()
    if (current) await current.dispose()
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
      if (sessionId.value) await router.replace("/")
    }
  }

  const stopRouteSync = watch(sessionId, () => {
    if (initialized) void syncRoute()
  })

  async function initialize() {
    initialized = true
    await syncRoute()
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

  const { preset } = useChatInputBinding({
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
    const optimisticItem: UserTranscriptItem = {
      id: `optimistic-${sessionId.value}-${Date.now()}`,
      role: "user",
      content: [{ type: "text", text: normalized }],
      timestamp: Date.now(),
    }
    current.optimisticUser = {
      item: optimisticItem,
      knownItemIds: liveTranscript.value.map((item) => item.id),
    }
    current.draft = ""

    try {
      await submitRemote(normalized)
    } catch (error) {
      if (!current.draft) current.draft = text
      sessionError.value = errorMessage(error)
      throw error
    } finally {
      if (current.optimisticUser?.item.id === optimisticItem.id) current.optimisticUser = null
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

  /** 欢迎页首次 Prompt：创建 Session 后立即发送。 */
  async function createAndSubmit(nextCwd: string, text: string) {
    try {
      const nextId = await createSession(nextCwd)
      if (!nextId || sessionId.value !== nextId || remote.value?.id !== nextId) return
      await submitText(text)
    } finally {
      idleDraft.value = ""
    }
  }

  const transcript = computed(() =>
    projectOptimisticTranscript(liveTranscript.value, clientState.value?.optimisticUser ?? null),
  )
  const sessionCwd = computed(() => projection.value?.cwd ?? cwd.lastCwd.value)
  const projectedUsage = computed(() => projectContextUsage(contextUsageEstimate.value))

  pi.bindAttachedReconnect(async () => {
    if (remote.value) await reconnect()
    else await pi.client.value?.reconnect()
  })

  function teardown() {
    stopRouteSync()
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
