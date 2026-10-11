import { useColorMode } from "@vueuse/core"
import { computed, nextTick, type ComputedRef } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { paintTheme, type ThemeColors } from "@features/theme/lib/palette.js"

const STORAGE_KEY = "npg-theme"
/** 首帧颜色缓存：index.html 引导脚本在 main.ts 之前读它，避免闪默认色。 */
export const THEME_COLORS_KEY = "pig.themeColors"
const THEME_ID_ATTR = "data-theme-id"

/**
 * 把一套主题画到页面上。传 null 清除，回到 :root / .dark 的默认色。
 * 颜色同时写入 localStorage，供下次首帧使用。
 */
export function applyThemePalette(id: string | null, colors: ThemeColors | null): void {
  if (typeof document === "undefined") return
  const root = document.documentElement

  paintTheme(
    {
      setProperty: (name, value) => root.style.setProperty(name, value),
      removeProperty: (name) => root.style.removeProperty(name),
      setThemeId: (next) => {
        if (next) root.setAttribute(THEME_ID_ATTR, next)
        else delete root.dataset.themeId
      },
      store: (json) => {
        if (json) localStorage.setItem(THEME_COLORS_KEY, json)
        else localStorage.removeItem(THEME_COLORS_KEY)
      },
    },
    id,
    colors,
  )
}

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
