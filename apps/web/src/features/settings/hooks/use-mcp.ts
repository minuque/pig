import { ref, watch, type Ref } from "vue"
import type { McpExposure, McpProbe, McpScopeView, McpServerView } from "@pig/protocol"

import {
  deleteMcpServer,
  getMcpProbes,
  getMcpScope,
  logoutMcp,
  patchMcpServer,
  probeMcp,
  saveMcpServer,
} from "@client/agent-config.js"
import { errorMessage } from "@client/http.js"

export type McpStatus = "idle" | "probing" | "connected" | "needsAuth" | "failed" | "disabled"

export function useMcp(scope: Ref<string>) {
  const view = ref<McpScopeView>()
  const probes = ref<Record<string, McpProbe>>({})
  const probing = ref(false)
  const error = ref<string>()

  async function refresh() {
    error.value = undefined

    try {
      const current = scope.value
      const [next, cached] = await Promise.all([getMcpScope(current), getMcpProbes(current)])

      if (current !== scope.value) return
      view.value = next
      probes.value = cached
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  async function probe() {
    probing.value = true

    try {
      probes.value = await probeMcp(scope.value)
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      probing.value = false
    }
  }

  function statusOf(server: McpServerView): McpStatus {
    if (!server.enabled) return "disabled"

    if (probing.value) return "probing"
    const status = probes.value[server.name]?.status

    if (status === "connected" || status === "failed") return status

    if (status === "needs-auth") return "needsAuth"
    return "idle"
  }

  async function setEnabled(server: McpServerView, enabled: boolean) {
    await patchMcpServer({ scope: scope.value, name: server.name, enabled })
    await refresh()
  }

  async function setExposure(server: McpServerView, exposure: McpExposure) {
    await patchMcpServer({ scope: scope.value, name: server.name, exposure })
    await refresh()
  }

  async function save(name: string, config: Record<string, unknown>, previousName?: string) {
    const result = await saveMcpServer({
      scope: scope.value,
      name,
      config,
      ...(previousName ? { previousName } : {}),
    })

    if (!result.ok) return result.error
    await refresh()
    return undefined
  }

  async function remove(server: McpServerView) {
    await deleteMcpServer(scope.value, server.name)
    await refresh()
  }

  async function logout(server: McpServerView) {
    await logoutMcp(scope.value, server.name)
    await probe()
  }

  watch(scope, refresh, { immediate: true })
  return {
    view,
    probes,
    probing,
    error,
    refresh,
    probe,
    statusOf,
    setEnabled,
    setExposure,
    save,
    remove,
    logout,
  }
}

export type McpState = ReturnType<typeof useMcp>
