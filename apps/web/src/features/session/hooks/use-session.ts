import { computed, getCurrentInstance, onBeforeUnmount, ref, watch, type ComputedRef } from "vue"
import type { ModelRef, ThinkingLevel } from "@/types/common-type.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { useGatewayClient } from "@client/gateway-connection.js"
import type { ComposerAttachmentBatch, SendAttachmentsHooks } from "@/types/attachment-type.js"
import { toastProgress, toastStatus } from "@pig/ui/toast"
import { errorMessage } from "@client/http.js"
import { t } from "@i18n/index.js"
import { isChangedElsewhere } from "@features/session/hooks/abortable-open.js"
import { dropBatch, stageBatch } from "@features/session/hooks/use-background-send.js"
import type { SessionHub } from "@features/session/hooks/use-session-hub.js"
import { useForegroundSession } from "@features/session/hooks/use-foreground-session.js"
import { projectContextUsage } from "@features/session/lib/context-usage.js"
import { sameModel, thinkingLevelOf } from "@features/session/lib/model-ref.js"
import {
  emptyClientState,
  handOffIdle,
  optimisticUserMessage,
  projectSessionSnapshot,
  sessionState,
} from "@features/session/lib/session-state.js"
import {
  NO_TOOL_STARTS,
  projectTranscriptTimeline,
  withNotices,
} from "@features/session/lib/transcript-timeline.js"
import type { PresetPort, SessionClientState } from "@features/session/type.js"
import { parseBuiltinCommand, type BuiltinCommand } from "@features/session/lib/builtin-command.js"

export interface SessionLifecycleOptions {
  hub: SessionHub
  sessionId: ComputedRef<string | undefined>
  navigate(id: string): void | Promise<unknown>
}

