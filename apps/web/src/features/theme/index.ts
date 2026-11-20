/** 主题控制器：深浅色切换、配色预设、外观视图与代码块配色。 */
import { computed, effectScope, nextTick, type ComputedRef } from "vue"
import type { ColorScheme, ThemePreset, ThemePresetId } from "@/types/theme-type.js"
import { useIsDark, useThemeMode } from "@utils/theme-mode.js"
import { useThemePreset } from "@utils/theme-preset.js"

type Theme = {
  isDark: ComputedRef<boolean>
  scheme: ComputedRef<ColorScheme>
  presetId: ComputedRef<ThemePresetId>
  preset: ComputedRef<ThemePreset>
  presets: readonly ThemePreset[]
  codeBlockProps: ComputedRef<{ theme: "github-dark" | "github-light" }>
  setScheme: (next: ColorScheme) => void
  setPreset: (next: ThemePresetId) => void
  toggle: () => void
}

let shared: Theme | undefined
/** 分离 scope：主题控制器的 computed 跟模块同寿命，不随首个调用组件卸载。 */
const scope = effectScope(true)

/** 界面控制器只建一次，各处共享同两个 computed。 */
function theme(): Theme {
  shared ??= scope.run(createTheme) as Theme
  return shared
}

function createTheme(): Theme {
  const mode = useThemeMode()
  const isDark = useIsDark()
  const { presetId, preset, presets, setPreset } = useThemePreset()
  const scheme = computed<ColorScheme>(() =>
    mode.store.value === "auto" ? "auto" : mode.state.value,
  )
  const codeBlockProps = computed(() => ({
    theme: isDark.value ? ("github-dark" as const) : ("github-light" as const),
  }))

  function setScheme(next: ColorScheme) {
    mode.value = next
  }

  function toggle() {
    const next: ColorScheme = isDark.value ? "light" : "dark"
    const reduce =
      typeof document !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (typeof document === "undefined" || !document.startViewTransition || reduce) {
      setScheme(next)
      return
    }

    const transition = document.startViewTransition(async () => {
      setScheme(next)
      await nextTick()
    })

    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }

  return { isDark, scheme, presetId, preset, presets, codeBlockProps, setScheme, setPreset, toggle }
}

export function useColorScheme() {
  return theme()
}
