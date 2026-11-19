import { watch, type Ref, type ShallowRef } from "vue"

/** 按需订阅会话文件只需要这三件事；测试给替身，不必造整条连接。 */
export interface SessionFileWatchClient {
  watchSession(sessionId: string): unknown
  unwatchSession(sessionId: string): unknown
  onSessionFileChanged(sessionId: string, listener: () => void): () => void
}

export interface SessionFileWatchInput {
  client: Readonly<ShallowRef<SessionFileWatchClient | undefined>>
  connected: Readonly<Ref<boolean>>
  /** 这一侧显示的会话。 */
  sessionId: Readonly<Ref<string | undefined>>
  /** 这一侧挂着的连接；跟显示会话相同时不用 watch。 */
  attached: Readonly<Ref<string | undefined>>
  /** 后台池里已有订阅：live 覆盖会自己更新，不必 watch。 */
  pooled(id: string): boolean
  /** 文件变了（以及刚订阅上时补拉一次）；调用方重拉历史。 */
  changed(id: string): void
}

/**
 * 显示中且这一侧没挂连接：向 Gateway 按需 watch 会话文件，外部进程追加时收到一次通知。
 * 切走、挂上连接或断开都退订；重连后重新订阅并补拉一次，堵住断线期间的窗口。
 */
export function useSessionFileWatch(input: SessionFileWatchInput) {
  let watching: string | undefined
  let stopListening: (() => void) | undefined

  function stop() {
    stopListening?.()
    stopListening = undefined

    if (!watching) return
    input.client.value?.unwatchSession(watching)
    watching = undefined
  }

  function start(id: string) {
    const client = input.client.value

    if (!client) return
    watching = id
    stopListening = client.onSessionFileChanged(id, () => input.changed(id))
    void client.watchSession(id)
    input.changed(id)
  }

  function sync() {
    const id = input.sessionId.value
    const target =
      id && input.connected.value && input.attached.value !== id && !input.pooled(id)
        ? id
        : undefined

    if (target === watching) return
    stop()

    if (target) start(target)
  }

  const stopSync = watch([input.client, input.connected, input.attached, input.sessionId], sync, {
    immediate: true,
  })
  return {
    stop: () => {
      stopSync()
      stop()
    },
  }
}
