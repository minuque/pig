import { inject, provide, type InjectionKey, type Ref } from "vue"

export type MenuSize = "s" | "m"

export interface MenuContentState {
  size: Ref<MenuSize>
  color: Ref<string | undefined>
}

const menuContentKey: InjectionKey<MenuContentState> = Symbol("menu-content")

export function provideMenuContent(state: MenuContentState): void {
  provide(menuContentKey, state)
}

export function useMenuContent(): MenuContentState | undefined {
  return inject(menuContentKey, undefined)
}
