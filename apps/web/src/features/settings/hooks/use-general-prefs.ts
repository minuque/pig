import { computed, effectScope, readonly, shallowRef, watch } from "vue"
import { userPreferences, updatePreferences } from "@client/preferences.js"
import { i18n, t } from "@i18n/index.js"

export type UiLocale = "en" | "zh-CN"

export type ChatWidth = "comfortable" | "wide" | "full"

export interface SystemNotificationOptions {
  title: string
  body?: string | undefined
  onClick?: (() => void) | undefined
  enabled?: boolean | undefined
}

const locale = computed(() => userPreferences.value.locale)
const chatWidth = computed(() => userPreferences.value.chatWidth)
const notifyOn = computed(() => userPreferences.value.notify)
const notifyInputOn = computed(() => userPreferences.value.notifyInput)
const userName = shallowRef(userPreferences.value.userName)
let loaded = false

function apply(nextLocale: UiLocale, nextChatWidth: ChatWidth): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = nextLocale
  document.documentElement.dataset.chatWidth = nextChatWidth
  i18n.global.locale.value = nextLocale as typeof i18n.global.locale.value
}

function load(): void {
  if (loaded) return
  loaded = true
  effectScope(true).run(() => {
    watch([locale, chatWidth], ([nextLocale, nextChatWidth]) => apply(nextLocale, nextChatWidth), {
      immediate: true,
      flush: "sync",
    })
    watch(
      () => userPreferences.value.userName,
      (next) => {
        if (userName.value.trim() !== next) userName.value = next
      },
      { immediate: true, flush: "sync" },
    )
  })
}

export function useGeneralPrefs() {
  load()
  return {
    locale,
    chatWidth,
    notifyOn,
    notifyInputOn,
    userName: readonly(userName),
    setUserName(next: string) {
      userName.value = next

      const trimmed = next.trim()

      if (trimmed !== userPreferences.value.userName) updatePreferences({ userName: trimmed })
    },
    setLocale(next: UiLocale) {
      updatePreferences({ locale: next })
    },
    setChatWidth(next: ChatWidth) {
      updatePreferences({ chatWidth: next })
    },
    setNotify(next: boolean) {
      updatePreferences({ notify: next })
    },
    setNotifyInput(next: boolean) {
      updatePreferences({ notifyInput: next })
    },
  }
}

function windowUnfocused(): boolean {
  if (typeof document === "undefined") return false
  return Boolean(document.hidden) || !document.hasFocus()
}

export async function notifySystem(options: SystemNotificationOptions): Promise<void> {
  if (
    !(options.enabled ?? notifyOn.value) ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    !windowUnfocused()
  )
    return

  try {
    const notice = new Notification(
      options.title,
      options.body ? { body: options.body } : undefined,
    )

    if (options.onClick) {
      const click = options.onClick
      notice.onclick = () => {
        window.focus()
        click()
        notice.close()
      }
    }
  } catch {
    // 外部：桌面壳拒绝通知时会抛错，不能打断回合收尾
  }
}

export async function notifyTurnDone(
  options: Partial<SystemNotificationOptions> = {},
): Promise<void> {
  await notifySystem({
    title: options.title ?? t("settings.notifyTurnDone"),
    body: options.body ?? t("settings.notifyTurnDoneBody"),
    onClick: options.onClick,
  })
}
