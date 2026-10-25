import { useColorMode } from "@vueuse/core"
import { computed, effectScope, nextTick, ref, watch, type ComputedRef, type Ref } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { ACCENT_STORAGE_KEY, paintAccent, readStoredAccent } from "@features/theme/lib/palette.js"
import { DEFAULT_ACCENT_ID, type AccentId } from "@features/theme/lib/accents.js"

const STORAGE_KEY = "npg-theme"
/**
 * 当前 accent id。null 表示默认 indigo，颜色走 :root/.dark，不注入。
 * 放模块级 ref：DOM 属性不是响应式依赖。
 */
const accentId: Ref<AccentId | null> = ref(
  typeof document === "undefined"
    ? null
    : ((document.documentElement.dataset.accent as AccentId | undefined) ?? null),
)

/** 把一套 accent 画到页面上。id 为 null 时清除，回到默认 indigo。 */
export function applyAccent(id: AccentId | null, mode: "light" | "dark"): void {
  if (typeof document === "undefined") return
  const root = document.documentElement

  paintAccent(
    {
      setProperty: (name, value) => root.style.setProperty(name, value),
      removeProperty: (name) => root.style.removeProperty(name),
      setAttr: (name, value) => {
        if (value) root.setAttribute(name, value)
        else delete root.dataset.accent
        accentId.value = (value as AccentId | undefined) ?? null
      },
      store: (json) => {
        if (json) localStorage.setItem(ACCENT_STORAGE_KEY, json)
        else localStorage.removeItem(ACCENT_STORAGE_KEY)
      },
    },
    id,
    mode,
  )

  // 桌面壳据此改窗口底色。accent 不动背景，沿用 --background。
  window.pigDesktop?.setThemeColor(resolvedBackground(root))
}

/** 读 --background 的计算值；内联样式不直接可读时走计算样式。 */
function resolvedBackground(root: HTMLElement): string {
  const probe = document.createElement("div")
  probe.style.background = "var(--background)"
  root.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

type Theme = {
  isDark: ComputedRef<boolean>
  scheme: ComputedRef<ColorScheme>
  accent: ComputedRef<AccentId>
  codeBlockProps: ComputedRef<{ theme: "github-dark" | "github-light" }>
  setScheme: (next: ColorScheme) => void
  setAccent: (next: AccentId | null) => void
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
  const accent = computed<AccentId>(() => accentId.value ?? DEFAULT_ACCENT_ID)
  const codeBlockProps = computed(() => ({
    theme: isDark.value ? ("github-dark" as const) : ("github-light" as const),
  }))

  /** 深浅切换时把当前 accent 重画一次，保证用对那份色表。 */
  function repaintAccent() {
    applyAccent(accentId.value, isDark.value ? "dark" : "light")
  }

  function setScheme(next: ColorScheme) {
    mode.value = next
  }

  watch(isDark, () => nextTick(repaintAccent))

  function setAccent(next: AccentId | null) {
    applyAccent(next === DEFAULT_ACCENT_ID ? null : next, isDark.value ? "dark" : "light")
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

  return { isDark, scheme, accent, codeBlockProps, setScheme, setAccent, toggle }
}

export function useColorScheme() {
  return theme()
}

export { readStoredAccent }
