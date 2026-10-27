import { useColorMode } from "@vueuse/core"
import { computed, effectScope, ref, type ComputedRef, type Ref } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import {
  ACCENT_ATTR,
  ACCENT_STORAGE_KEY,
  paintAccent,
  readStoredAccent,
} from "@features/theme/lib/palette.js"
import { DEFAULT_ACCENT_ID, type AccentId } from "@features/theme/lib/accents.js"

const STORAGE_KEY = "npg-theme"
/**
 * 当前 accent id。null 表示默认 indigo，由 paintAccent 落到 data-accent-color。
 * 放模块级 ref：DOM 属性不是响应式依赖。
 */
const accentId: Ref<AccentId | null> = ref(
  typeof document === "undefined"
    ? null
    : ((document.documentElement.dataset.accentColor as AccentId | undefined) ?? null),
)

/** 把一套 accent 画到页面上：只改 html 的属性，深浅由色板文件的 .dark 块接管。 */
export function applyAccent(id: AccentId | null): void {
  if (typeof document === "undefined") return
  const root = document.documentElement

  paintAccent(
    {
      setAttr: (name, value) => {
        if (value) root.setAttribute(name, value)
        else root.removeAttribute(name)
        accentId.value = value && name === ACCENT_ATTR ? (value as AccentId) : accentId.value
      },
      store: (json) => {
        if (json) localStorage.setItem(ACCENT_STORAGE_KEY, json)
        else localStorage.removeItem(ACCENT_STORAGE_KEY)
      },
    },
    id,
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

  function setScheme(next: ColorScheme) {
    mode.value = next
  }

  function setAccent(next: AccentId | null) {
    applyAccent(next === DEFAULT_ACCENT_ID ? null : next)
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
