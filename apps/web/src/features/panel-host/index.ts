import { computed, inject, provide, shallowReactive, shallowRef, type InjectionKey } from "vue"
import {
  closePanel,
  openPanel,
  visiblePanels,
  type PanelKind,
} from "@features/panel-host/lib/panel-stack.js"

export type { PanelKind } from "@features/panel-host/lib/panel-stack.js"

function createPanelHost() {
  const order = shallowRef<PanelKind[]>([])
  const height = shallowRef(Number.POSITIVE_INFINITY)
  const slots = shallowReactive(new Map<PanelKind, HTMLElement>())
  const covering = shallowRef(false)
  const narrow = shallowRef(false)
  const expanded = shallowRef(false)
  const visible = computed(() => visiblePanels(order.value, height.value))
  return {
    order,
    visible,
    covering,
    narrow,
    expanded,
    slots,
    setHeight: (value: number) => {
      height.value = value
    },
    open: (kind: PanelKind) => {
      order.value = openPanel(order.value, kind)
    },
    close: (kind: PanelKind) => {
      order.value = closePanel(order.value, kind)
    },
    raise: (kind: PanelKind) => {
      order.value = [...closePanel(order.value, kind), kind]
    },
    hidden: (kind: PanelKind) => order.value.includes(kind) && !visible.value.includes(kind),
  }
}

export type PanelHost = ReturnType<typeof createPanelHost>

const panelHostKey: InjectionKey<PanelHost> = Symbol("panel-host")

export function providePanelHost() {
  const host = createPanelHost()
  provide(panelHostKey, host)
  return host
}

export function usePanelHost(): PanelHost | undefined {
  return inject(panelHostKey, undefined)
}
