import { readonly, shallowRef } from "vue"
import { useRouter } from "vue-router"
import { t } from "@i18n/index.js"

export interface StartupSequenceOptions {
  connect: () => Promise<unknown>
  initialize: () => Promise<unknown>
  connectTimeoutMs?: number
}

const DEFAULT_CONNECT_TIMEOUT_MS = 30_000

function connectWithTimeout(connect: () => Promise<unknown>, ms: number): Promise<unknown> {
  const connecting = Promise.resolve(connect())

  if (ms <= 0) return connecting
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      void connecting.catch(() => {})
      reject(new Error(t("errors.startupTimeout")))
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
    const sessionRoute = routeHasSession(router)
    const connecting = connectWithTimeout(
      options.connect,
      options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    )
    const initializing = Promise.resolve(options.initialize()).then((value) => {
      if (!failed.value && sessionRoute) settled.value = true
      return value
    })

    try {
      await Promise.all([connecting, initializing])
      ready.value = true

      if (router.currentRoute.value.name === "error") await router.replace("/")
      settled.value = true
    } catch (error) {
      failed.value = true
      console.error("startup failed:", error)
      await router.replace({ name: "error" })
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
