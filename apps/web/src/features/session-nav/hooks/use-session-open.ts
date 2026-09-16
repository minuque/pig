import { computed, nextTick, shallowRef, watch, type Ref } from "vue"
import type { Router } from "vue-router"

function afterPaint(): Promise<void> {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis)

  if (raf) {
    return new Promise((resolve) => {
      raf(() => raf(() => resolve()))
    })
  }

  return new Promise((resolve) => setTimeout(resolve, 0))
}

export function useSessionOpen(sessionId: Ref<string | undefined>, router: Pick<Router, "push">) {
  const pendingSessionId = shallowRef<string>()
  const highlightedSessionId = computed(() => pendingSessionId.value ?? sessionId.value)
  let openToken = 0

  function pushSession(id: string) {
    void router.push({ name: "session", params: { sessionId: id } })
  }

  function openSession(id: string) {
    void import("@features/transcript-view/index.vue")

    if (id === sessionId.value) {
      cancelPendingOpen()
      return
    }

    pendingSessionId.value = id
    const token = ++openToken
    void nextTick(async () => {
      await afterPaint()

      if (token !== openToken || pendingSessionId.value !== id) return
      pushSession(id)
    })
  }

  function cancelPendingOpen() {
    openToken += 1
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
