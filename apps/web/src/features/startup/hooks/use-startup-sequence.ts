import { readonly, shallowRef } from "vue"
import { useRouter } from "vue-router"
import { errorMessage } from "@client/http.js"
import { setStartupError } from "@features/startup/hooks/use-startup-error.js"

export interface StartupSequenceOptions {
  connect: () => Promise<unknown>
  initialize: () => Promise<unknown>
  /** 连接网关超时，超时视为启动失败并进 `/error`。0 表示不等待超时。 */
  connectTimeoutMs?: number
}

const DEFAULT_CONNECT_TIMEOUT_MS = 30_000

function connectWithTimeout(connect: () => Promise<unknown>, ms: number): Promise<unknown> {
  const connecting = Promise.resolve(connect())
  if (ms <= 0) return connecting
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      void connecting.catch(() => {})
      reject(new Error("连接网关超时"))
    }, ms)
    connecting.then(
      (value) => {
        globalThis.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        globalThis.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function routeHasSession(router: ReturnType<typeof useRouter>): boolean {
  const raw = router.currentRoute.value.params.sessionId
  return typeof raw === "string" && raw.length > 0
}

/**
 * 启动序列：connect 与 initialize 并行，与毛玻璃遮罩并行。
 * 有 sessionId 时 initialize 完成即可揭开；欢迎页等连接结束。失败进 `/error`。
 */
export function useStartupSequence(options: StartupSequenceOptions) {
  const router = useRouter()
  const visible = shallowRef(true)
  const settled = shallowRef(false)
  const ready = shallowRef(false)
  const failed = shallowRef(false)

  function finish() {
    visible.value = false
  }

  async function start() {
    const connecting = connectWithTimeout(
      options.connect,
      options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    )
    const initializing = Promise.resolve(options.initialize())
    void initializing.then(() => {
      if (!failed.value && routeHasSession(router)) settled.value = true
    })
    try {
      await Promise.all([connecting, initializing])
      ready.value = true
      if (router.currentRoute.value.name === "error") await router.replace("/")
    } catch (error) {
      failed.value = true
      setStartupError(error instanceof Error && error.message ? error.message : errorMessage(error))
      await router.replace({ name: "error" })
    } finally {
      settled.value = true
    }
  }

  return {
    visible: readonly(visible),
    settled: readonly(settled),
    ready: readonly(ready),
    failed: readonly(failed),
    finish,
    start,
  }
}
