import { readonly, shallowRef, watch } from "vue"
import { i18n, t } from "@i18n/index.js"
import { readEnum, readFlag, readPref, writeFlag, writePref } from "@utils/storage.js"

export type UiLocale = "en" | "zh-CN"

export type FontSize = "s" | "m" | "l"

export type ChatWidth = "comfortable" | "wide" | "full"

const LOCALE_KEY = "pig.locale"
const FONT_SIZE_KEY = "pig.fontSize"
const CHAT_WIDTH_KEY = "pig.chatWidth"
const NOTIFY_KEY = "pig.notify"
const USER_NAME_KEY = "pig.userName"
const locale = shallowRef<UiLocale>("zh-CN")
const fontSize = shallowRef<FontSize>("m")
const chatWidth = shallowRef<ChatWidth>("comfortable")
const notifyOn = shallowRef(true)
/** 侧栏左下角显示的名字；空串表示没配，显示默认名。 */
const userName = shallowRef("")
let loaded = false

function apply(nextLocale: UiLocale, nextSize: FontSize, nextChatWidth: ChatWidth): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = nextLocale
  document.documentElement.dataset.fontSize = nextSize
  document.documentElement.dataset.chatWidth = nextChatWidth
  i18n.global.locale.value = nextLocale as typeof i18n.global.locale.value
}

function load(): void {
  if (loaded) return
  loaded = true
  locale.value = readEnum(LOCALE_KEY, ["en", "zh-CN"] as const, "zh-CN")
  fontSize.value = readEnum(FONT_SIZE_KEY, ["s", "m", "l"] as const, "m")
  chatWidth.value = readEnum(
    CHAT_WIDTH_KEY,
    ["comfortable", "wide", "full"] as const,
    "comfortable",
  )
  notifyOn.value = readFlag(NOTIFY_KEY)
  userName.value = readPref(USER_NAME_KEY) ?? ""
  apply(locale.value, fontSize.value, chatWidth.value)
}

/** 通用偏好：语言、字号、对话宽度、回合完成系统通知。语言切到 vue-i18n。 */
export function useGeneralPrefs() {
  load()

  watch([locale, fontSize, chatWidth], ([nextLocale, nextSize, nextChatWidth]) =>
    apply(nextLocale, nextSize, nextChatWidth),
  )
  return {
    locale: readonly(locale),
    fontSize: readonly(fontSize),
    chatWidth: readonly(chatWidth),
    notifyOn: readonly(notifyOn),
    userName: readonly(userName),
    setUserName(next: string) {
      userName.value = next
      writePref(USER_NAME_KEY, next.trim())
    },
    setLocale(next: UiLocale) {
      locale.value = next
      writePref(LOCALE_KEY, next)
    },
    setFontSize(next: FontSize) {
      fontSize.value = next
      writePref(FONT_SIZE_KEY, next)
    },
    setChatWidth(next: ChatWidth) {
      chatWidth.value = next
      writePref(CHAT_WIDTH_KEY, next)
    },
    setNotify(next: boolean) {
      notifyOn.value = next
      writeFlag(NOTIFY_KEY, next)
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
