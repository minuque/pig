import { computed, shallowRef, toValue, type MaybeRefOrGetter } from "vue"
import type { PiClient, Unsubscribe } from "@earendil-works/pi-client"
import { RemoteSession } from "@earendil-works/pi-coding-agent/client"
import type { RemoteSessionState } from "@earendil-works/pi-coding-agent/client"
import type { ModelRef, ThinkingLevel, TranscriptItem } from "@earendil-works/pi-protocol"
import { contextUsage, sessionTranscript, type ContextUsageEstimate } from "@client/platform.js"
import {
  mergeLiveTranscript,
  projectSessionSnapshot,
  type SessionProjection,
} from "@features/session-workbench/lib/session-state.js"

export interface CreateSessionInput {
  cwd: string
  model?: ModelRef
  thinkingLevel?: ThinkingLevel
}

/**
 * 围绕官方 RemoteSession 的组合式状态：
 * create/open 附加会话，submit/abort/setModel/setThinking 转发官方实例，
 * Snapshot/Transcript 经 RemoteSessionState 投影为 UI 可读视图。
 * SDK 实例用 shallowRef 保存（不深追踪），纯派生用 computed。
 */
export function useRemoteSessions(clientSource: MaybeRefOrGetter<PiClient | undefined>) {
  const client = computed(() => toValue(clientSource))
  // SDK 实例仅存引用，不响应式深追踪
  const remote = shallowRef<RemoteSession>()
  const state = shallowRef<RemoteSessionState>()
  let unsubscribeState: Unsubscribe | undefined
  let disposePromise: Promise<void> | undefined
  // 替换操作串行化：同一时刻至多一个 open/create，避免并发 lease
  let replaceChain: Promise<void> = Promise.resolve()
  // 最新想打开的 session：快速连点时跳过中间 id，只落地最后一次
  let wantedId: string | undefined
  const contextUsageEstimate = shallowRef<ContextUsageEstimate>()
  let contextUsageRequest = 0
  const history = shallowRef<TranscriptItem[]>([])
  const historySessionId = shallowRef<string>()
  const heldLive = shallowRef<TranscriptItem[]>([])
  let historyRequest = 0

  // 纯派生：由上述状态 computed 得到
  const snapshot = computed(() => state.value?.snapshot)
  const projection = computed<SessionProjection | undefined>(() =>
    snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined,
  )
  const transcript = computed(() => {
    const live = state.value?.transcript ?? []
    const overlay = live.length > 0 ? live : heldLive.value
    const persisted = historySessionId.value === wantedId ? history.value : []
    return mergeLiveTranscript(persisted, overlay)
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
      if (nextState.transcript.length > 0) heldLive.value = [...nextState.transcript]
      const revision = nextState.snapshot?.revision
      const sessionId = next.id
      if (revision !== undefined && revision !== usageRevision && sessionId) {
        usageRevision = revision
        void refreshContextUsage(sessionId)
        void loadHistory(sessionId)
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
      historySessionId.value = undefined
    }
    heldLive.value = []
  }

  async function loadHistory(sessionId: string) {
    const request = ++historyRequest
    try {
      const items = await sessionTranscript(sessionId)
      if (request !== historyRequest || wantedId !== sessionId) return
      history.value = items
      historySessionId.value = sessionId
    } catch {
      if (request !== historyRequest || wantedId !== sessionId) return
      if (historySessionId.value !== sessionId) {
        history.value = []
        historySessionId.value = sessionId
      }
    }
  }

  async function refreshContextUsage(sessionId: string | undefined) {
    if (!sessionId) return
    const request = ++contextUsageRequest
    try {
      const usage = await contextUsage(sessionId)
      if (request !== contextUsageRequest || remote.value?.id !== sessionId) return
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
  async function openSession(sessionId: string) {
    wantedId = sessionId
    if (historySessionId.value !== sessionId) {
      history.value = []
      heldLive.value = []
      historySessionId.value = undefined
    }
    void loadHistory(sessionId)
    return enqueueReplace(async () => {
      if (wantedId !== sessionId) return
      if (remote.value?.id === sessionId) return
      const target = client.value
      if (!target) throw new Error("PiClient 未连接")
      release()
      try {
        const next = await RemoteSession.open(target, sessionId)
        if (wantedId !== sessionId) {
          await next.dispose()
          return
        }
        attach(next)
      } catch (error) {
        if (wantedId !== sessionId) return
        throw error
      }
    })
  }

  /** 在指定 cwd 创建新 Session（cwd 来自本地 Workspace preference）。 */
  async function createSession(cwd: string, options?: Omit<CreateSessionInput, "cwd">) {
    return enqueueReplace(async () => {
      const target = client.value
      if (!target) throw new Error("PiClient 未连接")
      const next = await RemoteSession.create(target, {
        cwd,
        ...(options?.model !== undefined ? { model: options.model } : {}),
        ...(options?.thinkingLevel !== undefined ? { thinkingLevel: options.thinkingLevel } : {}),
      })
      wantedId = next.id
      attach(next)
    })
  }

  /** 提交输入。Web UI 仅在 idle 时调用。 */
  async function submit(text: string) {
    await remote.value?.submit(text)
  }
  async function abort() {
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
    if (disposePromise) return disposePromise
    const current = remote.value
    detach()
    disposePromise = current?.dispose() ?? Promise.resolve()
    return disposePromise
  }

  return {
    remote,
    state,
    snapshot,
    projection,
    transcript,
    contextUsageEstimate,
    openSession,
    createSession,
    submit,
    abort,
    setModel,
    setThinking,
    reconnect,
    dispose,
    historySessionId,
  }
}
