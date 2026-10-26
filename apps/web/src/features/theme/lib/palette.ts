/**
 * accent 的落地方式：只写 html 的两个属性，不动 CSS 变量。
 * data-accent-color 由 rt 基座映射成 --accent-*（1-12 阶与 alpha 全套），
 * data-gray-color 映射中性色族。深浅两份色值由色板文件的 .dark 块决定，
 * 所以切换深浅不需要重画 accent。
 */
import { DEFAULT_ACCENT_ID, findAccent, isAccentId, type AccentId } from "./accents.js"

export const ACCENT_STORAGE_KEY = "pig.accent"
export const ACCENT_ATTR = "data-accent-color"
export const GRAY_ATTR = "data-gray-color"

export interface AccentTarget {
  setAttr(name: string, value: string | null): void
  store(json: string | null): void
}

/** 把一套 accent 画到目标上。id 为 null 时回到默认 indigo。 */
export function paintAccent(target: AccentTarget, id: AccentId | null): void {
  const accent = findAccent(id ?? DEFAULT_ACCENT_ID)

  target.setAttr(ACCENT_ATTR, accent.id)
  target.setAttr(GRAY_ATTR, accent.gray)
  target.store(id ? JSON.stringify({ id }) : null)
}

/** 读取存储的 accent id；已下线的或不是已知 accent 时返回 null。 */
export function readStoredAccent(): AccentId | null {
  if (typeof localStorage === "undefined") return null

  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as { id?: string }) : null
    const id = parsed?.id ?? null
    return isAccentId(id) ? id : null
  } catch {
    return null
  }
}

/**
 * 取某套 accent 某一阶的实际色值，供取色点这类必须拿到 hex 的地方用。
 * 读计算样式而不是维护副本：深浅、accent 切换都会自动反映。
 */
export function accentHex(id: AccentId, step = 9): string {
  if (typeof document === "undefined") return ""

  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${id}-${step}`)
  return value.trim()
}
