import { inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import type { ExtensionUiDialog, ExtensionUiRequest, ExtensionUiResponse } from "@pig/protocol"
import type { useGatewayClient } from "@client/gateway-connection.js"
import { t } from "@i18n/index.js"
import { pushNotification } from "@pig/ui/notification"
import { toastStatus } from "@pig/ui/toast"
import type { PanelHost } from "@features/panel-host/index.js"
import { sessionTitle, untitledSession, type SessionContext } from "@features/session/index.js"

type Pending = { sessionId: string; request: ExtensionUiDialog }

export interface ExtensionUiHostOptions {
  setTitle?: ((title: string) => void) | undefined
  openSession?: ((sessionId: string) => void) | undefined
}

const DIALOGS = new Set(["select", "confirm", "input", "editor"])
const isDialog = (request: ExtensionUiRequest): request is ExtensionUiDialog =>
  DIALOGS.has(request.method)

function useExtensionUiState(
  pi: ReturnType<typeof useGatewayClient>,
  session: SessionContext,
  host: PanelHost,
  options: ExtensionUiHostOptions = {},
) {
  const dialogs = shallowRef<readonly Pending[]>([])
  const statuses = shallowRef(new Map<string, ReadonlyMap<string, string>>())
  const widgets = shallowRef(new Map<string, ReadonlyMap<string, readonly string[]>>())

  function patched<T>(
    tables: ReadonlyMap<string, ReadonlyMap<string, T>>,
    sessionId: string,
    key: string,
    value: T | undefined,
  ): Map<string, ReadonlyMap<string, T>> {
    const next = new Map(tables)
    const entries = new Map(next.get(sessionId) ?? [])

    if (value === undefined) entries.delete(key)
    else entries.set(key, value)
    next.set(sessionId, entries)
    return next
  }

  function receive(sessionId: string, request: ExtensionUiRequest) {
    if (isDialog(request)) {
      if (!dialogs.value.some((item) => item.request.id === request.id))
        dialogs.value = [...dialogs.value, { sessionId, request }]
      return
    }

    switch (request.method) {
      case "notify": {
        const tone = request.notifyType ?? "info"

        if (host.routeAlert(sessionId, "notify") === "toast") {
          toastStatus(request.message, { tone })
          return
        }

        const meta = pi.sessions.value?.find((item) => item.id === sessionId)
        const title = meta ? sessionTitle(meta) : untitledSession()
        pushNotification({
          title,
          body: request.message,
          tone,
          sessionId,
          avatar: meta?.cwd ? { kind: "project", cwd: meta.cwd } : { kind: "brand" },
          ...(options.openSession
            ? {
                actions: [
                  {
                    label: t("session.openSession"),
                    primary: true,
                    run: () => options.openSession?.(sessionId),
                  },
                ],
              }
            : {}),
        })
        return
      }
      case "setStatus":
        statuses.value = patched(statuses.value, sessionId, request.statusKey, request.statusText)
        return
      case "setWidget":
        widgets.value = patched(widgets.value, sessionId, request.widgetKey, request.widgetLines)
        return
      case "setTitle":
        if (options.setTitle) options.setTitle(request.title)
        else document.title = request.title
        return
      case "set_editor_text":
        if (session.sessionId.value === sessionId) session.prompt.value = request.text
    }
  }

  watch(
    pi.client,
    (client, _old, onCleanup) => {
      if (!client) return
      onCleanup(client.onExtensionUi((event) => receive(event.sessionId, event.request)))
    },
    { immediate: true },
  )

  async function answer(pending: Pending, response: ExtensionUiResponse) {
    dialogs.value = dialogs.value.filter((item) => item !== pending)
    await pi.client.value
      ?.request({ command: "extension_ui_response", sessionId: pending.sessionId, response })
      .catch(() => undefined)
  }

  return { dialogs, statuses, widgets, answer }
}

export type ExtensionUiContext = ReturnType<typeof useExtensionUiState>

const key: InjectionKey<ExtensionUiContext> = Symbol("extension-ui")

export function provideExtensionUi(
  pi: ReturnType<typeof useGatewayClient>,
  session: SessionContext,
  host: PanelHost,
  options?: ExtensionUiHostOptions,
) {
  const state = useExtensionUiState(pi, session, host, options)
  provide(key, state)
  return state
}

export function useExtensionUi(): ExtensionUiContext {
  const state = inject(key)

  if (!state) throw new Error("useExtensionUi() 需要在 provideExtensionUi() 之后调用")
  return state
}
