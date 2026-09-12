import { computed, shallowRef, watch, type Ref } from "vue"
import type { Router } from "vue-router"

export function useSessionOpen(sessionId: Ref<string | undefined>, router: Pick<Router, "push">) {
  const pendingSessionId = shallowRef<string>()
  const highlightedSessionId = computed(() => pendingSessionId.value ?? sessionId.value)

  function pushSession(id: string) {
    void router.push({ name: "session", params: { sessionId: id } })
  }

  function openSession(id: string) {
    if (id === sessionId.value) {
      cancelPendingOpen()
      return
    }
    pendingSessionId.value = id
    pushSession(id)
  }

  function cancelPendingOpen() {
    const pending = pendingSessionId.value
    pendingSessionId.value = undefined
    if (!pending) return
    const current = sessionId.value
    // 再 push 当前路由以取消未完成跳转
    if (current) pushSession(current)
    else void router.push("/")
  }

  watch(sessionId, () => {
    pendingSessionId.value = undefined
  })

  return { highlightedSessionId, openSession, cancelPendingOpen }
}
