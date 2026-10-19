import { createI18n, useI18n as useVueI18n } from "vue-i18n"
import { en, zh } from "@i18n/messages.js"

export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: { "zh-CN": zh, en },
})
/** 非组件上下文（lib/hook）用全局 t；第二参数给数字时按 i18n 复数规则取档。 */
export const t = i18n.global.t as {
  (key: string, plural: number, options?: Record<string, unknown>): string
  (key: string, args?: Record<string, unknown>): string
}

export { useVueI18n as useI18n }
