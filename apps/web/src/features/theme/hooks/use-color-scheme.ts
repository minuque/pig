import { useColorMode } from "@vueuse/core"
import { computed, nextTick } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"

const STORAGE_KEY = "npg-theme"

/** 主题读写只放 theme 模块；其它 feature 只消费 isDark / scheme / codeBlockProps / toggle / setScheme。 */
export function useColorScheme() {
  const mode = useColorMode({ initialValue: "auto", storageKey: STORAGE_KEY })
  const isDark = computed(() => mode.state.value === "dark")

  const scheme = computed<ColorScheme>(() =>
    mode.store.value === "auto" ? "auto" : mode.state.value,
  )

  const codeBlockProps = computed(() => ({
    theme: isDark.value ? ("dark-plus" as const) : ("light-plus" as const),
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

  return { isDark, scheme, codeBlockProps, setScheme, toggle }
}
