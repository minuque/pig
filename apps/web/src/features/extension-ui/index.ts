import { inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import type { ExtensionUiDialog, ExtensionUiRequest, ExtensionUiResponse } from "@pig/protocol"
import type { useGatewayClient } from "@client/gateway-connection.js"
import { notify } from "@components/layout/notify.js"
import type { SessionContext } from "@features/session/index.js"

type Pending = { sessionId: string; request: ExtensionUiDialog }

const DIALOGS = new Set(["select", "confirm", "input", "editor"])
const isDialog = (request: ExtensionUiRequest): request is ExtensionUiDialog =>
  DIALOGS.has(request.method)

/** 扩展经 ctx.ui 发来的界面请求：对话框排队作答，通知、状态、widget 按会话记下。 */
function useExtensionUiState(pi: ReturnType<typeof useGatewayClient>, session: SessionContext) {
  const dialogs = shallowRef<readonly Pending[]>([])
  /** 会话 id → 状态键 → 文本；摘要面板读它。 */
  const statuses = shallowRef(new Map<string, ReadonlyMap<string, string>>())
  /** 会话 id → widget 键 → 文本行。 */
  const widgets = shallowRef(new Map<string, ReadonlyMap<string, readonly string[]>>())

  /** 按会话改一张键值表；值为 undefined 时删掉该键。 */
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
      // 重连补发的同一个对话框不重复排队
      if (!dialogs.value.some((item) => item.request.id === request.id))
        dialogs.value = [...dialogs.value, { sessionId, request }]
      return
    }

    switch (request.method) {
      case "notify":
        notify(request.message, request.notifyType ?? "info")
        return
      case "setStatus":
        statuses.value = patched(statuses.value, sessionId, request.statusKey, request.statusText)
        return
      case "setWidget":
        widgets.value = patched(widgets.value, sessionId, request.widgetKey, request.widgetLines)
        return
      case "setTitle":
        document.title = request.title
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

  /** 当前会话最早的待答对话框；别的会话的等切过去再弹。 */
  function current(): Pending | undefined {
    return dialogs.value.find((item) => item.sessionId === session.sessionId.value)
  }

  async function answer(pending: Pending, response: ExtensionUiResponse) {
    dialogs.value = dialogs.value.filter((item) => item !== pending)
    await pi.client.value
      ?.request({ command: "extension_ui_response", sessionId: pending.sessionId, response })
      .catch(() => undefined)
  }

  return { dialogs, statuses, widgets, current, answer }
}

export type ExtensionUiContext = ReturnType<typeof useExtensionUiState>

const key: InjectionKey<ExtensionUiContext> = Symbol("extension-ui")

export function provideExtensionUi(
  pi: ReturnType<typeof useGatewayClient>,
  session: SessionContext,
) {
  const state = useExtensionUiState(pi, session)
  provide(key, state)
  return state
}

export function useExtensionUi(): ExtensionUiContext {
  const state = inject(key)

  if (!state) throw new Error("useExtensionUi() 需要在 provideExtensionUi() 之后调用")
  return state
}
