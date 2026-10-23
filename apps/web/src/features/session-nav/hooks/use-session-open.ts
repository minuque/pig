import { computed, nextTick, shallowRef, watch, type Ref } from "vue"
import type { Router } from "vue-router"

function afterPaint(): Promise<void> {
  /* 后台页面 rAF 被冻结，等绘制没意义且会把跳转饿死；直接推进。 */
  if (typeof document !== "undefined" && document.visibilityState === "hidden")
    return Promise.resolve()

  const raf = globalThis.requestAnimationFrame?.bind(globalThis)
  const setT = globalThis.setTimeout
  const clearT = globalThis.clearTimeout

  if (raf) {
    return new Promise((resolve) => {
      /* rAF 在偶发后台/被遮挡时也可能不回来，计时兜底防饿死。 */
      const timer = setT(resolve, 120)
      raf(() =>
        raf(() => {
          clearT(timer)
          resolve()
        }),
      )
    })
  }

  return new Promise((resolve) => setT(resolve, 0))
}

export function useSessionOpen(
  sessionId: Ref<string | undefined>,
  router: Pick<Router, "push">,
  loadHistory?: (id: string) => Promise<unknown>,
) {
  const pendingSessionId = shallowRef<string>()
  const highlightedSessionId = computed(() => pendingSessionId.value ?? sessionId.value)
  let openToken = 0

  function pushSession(id: string) {
    void router.push({ name: "session", params: { sessionId: id } })
  }

  /** 按下即拉历史，与双 rAF 空窗重叠；fresh 不发网，同 id 在飞共用请求。 */
  function primeSession(id: string) {
    if (id === sessionId.value || !loadHistory) return
    void loadHistory(id)
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
  return { highlightedSessionId, openSession, cancelPendingOpen, primeSession }
}
