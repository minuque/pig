import { inject, provide, type InjectionKey, type Ref } from "vue"

/** 菜单只要两档：s 紧凑、m 默认；不做 l，宽松档在大菜单里没有落点。 */
export type MenuSize = "s" | "m"

/** 父内容下发到子菜单的尺寸与颜色；子菜单不自己声明，跟随父内容。 */
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
