import { useColorMode, type UseColorModeReturn } from "@vueuse/core"
import { computed, effectScope, type ComputedRef } from "vue"

const STORAGE_KEY = "npg-theme"

type Mode = UseColorModeReturn

type ThemeState = { mode: Mode; isDark: ComputedRef<boolean> }

let shared: ThemeState | undefined
const scope = effectScope(true)

function state(): ThemeState {
  shared ??= scope.run(() => {
    const mode = useColorMode({
      initialValue: "auto",
      storageKey: STORAGE_KEY,
      disableTransition: false,
    }) as Mode
    const isDark = computed(() => mode.state.value === "dark")
    return { mode, isDark }
  }) as ThemeState
  return shared
}

export function useThemeMode(): Mode {
  return state().mode
}

export function useIsDark(): ComputedRef<boolean> {
  return state().isDark
}
