/**
 * accent 注入：--accent-* 写到 html 上，CSS 里的 --primary/--link/selection/halo 等
 * 都指回 --accent-*，改 accent 即整页联动。浅深两档各写一份 hex。
 */
import { findAccent, ACCENTS, type AccentId } from "./accents.js"

export const ACCENT_STORAGE_KEY = "pig.accent"
export const ACCENT_ATTR = "data-accent"
const BRIGHT_CONTRAST = "var(--foreground)"
const DEFAULT_CONTRAST = "var(--white)"

export interface AccentTarget {
  setProperty(name: string, value: string): void
  removeProperty(name: string): void
  setAttr(name: string, value: string | null): void
  store(json: string | null): void
}

const ACCENT_VARS = ["9", "10", "11", "a3", "a4", "a6", "a9", "contrast"] as const

/** 把一套 accent 画到目标上。id 为 null 时清除，回到 :root/.dark 默认 accent。 */
export function paintAccent(
  target: AccentTarget,
  id: AccentId | null,
  mode: "light" | "dark",
): void {
  if (!id) {
    target.setAttr(ACCENT_ATTR, null)

    for (const name of ACCENT_VARS) target.removeProperty(`--accent-${name}`)
    target.store(null)
    return
  }

  const accent = findAccent(id)
  const scale = mode === "dark" ? accent.dark : accent.light
  const contrast = accent.contrast === "dark" ? BRIGHT_CONTRAST : DEFAULT_CONTRAST

  target.setAttr(ACCENT_ATTR, accent.id)
  target.setProperty("--accent-9", scale.step9)
  target.setProperty("--accent-10", scale.step10)
  target.setProperty("--accent-11", scale.step11)
  target.setProperty("--accent-a3", scale.a3)
  target.setProperty("--accent-a4", scale.a4)
  target.setProperty("--accent-a6", scale.a6)
  target.setProperty("--accent-a9", scale.a9)
  target.setProperty("--accent-contrast", contrast)
  target.store(JSON.stringify({ id: accent.id }))
}

/** 读取存储的 accent id；不是已知 accent 时返回 null。 */
export function readStoredAccent(): AccentId | null {
  if (typeof localStorage === "undefined") return null

  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as { id?: string }) : null
    const id = parsed?.id ?? null
    return id && ACCENTS.some((accent) => accent.id === id) ? (id as AccentId) : null
  } catch {
    return null
  }
}
