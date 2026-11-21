import { watch, type Ref, type ShallowRef } from "vue"

export interface SessionFileWatchClient {
  watchSession(sessionId: string): unknown
  unwatchSession(sessionId: string): unknown
  onSessionFileChanged(sessionId: string, listener: () => void): () => void
}

export interface SessionFileWatchInput {
  client: Readonly<ShallowRef<SessionFileWatchClient | undefined>>
  connected: Readonly<Ref<boolean>>
  sessionId: Readonly<Ref<string | undefined>>
  attached: Readonly<Ref<string | undefined>>
  pooled(id: string): boolean
  changed(id: string): void
}

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
