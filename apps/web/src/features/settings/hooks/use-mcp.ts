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
import { t } from "@i18n/index.js"
import { notify } from "@pig/ui/toast"

export type McpStatus = "idle" | "probing" | "connected" | "needsAuth" | "failed" | "disabled"

export function useMcp(scope: Ref<string>) {
  const view = ref<McpScopeView>()
  const probes = ref<Record<string, McpProbe>>({})
  const note = ref<string>()
  const probing = ref(false)
  const error = ref<string>()

  async function refresh() {
    error.value = undefined

    try {
      const current = scope.value
      const [next, cached] = await Promise.all([getMcpScope(current), getMcpProbes(current)])

      if (current !== scope.value) return
      view.value = next
      probes.value = cached.probes
      note.value = cached.note
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }

  async function probe() {
    probing.value = true

    try {
      const report = await probeMcp(scope.value)

      probes.value = report.probes
      note.value = report.note
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

  async function mutate(task: () => Promise<unknown>): Promise<boolean> {
    try {
      await task()
      notify(t("settings.mcp.saved"), "success")
      return true
    } catch (cause) {
      notify(errorMessage(cause), "error")
      return false
    } finally {
      await refresh()
    }
  }

  function setEnabled(server: McpServerView, enabled: boolean) {
    return mutate(() => patchMcpServer({ scope: scope.value, name: server.name, enabled }))
  }

  function setExposure(server: McpServerView, exposure: McpExposure) {
    return mutate(() => patchMcpServer({ scope: scope.value, name: server.name, exposure }))
  }

  async function save(
    name: string,
    config: Record<string, unknown>,
    options: { previousName?: string | undefined; overwrite?: boolean } = {},
  ) {
    const result = await saveMcpServer({
      scope: scope.value,
      name,
      config,
      ...(options.previousName ? { previousName: options.previousName } : {}),
      ...(options.overwrite ? { overwrite: true } : {}),
    })

    if (!result.ok) return result.error
    await refresh()
    return undefined
  }

  function remove(server: McpServerView) {
    return mutate(() => deleteMcpServer(scope.value, server.name))
  }

  async function logout(server: McpServerView) {
    try {
      await logoutMcp(scope.value, server.name)
    } catch (cause) {
      notify(errorMessage(cause), "error")
    }

    await probe()
  }

  watch(scope, refresh, { immediate: true })
  return {
    view,
    probes,
    note,
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
