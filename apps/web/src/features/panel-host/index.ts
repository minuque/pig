import { computed, inject, provide, shallowRef, type InjectionKey, type Ref } from "vue"
import { routeAlert, type AlertKind, type AlertRoute } from "@features/panel-host/lib/pane-alert.js"
import { stepView, type PaneView } from "@features/panel-host/lib/pane-view.js"

export { PANE_VIEWS, type PaneView } from "@features/panel-host/lib/pane-view.js"

export type { AlertKind, AlertRoute, AlertTone } from "@features/panel-host/lib/pane-alert.js"

function createPanelHost(sessionId: Readonly<Ref<string | undefined>>) {
  const current = shallowRef<PaneView>("chat")
  return {
    view: computed(() => (sessionId.value ? current.value : "chat")),
    routeAlert: (targetSessionId: string, kind: AlertKind): AlertRoute =>
      routeAlert(kind, targetSessionId === sessionId.value ? current.value : undefined),
    showView: (view: PaneView) => {
      current.value = view
    },
    stepView: (delta: number) => {
      current.value = stepView(current.value, delta)
    },
  }
}

export type PanelHost = ReturnType<typeof createPanelHost>

const panelHostKey: InjectionKey<PanelHost> = Symbol("panel-host")

export function providePanelHost(sessionId: Readonly<Ref<string | undefined>>) {
  const host = createPanelHost(sessionId)
  provide(panelHostKey, host)
  return host
}

export function usePanelHost(): PanelHost {
  const host = inject(panelHostKey)

  if (!host) throw new Error("usePanelHost() 需要先 providePanelHost()")
  return host
}
