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
import type { ModelRef, RemoteSessionState, ThinkingLevel } from "@/types/common-type.js"
import { errorMessage } from "@client/http.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { ComposerAttachmentBatch } from "@features/composer/hooks/use-composer-attachments.js"
import { useSessionComposer } from "@features/composer/index.js"
import { sameModel, thinkingLevelOf } from "@features/composer/lib/model-preset.js"
import {
  createBackgroundSender,
  dropBatch,
  stageBatchFor,
} from "@features/session-workbench/hooks/use-background-send.js"
import { useSessionHistory } from "@features/session-workbench/hooks/use-session-history.js"
import {
  createAbortableOpen,
  isDisconnectedError,
  isOpenAborted,
} from "@features/session-workbench/hooks/abortable-open.js"
import {
  useLiveSubscriptions,
  type LiveSubscription,
} from "@features/session-workbench/hooks/use-live-subscriptions.js"
import {
  bindIdleSends,
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
  let activeSub: LiveSubscription | undefined
  let replaceChain: Promise<void> = Promise.resolve()
  let abortInflightOpen: (() => void) | undefined
  const { raceRemoteOpen, discard } = createAbortableOpen()
  const history = useSessionHistory()
  const live = useLiveSubscriptions({
    history,
    discard,
    foregroundId: () => remote.value?.id,
    onForegroundState: (next) => {
      state.value = next
    },
  })
  const { backgroundRunningIds } = live
  const snapshot = computed(() => state.value?.snapshot)
  const liveTranscript = history.liveTranscript

  /** 后台池命中就把该会话挂回前台，复用同一条连接。 */
  function promote(id: string) {
    const sub = live.promoteBackground(id)

    if (!sub) return false
    activeSub = sub
    remote.value = sub.session

    if (sub.lastState) state.value = sub.lastState
    return true
  }

  function clearForeground() {
    live.clearContextUsage()
    remote.value = undefined
    state.value = undefined
  }

  function attach(next: RemoteSession) {
    const previous = remote.value

    detach()

    if (previous && previous !== next) void discard(previous)
    activeSub = live.subscribeLive(next, true)
    remote.value = next
  }

  function detach() {
    const id = remote.value?.id

    if (id) history.releaseLive(id)
    activeSub?.stop()
    activeSub = undefined
    clearForeground()
  }

  /** 切走前台会话：还在运行就转入后台订阅池，空闲则放弃连接。 */
  function release() {
    const previous = remote.value
    const sub = activeSub
    const id = previous?.id

    if (sub && id && sub.running) {
      live.moveToBackground(sub)
      activeSub = undefined
      clearForeground()
      return
    }

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

  function showHistory(id: string) {
    if (history.activeId.value !== id) abortInflightOpen?.()
    history.setActive(id)
    void history.loadHistory(id)

    if (remote.value?.id === id) return
    abortInflightOpen?.()
    release()
    promote(id)
  }

  function ensureRemote(id: string) {
    if (remote.value?.id === id) return Promise.resolve()
    return enqueueReplace(async () => {
      if (history.activeId.value !== id || remote.value?.id === id || !pi.client.value) return
      release()

      if (promote(id)) return

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

  /**
   * 顺序暂存每个文件字节，再把 batch 绑到当前 Session；下一次 prompt 消费它。
   * 每次 await 后查 epoch：被中止或切走就返回 false，由调用方丢弃这个批次。
   */
  async function stageAttachments(batch: ComposerAttachmentBatch, epoch: number) {
    const id = sessionId.value

    if (!id) throw new Error("会话未连接")
    return stageBatchFor(id, batch, () => epoch !== sendEpoch || sessionId.value !== id)
  }

  /** 接管后台会话空闲后的泵队与收尾；不注册就直接出池。 */
  const setBackgroundIdleHandler = live.setBackgroundIdle

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
    const pooled = live.takeBackground()

    detach()

    for (const sub of pooled) await discard(sub.session)

    if (current) await discard(current)
  }

  let initialized = false

  function syncRoute() {
    const id = sessionId.value

    if (!id) return dispose()
    showHistory(id)
  }

  const stopRouteSync = watch(sessionId, () => {
    if (initialized) void syncRoute()
  })
  const stopClientSync = watch(
    () => pi.connected.value,
    (connected) => {
      if (!connected) live.dropBackground()

      if (initialized && connected) void syncRoute()
    },
  )

  async function initialize() {
    initialized = true
    const id = sessionId.value

    if (id) history.setActive(id)
    else await dispose()

    if (id) showHistory(id)
  }

  const sessionPending = computed(() => {
    const id = sessionId.value

    if (!id) return false
    return history.historyReadyId.value !== id
  })
  const projection = computed(() => {
    const current = snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined
    return !sessionId.value || current?.id === sessionId.value ? current : undefined
  })
  const phase = computed(() => projection.value?.phase)
  const running = computed(() => projection.value?.running ?? false)
  const phaseText = computed(() => (running.value && phase.value ? phaseLabel(phase.value) : ""))
  const { catalog, preset, usage, createModel, consumeDetachedEdit } = useSessionComposer({
    models: pi.models,
    snapshot,
    phase,
    estimate: live.contextUsage,
    setModel,
    setThinking,
  })
  const states = reactive(new Map<string, ReturnType<typeof sessionState>>())
  const idleState = reactive<SessionClientState>({ draft: "", sends: [] })
  const backgroundSend = createBackgroundSender({
    states,
    backgroundSubscription: live.backgroundSubscription,
    transcriptFor: history.transcriptFor,
  })
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
      const nextId = await createRemoteSession(nextCwd, createModel())

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

  /**
   * 附件随这次提交走：先确保 Session 存在，再 stage + bind，最后提交正文。
   * 只有真正提交成功才返回 true；被中止、切走或提前退出都返回 false。
   */
  async function sendPrompt(
    text: string,
    cwd?: string,
    attachments?: ComposerAttachmentBatch,
  ): Promise<boolean> {
    const normalized = text.trim()

    if (!normalized || submitting.value) return false

    if (!sessionId.value && (!cwd || creatingCwd.value)) return false
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

        if (epoch !== sendEpoch) return false

        if (!nextId || sessionId.value !== nextId || remote.value?.id !== nextId) return false
      } else {
        const id = sessionId.value
        const chosen = consumeDetachedEdit()
        await ensureRemote(id)

        if (epoch !== sendEpoch || sessionId.value !== id) return false

        if (remote.value?.id !== id) throw new Error("会话未连接")

        if (chosen && snapshot.value) {
          if (!sameModel(chosen.model, snapshot.value.model)) await setModel(chosen.model)

          if (chosen.thinkingLevel !== snapshot.value.thinkingLevel)
            await setThinking(thinkingLevelOf(chosen.thinkingLevel))
        }
      }

      if (epoch !== sendEpoch || remote.value?.id !== sessionId.value) return false

      if (attachments && !(await stageAttachments(attachments, epoch))) {
        await dropBatch(attachments.batch)
        return false
      }

      if (epoch !== sendEpoch || remote.value?.id !== sessionId.value) {
        await dropBatch(attachments?.batch)
        return false
      }

      await submitRemote(normalized)
      return true
    } catch (error) {
      await dropBatch(attachments?.batch)

      if (epoch !== sendEpoch) return false
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
    backgroundRunningIds,
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
    contextUsage: usage,
    catalog,
    preset,
    prompt,
    clientState,
    sessionError,
    creating: creatingCwd,
    aborting,
    createSession,
    sendPrompt,
    sendBackgroundPrompt: backgroundSend.send,
    setBackgroundIdleHandler,
    transcriptFor: history.transcriptFor,
    abortSession,
    initialize,
    remote,
    dispose,
    teardown,
  }
}
