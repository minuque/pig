import { useColorMode } from "@vueuse/core"
import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import {
  paintTheme,
  THEMES,
  type ThemeColors,
  type ThemeDefinition,
} from "@features/theme/lib/palette.js"

const STORAGE_KEY = "npg-theme"
/** 首帧颜色缓存：index.html 引导脚本在 main.ts 之前读它，避免闪默认色。 */
export const THEME_COLORS_KEY = "pig.themeColors"
const THEME_ID_ATTR = "data-theme-id"
/**
 * 当前主题 id。null 表示默认主题，颜色走 :root / .dark，不注入。
 * 放模块级 ref：DOM 属性不是响应式依赖，computed 读 dataset 不会触发重渲染。
 */
const themeId: Ref<string | null> = ref(
  typeof document === "undefined" ? null : (document.documentElement.dataset.themeId ?? null),
)

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
        themeId.value = next
      },
      store: (json) => {
        if (json) localStorage.setItem(THEME_COLORS_KEY, json)
        else localStorage.removeItem(THEME_COLORS_KEY)
      },
    },
    id,
    colors,
  )

  // 桌面壳据此改窗口底色，避免换主题时闪默认色。浏览器里没有这个桥。
  window.pigDesktop?.setThemeColor(colors?.canvas ?? resolvedCanvas(root))
}

/** 读 --canvas 的计算值。清除主题后变量回到 :root / .dark，内联样式读不到。 */
function resolvedCanvas(root: HTMLElement): string {
  const probe = document.createElement("div")
  probe.style.background = "var(--canvas)"
  root.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

type Theme = {
  isDark: ComputedRef<boolean>
  scheme: ComputedRef<ColorScheme>
  themeId: Ref<string | null>
  codeBlockProps: ComputedRef<{ theme: "github-dark" | "github-light" }>
  setScheme: (next: ColorScheme) => void
  setTheme: (next: ThemeDefinition | null) => void
  toggle: () => void
}

let shared: Theme | undefined

/** 主题是全局面板和 html class，控制器只建一次；每行组件各自建会把 class 反复重写。 */
function theme(): Theme {
  if (shared) return shared

  // disableTransition 会在改类名时插入再删除 style。这段 DOM 变更落在
  // startViewTransition 回调里，回调被要求同步且不能改 DOM，过渡会被判无效并回滚。
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

  /** 切换深浅时把当前主题重画一次，保证用对深或浅的那份色表。 */
  function repaintTheme() {
    const id = themeId.value

    if (!id) return
    const def = THEMES.find((theme) => theme.id === id)

    if (!def) return
    applyThemePalette(id, isDark.value ? def.dark : def.light)
  }

  function setScheme(next: ColorScheme) {
    mode.value = next
  }

  // 深浅变化统一在这里重画，覆盖手动切换和跟随系统两种来源。
  watch(isDark, () => nextTick(repaintTheme))

  function setTheme(next: ThemeDefinition | null) {
    applyThemePalette(next?.id ?? null, next ? (isDark.value ? next.dark : next.light) : null)
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

    // 类名必须在回调里同步改完。setScheme 的 DOM 更新排在回调之后，
    // 过渡快照的新旧会是同一帧，准备阶段被判无效。
    // 页面被遮住时浏览器会中止过渡，结果已经写入，拒绝不能漏到控制台。
    const transition = document.startViewTransition(() => {
      setScheme(next)
      document.documentElement.classList.toggle("dark", next === "dark")
    })

    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }

  shared = { isDark, scheme, themeId, codeBlockProps, setScheme, setTheme, toggle }
  return shared
}

/** 主题读写只放 theme 模块；其它 feature 只消费 isDark / scheme / codeBlockProps / toggle / setScheme。 */
export function useColorScheme() {
  return theme()
}
