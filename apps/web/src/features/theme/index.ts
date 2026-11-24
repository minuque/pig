import { computed, effectScope, nextTick, watch, type ComputedRef } from "vue"
import { updatePreferences, userPreferences } from "@client/preferences.js"
import type { ColorScheme } from "@pig/ui/theme"
import { useIsDark, useThemeMode } from "@utils/theme-mode.js"

type Theme = {
  isDark: ComputedRef<boolean>
  scheme: ComputedRef<ColorScheme>
  codeBlockProps: ComputedRef<{ theme: "github-dark" | "github-light" }>
  setScheme: (next: ColorScheme) => void
  toggle: () => void
}

let shared: Theme | undefined
const scope = effectScope(true)

function theme(): Theme {
  shared ??= scope.run(createTheme) as Theme
  return shared
}

function createTheme(): Theme {
  const mode = useThemeMode()
  const isDark = useIsDark()
  const scheme = computed<ColorScheme>(() =>
    mode.store.value === "auto" ? "auto" : mode.state.value,
  )
  const codeBlockProps = computed(() => ({
    theme: isDark.value ? ("github-dark" as const) : ("github-light" as const),
  }))

  watch(
    () => userPreferences.value.theme,
    (next) => {
      if (mode.store.value !== next) mode.value = next
    },
    { immediate: true, flush: "sync" },
  )
  watch(
    isDark,
    async () => {
      if (typeof window === "undefined" || !window.pigDesktop) return
      await nextTick()
      window.pigDesktop.setThemeColor(
        getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      )
    },
    { immediate: true },
  )

  function setScheme(next: ColorScheme) {
    mode.value = next
    updatePreferences({ theme: next })
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

  return {
    isDark,
    scheme,
    codeBlockProps,
    setScheme,
    toggle,
  }
}

export function useColorScheme() {
  return theme()
}