export function useSessionLifecycle(
  pi: ReturnType<typeof useGatewayClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
  options: SessionLifecycleOptions,
) {
  const { hub, sessionId } = options
  const {
    remote,
    state,
    live,
    release,
    ensureRemote,
    createRemoteSession,
    showHistory,
    leaveForeground,
    dispose,
    history,
    externalTurn,
    takeover,
    dropChanged,
    contextUsage: foregroundUsage,
  } = useForegroundSession(pi, sessionId, hub)
  const { backgroundRunningIds } = live
  const snapshot = computed(() => state.value?.snapshot)
  const liveTranscript = history.liveTranscript

  async function submitRemote(text: string, attachmentBatch?: string) {
    await remote.value?.submit(text, attachmentBatch ? { attachmentBatch } : undefined)
  }

  async function stageAttachments(
    batch: ComposerAttachmentBatch,
    thread: SessionClientState,
    epoch: number,
  ) {
    return stageBatch(batch, () => epoch !== thread.epoch)
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

  let initialized = false

  function syncRoute() {
    const id = sessionId.value

    if (!id) return leaveForeground()
    showHistory(id)
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

    if (!id) return leaveForeground()
    history.setActive(id)
    showHistory(id)
  }

  const sessionPending = computed(() => {
    const id = sessionId.value

    if (!id) return false
    return history.historyReadyId.value !== id
  })
  const historyFailed = computed(
    () => !!sessionId.value && history.historyFailedId.value === sessionId.value,
  )

  function retryHistory() {
    const id = sessionId.value
    return id ? history.refreshHistory(id) : Promise.resolve()
  }
  const projection = computed(() => {
    const current = snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined
    return !sessionId.value || current?.id === sessionId.value ? current : undefined
  })
  const phase = computed(() => projection.value?.phase)
  const running = computed(() => projection.value?.running ?? false)
  const contextUsage = computed(() => projectContextUsage(foregroundUsage.value))
  let presetPort: PresetPort | undefined
  const { states } = hub
  const idleState = emptyClientState()
  const creatingCwd = ref<string>()
  const pendingSessionId = ref<string>()
  let welcomeHandoff: ((id: string) => void) | undefined
  const clientState = computed(() => {
    const id = sessionId.value ?? pendingSessionId.value
    return id ? sessionState(states, id) : idleState
  })
  const reloadRevision = ref(0)
  const submitting = computed(() => clientState.value.submitting)
  const aborting = computed(() => clientState.value.aborting)
  const prompt = computed({
    get: () => clientState.value.draft,
    set: (value: string) => {
      clientState.value.draft = value
    },
  })

  function setPresetPort(port?: PresetPort) {
    presetPort = port
  }

  function setWelcomeHandoff(fn?: (id: string) => void) {
    welcomeHandoff = fn
  }

  async function createSession(nextCwd: string) {
    if (creatingCwd.value) return
    const epoch = idleState.epoch
    const routeSessionAtStart = sessionId.value
    creatingCwd.value = nextCwd

    try {
      const nextId = await createRemoteSession(nextCwd, presetPort?.createModel())

      if (epoch !== idleState.epoch) {
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
      pendingSessionId.value = nextId
      handOffIdle(states, nextId, idleState)
      welcomeHandoff?.(nextId)

      if (nextId !== sessionId.value) {
        await options.navigate(nextId)
      }

      return nextId
    } finally {
      creatingCwd.value = undefined
      pendingSessionId.value = undefined
    }
  }

  async function runBuiltin(
    command: BuiltinCommand,
    thread: SessionClientState,
    options?: { preserveDraft?: boolean },
  ) {
    const id = sessionId.value
    const previousDraft = thread.draft

    if (!id) return false
    thread.submitting = true

    if (!options?.preserveDraft) thread.draft = ""

    let reloadProgress: ReturnType<typeof toastProgress> | undefined

    try {
      await ensureRemote(id)

      if (remote.value?.id !== id) throw new Error("会话未连接")

      if (command.name === "compact") await remote.value.compact(command.instructions)
      else {
        reloadProgress = toastProgress(t("session.reloading"))
        await remote.value.reload()
        reloadRevision.value += 1
        reloadProgress.finish({ message: t("session.reloaded"), tone: "success" })
      }

      return true
    } catch (error) {
      if (!options?.preserveDraft && !thread.draft) thread.draft = previousDraft
      const message = errorMessage(error)

      if (reloadProgress) reloadProgress.finish({ message, tone: "error" })
      else toastStatus(message, { tone: "error" })
      return false
    } finally {
      thread.submitting = false
    }
  }

  async function sendPrompt(
    text: string,
    cwd?: string,
    attachments?: ComposerAttachmentBatch,
    hooks?: SendAttachmentsHooks,
    options?: { preserveDraft?: boolean },
  ): Promise<boolean> {
    const normalized = text.trim()
    let thread = clientState.value

    if ((!normalized && !attachments) || thread.submitting) return false

    const builtin = sessionId.value ? parseBuiltinCommand(normalized) : undefined

    if (builtin && attachments) {
      const message = t("composer.builtinNoAttachments")

      if (hooks?.onInlineError) hooks.onInlineError(message)
      else toastStatus(message, { tone: "warning" })
      return false
    }

    if (builtin) return runBuiltin(builtin, thread, options)

    if (!sessionId.value && (!cwd || creatingCwd.value)) return false
    const epoch = ++thread.epoch

    thread.submitting = true
    const previousDraft = thread.draft
    const send = optimisticUserMessage(
      normalized,
      liveTranscript.value.map((item) => item.id),
    )

    thread.sends.push(send)

    if (!options?.preserveDraft) thread.draft = ""

    try {
      if (!sessionId.value) {
        const nextId = await createSession(cwd!)

        if (nextId) thread = sessionState(states, nextId)

        if (epoch !== thread.epoch) return false

        if (!nextId || sessionId.value !== nextId || remote.value?.id !== nextId) return false
      } else {
        const id = sessionId.value
        const chosen = presetPort?.consumeDetachedEdit()
        await ensureRemote(id)

        if (epoch !== thread.epoch || sessionId.value !== id) return false

        if (remote.value?.id !== id) throw new Error("会话未连接")

        if (chosen && snapshot.value) {
          if (!sameModel(chosen.model, snapshot.value.model)) await setModel(chosen.model)

          if (chosen.thinkingLevel !== snapshot.value.thinkingLevel)
            await setThinking(thinkingLevelOf(chosen.thinkingLevel))
        }
      }

      if (epoch !== thread.epoch || remote.value?.id !== sessionId.value) return false

      if (attachments && !(await stageAttachments(attachments, thread, epoch))) {
        await dropBatch(attachments)
        hooks?.onStageDropped?.()
        return false
      }

      if (epoch !== thread.epoch || remote.value?.id !== sessionId.value) {
        await dropBatch(attachments)
        hooks?.onStageDropped?.()
        return false
      }

      if (attachments) hooks?.onDispatched?.()
      await submitRemote(normalized, attachments?.batch)
      return true
    } catch (error) {
      await dropBatch(attachments)

      if (epoch !== thread.epoch) return false

      if (!options?.preserveDraft && !thread.draft) thread.draft = previousDraft || text
      const index = thread.sends.findIndex((item) => item.item.id === send.item.id)

      if (index >= 0) thread.sends.splice(index, 1)

      if (isChangedElsewhere(error) && sessionId.value) {
        dropChanged(sessionId.value)
        toastStatus(t("session.changedElsewhere"), { tone: "info" })
      }

      throw error
    } finally {
      if (epoch === thread.epoch) thread.submitting = false
    }
  }

  async function steer(text: string): Promise<boolean> {
    const normalized = text.trim()
    const id = sessionId.value

    if (!normalized || !id || !running.value) return false
    await ensureRemote(id)

    if (sessionId.value !== id || remote.value?.id !== id) return false
    await remote.value.steer(normalized)
    return true
  }

  async function abortSession() {
    const thread = clientState.value

    thread.epoch += 1
    thread.submitting = false

    if (!remote.value) thread.sends = []

    if (thread.aborting) return
    thread.aborting = true

    try {
      await abortRemote()
    } catch (error) {
      toastStatus(errorMessage(error), { tone: "error" })
    } finally {
      thread.aborting = false
    }
  }

  const tasks = computed(() => snapshot.value?.tasks ?? [])

  async function stopTask(taskId: string) {
    await remote.value?.stopTask(taskId)
  }

  const turnPending = computed(() => submitting.value || running.value)
  const transcript = computed(() => {
    const id = history.activeId.value
    const items = projectTranscriptTimeline({
      ...history.timelineSource(id),
      optimisticSends: clientState.value.sends,
      turnPending: turnPending.value,
      toolStartedAt: id ? live.toolStartedAtFor(id) : NO_TOOL_STARTS,
    })
    const current = snapshot.value
    return withNotices(items, current && current.id === id ? current.notices : [])
  })
  const sessionCwd = computed(
    () =>
      projection.value?.cwd ??
      pi.sessions.value.find((item) => item.id === sessionId.value)?.cwd ??
      (sessionId.value ? undefined : cwd.lastCwd.value),
  )
  const welcome = computed(() => {
    if (transcript.value.length > 0 || running.value) return false

    if (sessionId.value === undefined) return true

    if (sessionPending.value && !creatingCwd.value) return false
    return true
  })

  const historyError = computed(() =>
    sessionId.value ? history.errorFor(sessionId.value) : undefined,
  )

  function teardown() {
    stopRouteSync()
    stopClientSync()
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
    sessionPending,
    historyFailed,
    retryHistory,
    connected: pi.connected,
    connectionError: pi.connectionError,
    reconnecting: pi.reconnecting,
    reconnectFailed: pi.reconnectFailed,
    reconnectNow: pi.reconnectNow,
    historyError,
    transcript,
    welcome,
    loadHistory: history.loadHistory,
    historyFresh: history.isFresh,
    turnTimings: history.turnTimings,
    sessionCwd,
    contextUsage,
    tasks,
    stopTask,
    snapshot,
    setModel,
    setThinking,
    setPresetPort,
    prompt,
    clientState,
    creating: creatingCwd,
    submitting,
    aborting,
    createSession,
    sendPrompt,
    steer,
    setWelcomeHandoff,
    transcriptFor: history.transcriptFor,
    externalTurn,
    takeover,
    abortSession,
    reloadRevision,
    initialize,
    remote,
    teardown,
  }
}
