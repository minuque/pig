import { readonly, shallowRef, watch } from "vue"
import { i18n, t } from "@i18n/index.js"

export type UiLocale = "en" | "zh-CN"

export type FontSize = "s" | "m" | "l" | "xl"

const LOCALE_KEY = "pig.locale"
const FONT_SIZE_KEY = "pig.fontSize"
const NOTIFY_KEY = "pig.notify"
const locale = shallowRef<UiLocale>("zh-CN")
const fontSize = shallowRef<FontSize>("m")
const notifyOn = shallowRef(true)
let loaded = false

function readEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off"
  } catch {
    return true
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 隐私模式写不进存储时仍用内存值 */
  }
}

function apply(nextLocale: UiLocale, nextSize: FontSize): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = nextLocale
  document.documentElement.dataset.fontSize = nextSize
  i18n.global.locale.value = nextLocale as typeof i18n.global.locale.value
}

function load(): void {
  if (loaded) return
  loaded = true
  locale.value = readEnum(LOCALE_KEY, ["en", "zh-CN"] as const, "zh-CN")
  fontSize.value = readEnum(FONT_SIZE_KEY, ["s", "m", "l", "xl"] as const, "m")
  notifyOn.value = readFlag(NOTIFY_KEY)
  apply(locale.value, fontSize.value)
}

/** 通用偏好：语言、字号、回合完成系统通知。语言切到 vue-i18n。 */
export function useGeneralPrefs() {
  load()

  watch([locale, fontSize], ([nextLocale, nextSize]) => apply(nextLocale, nextSize))
  return {
    locale: readonly(locale),
    fontSize: readonly(fontSize),
    notifyOn: readonly(notifyOn),
    setLocale(next: UiLocale) {
      locale.value = next
      write(LOCALE_KEY, next)
    },
    setFontSize(next: FontSize) {
      fontSize.value = next
      write(FONT_SIZE_KEY, next)
    },
    setNotify(next: boolean) {
      notifyOn.value = next
      write(NOTIFY_KEY, next ? "on" : "off")
    },
  }
}

/** 回合干净收尾时发一条系统通知；开关关闭、无权限或无 API 时不发。 */
export async function notifyTurnDone(): Promise<void> {
  load()

  if (
    !notifyOn.value ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return

  try {
    new Notification(t("settings.notifyTurnDone"), {
      body: t("settings.notifyTurnDoneBody"),
    })
  } catch {
    /* 桌面壳拒绝通知时不打断回合收尾 */
  }
}
