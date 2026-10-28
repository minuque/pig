import { readonly, shallowRef, watch } from "vue"
import { i18n, t } from "@i18n/index.js"
import {
  readEnum,
  readFlag,
  readNumber,
  readPref,
  writeFlag,
  writeNumber,
  writePref,
} from "@utils/storage.js"

export type UiLocale = "en" | "zh-CN"

export type FontSize = "s" | "m" | "l"

const LOCALE_KEY = "pig.locale"
const FONT_SIZE_KEY = "pig.fontSize"
const NOTIFY_KEY = "pig.notify"
const TRANSLUCENT_KEY = "pig.translucentWindow"
const CONTRAST_KEY = "pig.contrast"
const CONTRAST_DEFAULT = 0
const CONTRAST_MAX = 100
const locale = shallowRef<UiLocale>("zh-CN")
const fontSize = shallowRef<FontSize>("m")
const notifyOn = shallowRef(true)
const translucentWindow = shallowRef(false)
const contrastBoost = shallowRef(CONTRAST_DEFAULT)
let loaded = false

function apply(
  nextLocale: UiLocale,
  nextSize: FontSize,
  nextTranslucent: boolean,
  nextContrast: number,
): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = nextLocale
  document.documentElement.dataset.fontSize = nextSize
  document.documentElement.dataset.translucentWindow = nextTranslucent ? "on" : "off"
  document.documentElement.style.setProperty("--contrast-boost", nextContrast + "%")
  i18n.global.locale.value = nextLocale as typeof i18n.global.locale.value
}

function load(): void {
  if (loaded) return
  loaded = true
  locale.value = readEnum(LOCALE_KEY, ["en", "zh-CN"] as const, "zh-CN")
  fontSize.value = readEnum(FONT_SIZE_KEY, ["s", "m", "l"] as const, "m")
  notifyOn.value = readFlag(NOTIFY_KEY)
  translucentWindow.value = readPref(TRANSLUCENT_KEY) === "on"
  contrastBoost.value = readNumber(CONTRAST_KEY) ?? CONTRAST_DEFAULT
  apply(locale.value, fontSize.value, translucentWindow.value, contrastBoost.value)
}

/** 通用偏好：语言、字号、回合完成系统通知。语言切到 vue-i18n。 */
export function useGeneralPrefs() {
  load()

  watch(
    [locale, fontSize, translucentWindow, contrastBoost],
    ([nextLocale, nextSize, nextTranslucent, nextContrast]) =>
      apply(nextLocale, nextSize, nextTranslucent, nextContrast),
  )
  return {
    locale: readonly(locale),
    fontSize: readonly(fontSize),
    notifyOn: readonly(notifyOn),
    translucentWindow: readonly(translucentWindow),
    contrastBoost: readonly(contrastBoost),
    setLocale(next: UiLocale) {
      locale.value = next
      writePref(LOCALE_KEY, next)
    },
    setFontSize(next: FontSize) {
      fontSize.value = next
      writePref(FONT_SIZE_KEY, next)
    },
    setNotify(next: boolean) {
      notifyOn.value = next
      writeFlag(NOTIFY_KEY, next)
    },
    setTranslucentWindow(next: boolean) {
      translucentWindow.value = next
      writeFlag(TRANSLUCENT_KEY, next)
    },
    setContrastBoost(next: number) {
      contrastBoost.value = Math.min(Math.max(Math.round(next), 0), CONTRAST_MAX)
      writeNumber(CONTRAST_KEY, contrastBoost.value)
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
