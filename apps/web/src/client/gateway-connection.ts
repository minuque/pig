import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"

import type { ServerSnapshot } from "@/types/common-type.js"
import { t } from "@i18n/index.js"

import {
  GatewayClient,
  mergeWorkspaceGit,
  type ConnectionState,
  type Unsubscribe,
} from "@client/gateway-client.js"
import { applyRemotePreferences, hydratePreferences } from "@client/preferences.js"
import { applyRemoteSessionArchives, hydrateSessionArchives } from "@client/session-archives.js"
import { webSocketUrl } from "@client/transport.js"
import { listProviderModels } from "@client/platform.js"

export interface GatewayConnectionOptions {
  url?: string
}

const RECONNECT_ATTEMPTS = 5

export function useGatewayClient() {
  const client = shallowRef<GatewayClient>()
  const serverSnapshot = shallowRef<ServerSnapshot>()
  const connectionState = ref<ConnectionState>("disconnected")
  const connectionError = shallowRef<Error>()
  let unsubscribes: Unsubscribe[] = []
  let disposed = false
  let attachedReconnect: (() => Promise<void>) | undefined
  let wasConnected = false
  const reconnecting = shallowRef(false)
  const reconnectFailed = shallowRef(false)

  function bindAttachedReconnect(fn?: () => Promise<void>) {
    attachedReconnect = fn
  }

  const connected = computed(() => connectionState.value === "connected")
  const sessions = computed(() => serverSnapshot.value?.sessions ?? [])
  const models = computed(() => serverSnapshot.value?.models ?? [])
  const defaultModel = computed(() => serverSnapshot.value?.defaultModel ?? null)
  const workspaceGit = computed(() => serverSnapshot.value?.workspaceGit ?? {})

  function refreshWorkspaceGit() {
    void client.value?.refreshWorkspaceGit()
  }

  function unsubscribeAll() {
    for (const unsubscribe of unsubscribes) unsubscribe()
    unsubscribes = []
  }

  async function connect(options: GatewayConnectionOptions = {}): Promise<GatewayClient> {
    if (disposed) throw new Error(t("errors.gatewayClientDisposed"))
    const previous = client.value
    unsubscribeAll()
    await previous?.dispose()
    connectionError.value = undefined

    const next = new GatewayClient(options.url ?? webSocketUrl(), (error) => {
      connectionError.value = error
    })

    client.value = next
    let handshake = true
    unsubscribes.push(
      next.onConnectionStateChange((change) => {
        if (handshake && change.state === "connected") return
        connectionState.value = change.state

        if (change.state === "connected") connectionError.value = undefined
        else if (change.error) connectionError.value = change.error
      }),
      next.subscribe((snapshot) => {
        serverSnapshot.value = snapshot
      }),
      next.onPreferencesChanged(applyRemotePreferences),
      next.onSessionArchivesChanged(applyRemoteSessionArchives),
      next.onWorkspaceGitChanged((changes) => {
        const snapshot = serverSnapshot.value

        if (snapshot)
          serverSnapshot.value = {
            ...snapshot,
            workspaceGit: mergeWorkspaceGit(snapshot.workspaceGit, changes),
          }
      }),
    )

    try {
      serverSnapshot.value = await next.connect()
      handshake = false
      connectionState.value = "connected"
      connectionError.value = undefined
    } catch (error) {
      handshake = false
      connectionError.value = error instanceof Error ? error : new Error(String(error))
      throw error
    }

    return next
  }

  async function refreshSessions() {
    const current = client.value

    if (!current || !serverSnapshot.value) return
    const sessions = await current.listSessions()
    const snapshot = serverSnapshot.value

    if (client.value !== current || !snapshot) return
    serverSnapshot.value = { ...snapshot, sessions: [...sessions] }
  }

  async function refreshModels() {
    if (!serverSnapshot.value) return
    const { models, defaultModel } = await listProviderModels()
    const snapshot = serverSnapshot.value

    if (!snapshot) return
    serverSnapshot.value = { ...snapshot, models, defaultModel }
  }

  async function dispose() {
    if (disposed) return
    disposed = true
    const current = client.value
    unsubscribeAll()
    client.value = undefined
    connectionState.value = "disconnected"
    reconnecting.value = false
    reconnectFailed.value = false
    serverSnapshot.value = undefined
    await current?.dispose()
  }

  async function reconnectNow() {
    if (reconnecting.value || disposed) return
    reconnecting.value = true
    reconnectFailed.value = false

    try {
      for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
        if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt - 1)))

        if (disposed || connectionState.value === "connected") break

        try {
          if (attachedReconnect) await attachedReconnect()
          else await client.value?.reconnect()
        } catch {}
      }

      if (!disposed && connectionState.value !== "connected") reconnectFailed.value = true
    } finally {
      reconnecting.value = false
    }
  }

  watch(connectionState, (state) => {
    if (state === "connected") {
      reconnecting.value = false
      reconnectFailed.value = false

      if (wasConnected) {
        void hydratePreferences()
        void hydrateSessionArchives()
      }

      wasConnected = true
      return
    }

    if (state !== "disconnected" || !wasConnected || reconnecting.value || disposed) return
    void reconnectNow()
  })

  onBeforeUnmount(() => {
    void dispose()
  })
  return {
    client,
    connectionState,
    connectionError,
    connected,
    reconnecting,
    reconnectFailed,
    reconnectNow,
    sessions,
    models,
    defaultModel,
    workspaceGit,
    refreshWorkspaceGit,
    connect,
    refreshSessions,
    refreshModels,
    bindAttachedReconnect,
    dispose,
  }
}
