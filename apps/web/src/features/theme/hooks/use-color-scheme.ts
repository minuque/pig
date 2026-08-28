import { useColorMode } from "@vueuse/core"
import { computed, nextTick } from "vue"

const STORAGE_KEY = "npg-theme"

/** 主题读写只放 theme 模块；其它 feature 只消费 isDark / toggle。 */
export function useColorScheme() {
  const mode = useColorMode({ initialValue: "light", storageKey: STORAGE_KEY })
  if (mode.store.value === "auto") mode.value = mode.system.value

  const isDark = computed(() => mode.value === "dark")

  function toggle() {
    const next = isDark.value ? "light" : "dark"
    if (typeof document === "undefined") {
      mode.value = next
      return
    }

    const updateTheme = async () => {
      const style = document.createElement("style")
      style.textContent = "*,*::before,*::after{transition:none!important}"
      document.head.append(style)
      mode.value = next
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

  return { isDark, toggle }
}
