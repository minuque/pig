/** 主题的基础状态：全仓只有一份 color mode，控制器改它，基础件只读 isDark。 */
import { useColorMode, type UseColorModeReturn } from "@vueuse/core"
import { computed, effectScope, type ComputedRef } from "vue"

const STORAGE_KEY = "npg-theme"

type Mode = UseColorModeReturn

let shared: { mode: Mode; isDark: ComputedRef<boolean> } | undefined
/** 分离 scope：主题 effect 跟模块同寿命，不随首个调用组件卸载。 */
const scope = effectScope(true)

function state() {
  shared ??= scope.run(() => {
    const mode = useColorMode({
      initialValue: "auto",
      storageKey: STORAGE_KEY,
      disableTransition: false,
    })
    const isDark = computed(() => mode.state.value === "dark")
    return { mode, isDark }
  })!
  return shared
}

export function useThemeMode(): Mode {
  return state().mode
}

/** 只读外观：基础件和弹层包 `ThemeRoot` 时用它，不必认识主题控制器。 */
export function useIsDark(): ComputedRef<boolean> {
  return state().isDark
}
