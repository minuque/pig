import type { InjectionKey, Ref } from "vue"

export const tooltipShortcutKey: InjectionKey<Readonly<Ref<string | undefined>>> =
  Symbol("tooltip-shortcut")
