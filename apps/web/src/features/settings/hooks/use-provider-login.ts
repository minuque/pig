import { onBeforeUnmount, ref } from "vue"

import { errorMessage } from "@client/http.js"
import { cancelLogin, loginProvider, openLoginEvents, respondLogin } from "@client/platform.js"
import { t } from "@i18n/index.js"
import {
  addedLoginUrl,
  endLoginStream,
  initialLoginState,
  reduceLoginEvents,
  type LoginState,
} from "@features/settings/lib/provider-login.js"

export function useProviderLogin(providerId: () => string, onDone: () => void) {
  const state = ref<LoginState>(initialLoginState())
  const starting = ref(false)
  let loginId: string | undefined
  let events: AbortController | undefined
  let answered = false

  async function start(type: "api_key" | "oauth", apiKey?: string) {
    cancel()
    state.value = { ...initialLoginState(), phase: "running" }
    starting.value = true
    answered = false

    try {
      const started = await loginProvider({ providerId: providerId(), type })

      loginId = started.loginId
      events = new AbortController()
      await openLoginEvents(
        loginId,
        0,
        (event) => {
          const previous = state.value
          state.value = reduceLoginEvents(previous, event)
          const url = addedLoginUrl(previous, state.value)

          // 外部：桌面壳会把 window.open 的地址转给默认浏览器
          if (url) window.open(url, "_blank", "noopener,noreferrer")

          if (event.type === "prompt" && apiKey !== undefined && !answered) {
            answered = true
            void respondLogin(loginId!, apiKey)
          }

          if (event.type === "done") onDone()

          if (event.type === "done" || event.type === "error") events?.abort()
        },
        events.signal,
      )
      state.value = endLoginStream(state.value, t("settings.models.loginInterrupted"))
    } catch (error) {
      if (isAbort(error)) return
      state.value = { ...state.value, phase: "error", error: errorMessage(error) }
    } finally {
      starting.value = false
    }
  }

  async function answer(value: string) {
    if (!loginId) return

    try {
      await respondLogin(loginId, value)
      state.value = { ...state.value, prompt: null }
    } catch (error) {
      state.value = { ...state.value, phase: "error", error: errorMessage(error) }
    }
  }

  function cancel() {
    if (loginId) void cancelLogin(loginId).catch(() => undefined)
    loginId = undefined
    events?.abort()
    events = undefined
  }

  function reset() {
    cancel()
    state.value = initialLoginState()
  }

  onBeforeUnmount(cancel)
  return { state, starting, start, answer, cancel, reset }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
