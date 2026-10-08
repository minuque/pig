import { createI18n, useI18n as useVueI18n } from "vue-i18n"
import { en, zh } from "@i18n/messages.js"

export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: { "zh-CN": zh, en },
})
/** 非组件上下文（lib/hook）用全局 t；组件内 useI18n() 直接拿。 */
export const t: (key: string, args?: Record<string, unknown>) => string = i18n.global.t

export { useVueI18n as useI18n }
