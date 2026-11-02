import { inject, provide, type InjectionKey, type Ref } from "vue"
import type { Size } from "./size.js"

export type MenuVariant = "solid" | "soft"

/** 父内容下发到子菜单的尺寸与外观；子菜单不自己声明，跟随父内容。 */
export interface MenuContentState {
  size: Ref<Size>
  variant: Ref<MenuVariant>
  color: Ref<string | undefined>
  highContrast: Ref<boolean>
}

const menuContentKey: InjectionKey<MenuContentState> = Symbol("menu-content")

export function provideMenuContent(state: MenuContentState): void {
  provide(menuContentKey, state)
}

export function useMenuContent(): MenuContentState | undefined {
  return inject(menuContentKey, undefined)
}
