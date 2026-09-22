import { useColorMode } from "@vueuse/core"
import { computed, nextTick, type ComputedRef } from "vue"
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

/** 主题是全局面板和 html class，控制器只建一次；每行组件各自建会把 class 反复重写。 */
function theme(): Theme {
  if (shared) return shared
  const mode = useColorMode({ initialValue: "auto", storageKey: STORAGE_KEY })
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

    if (typeof document === "undefined") {
      setScheme(next)
      return
    }

    const updateTheme = async () => {
      const style = document.createElement("style")
      style.textContent = "*,*::before,*::after{transition:none!important}"
      document.head.append(style)
      setScheme(next)
      await nextTick()
      void document.body.offsetHeight
      requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
    }

    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      void updateTheme()
      return
    }

    document.startViewTransition(updateTheme)
  }

  shared = { isDark, scheme, codeBlockProps, setScheme, toggle }
  return shared
}

/** 主题读写只放 theme 模块；其它 feature 只消费 isDark / scheme / codeBlockProps / toggle / setScheme。 */
export function useColorScheme() {
  return theme()
}
