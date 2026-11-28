import { computed, effectScope, nextTick, watch, type ComputedRef } from "vue"
import { updatePreferences, userPreferences } from "@client/preferences.js"
import type { ColorScheme } from "@pig/ui/theme"
import type { UserCodeTheme, UserPalette } from "@/types/common-type.js"
import { useIsDark, useThemeMode } from "@utils/theme-mode.js"
import { codeBlockTheme, type CodeBlockTheme } from "./code-themes.js"

type Theme = {
  isDark: ComputedRef<boolean>
  scheme: ComputedRef<ColorScheme>
  palette: ComputedRef<UserPalette>
  codeTheme: ComputedRef<UserCodeTheme>
  codeBlockProps: ComputedRef<{ theme: CodeBlockTheme }>
  setScheme: (next: ColorScheme) => void
  setPalette: (next: UserPalette) => void
  setCodeTheme: (next: UserCodeTheme) => void
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
  const palette = computed(() => userPreferences.value.palette)
  const codeTheme = computed(() => userPreferences.value.codeTheme)
  const codeBlockProps = computed(() => ({
    theme: codeBlockTheme(codeTheme.value, isDark.value),
  }))

  watch(
    () => userPreferences.value.theme,
    (next) => {
      if (mode.store.value !== next) mode.value = next
    },
    { immediate: true, flush: "sync" },
  )
  watch(
    palette,
    (next) => {
      if (typeof document === "undefined") return

      if (next === "pig") delete document.documentElement.dataset.palette
      else document.documentElement.dataset.palette = next
    },
    { immediate: true, flush: "sync" },
  )
  watch(
    [isDark, palette],
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

  function setPalette(next: UserPalette) {
    updatePreferences({ palette: next })
  }

  function setCodeTheme(next: UserCodeTheme) {
    updatePreferences({ codeTheme: next })
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
    palette,
    codeTheme,
    codeBlockProps,
    setScheme,
    setPalette,
    setCodeTheme,
    toggle,
  }
}

export function useColorScheme() {
  return theme()
}
