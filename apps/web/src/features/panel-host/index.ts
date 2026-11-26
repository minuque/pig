import { computed, inject, provide, shallowRef, type InjectionKey, type Ref } from "vue"
import { routeAlert, type AlertRoute, type PaneAlert } from "@features/panel-host/lib/pane-alert.js"
import { stepView, type PaneView } from "@features/panel-host/lib/pane-view.js"

export { PANE_VIEWS, type PaneView } from "@features/panel-host/lib/pane-view.js"

export { ALERT_TTL, type PaneAlert } from "@features/panel-host/lib/pane-alert.js"

function createPaneAlerts(shown: (sessionId: string) => PaneView | undefined) {
  const queue = shallowRef<readonly PaneAlert[]>([])

  return {
    current: () => queue.value[0],
    pending: () => Math.max(0, queue.value.length - 1),
    dismiss() {
      queue.value = queue.value.slice(1)
    },
    clear() {
      queue.value = []
    },
    route(sessionId: string, alert: PaneAlert): AlertRoute {
      const route = routeAlert(alert.kind, shown(sessionId))

      if (route === "island") queue.value = [...queue.value, alert]
      return route
    },
  }
}

export type PaneAlerts = ReturnType<typeof createPaneAlerts>

function createPanelHost(sessionId: Readonly<Ref<string | undefined>>) {
  const current = shallowRef<PaneView>("chat")
  return {
    view: computed(() => (sessionId.value ? current.value : "chat")),
    alerts: createPaneAlerts((id) => (id === sessionId.value ? current.value : undefined)),
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
