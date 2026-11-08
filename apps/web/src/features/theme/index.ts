import { useColorMode } from "@vueuse/core"
import { computed, effectScope, type ComputedRef } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"

const STORAGE_KEY = "npg-theme"

type Theme = {
  isDark: ComputedRef<boolean>
  scheme: ComputedRef<ColorScheme>
  codeBlockProps: ComputedRef<{ theme: "github-dark" | "github-light" }>
  setScheme: (next: ColorScheme) => void
  toggle: () => void
}

let shared: Theme | undefined
/** 分离 scope：主题 effect 跟模块同寿命，不随首个调用组件卸载。 */
const scope = effectScope(true)

/** 主题是全局面板和 html class，控制器只建一次。 */
function theme(): Theme {
  shared ??= scope.run(createTheme) as Theme
  return shared
}

function createTheme(): Theme {
  const mode = useColorMode({
    initialValue: "auto",
    storageKey: STORAGE_KEY,
    disableTransition: false,
  })
  const isDark = computed(() => mode.state.value === "dark")
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

    const transition = document.startViewTransition(() => {
      setScheme(next)
      document.documentElement.classList.toggle("dark", next === "dark")
    })

    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }

  return { isDark, scheme, codeBlockProps, setScheme, toggle }
}

export function useColorScheme() {
  return theme()
}
