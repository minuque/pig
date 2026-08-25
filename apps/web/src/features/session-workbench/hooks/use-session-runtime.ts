import { computed, markRaw, reactive, ref, type Ref } from "vue"
import type { Router } from "vue-router"
import type { MarkstreamThreadVirtualState } from "markstream-vue"
import type { UserTranscriptItem } from "@earendil-works/pi-protocol"
import { errorMessage } from "@client/http.js"
import { thinkingLevelOf, type ChatInputPreset } from "@features/chat-input/types.js"
import {
  sessionState,
  type SessionClientState,
} from "@features/session-workbench/lib/session-state.js"
import type { useRemoteSessions } from "@features/session-workbench/hooks/use-sessions.js"

interface SessionRuntimeOptions {
  remote: ReturnType<typeof useRemoteSessions>
  sessionId: Ref<string | undefined>
  router: Router
  preset: Ref<ChatInputPreset | undefined>
  sessionError: Ref<string>
  selectCwd(cwd: string): void
}

/** 当前 Session 的 UI 运行时：草稿/滚动、创建/发送/中止。 */
export function useSessionRuntime(options: SessionRuntimeOptions) {
  const { remote, sessionId, router, preset, sessionError, selectCwd } = options
  const states = reactive(new Map<string, SessionClientState>())
  const creatingCwd = ref<string>()
  const submitting = ref(false)
  const aborting = ref(false)

  const clientState = computed(() => {
    const id = sessionId.value
    return id ? sessionState(states, id) : undefined
  })
  const prompt = computed({
    get: () => clientState.value?.draft ?? "",
    set: (value: string) => {
      if (clientState.value) clientState.value.draft = value
    },
  })

  function applyThreadState(threadState: MarkstreamThreadVirtualState) {
    const id = threadState.threadKey ?? sessionId.value
    if (!id) return
    sessionState(states, id).threadState = markRaw(threadState)
  }

  async function createSession(cwd: string) {
    if (creatingCwd.value) return
    creatingCwd.value = cwd
    sessionError.value = ""
    try {
      const next = preset.value
      await remote.createSession(
        cwd,
        next
          ? { model: next.model, thinkingLevel: thinkingLevelOf(next.thinkingLevel) }
          : undefined,
      )
      selectCwd(cwd)
      const nextId = remote.remote.value?.id
      if (nextId && nextId !== sessionId.value) {
        await router.push({ name: "session", params: { sessionId: nextId } })
      }
    } catch (error) {
      sessionError.value = errorMessage(error)
      throw error
    } finally {
      creatingCwd.value = undefined
    }
  }

  async function submitText(text: string) {
    const state = clientState.value
    const normalized = text.trim()
    if (!state || !normalized || submitting.value) return

    submitting.value = true
    sessionError.value = ""
    const optimisticItem: UserTranscriptItem = {
      id: `optimistic-${sessionId.value}-${Date.now()}`,
      role: "user",
      content: [{ type: "text", text: normalized }],
      timestamp: Date.now(),
    }
    state.optimisticUser = {
      item: optimisticItem,
      knownItemIds: remote.transcript.value.map((item) => item.id),
    }
    state.draft = ""

    try {
      await remote.submit(normalized)
    } catch (error) {
      if (!state.draft) state.draft = text
      sessionError.value = errorMessage(error)
      throw error
    } finally {
      if (state.optimisticUser?.item.id === optimisticItem.id) state.optimisticUser = null
      submitting.value = false
    }
  }

  async function abortSession() {
    if (aborting.value) return
    aborting.value = true
    try {
      await remote.abort()
    } catch (error) {
      sessionError.value = errorMessage(error)
    } finally {
      aborting.value = false
    }
  }

  return {
    creating: creatingCwd,
    aborting,
    clientState,
    prompt,
    applyThreadState,
    createSession,
    submitText,
    abortSession,
  }
}
