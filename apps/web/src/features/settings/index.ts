import { inject, provide, ref, type InjectionKey, type Ref } from "vue"

export type SettingsTab = "general" | "usage" | "skills" | "extensions"

export type SettingsContext = {
  open: Ref<boolean>
  tab: Ref<SettingsTab>
  openSettings: () => void
}

export const settingsKey: InjectionKey<SettingsContext> = Symbol("settings")

export function provideSettings(): SettingsContext {
  const open = ref(false)
  const tab = ref<SettingsTab>("general")
  function openSettings() {
    tab.value = "general"
    open.value = true
  }
  const settings = { open, tab, openSettings }
  provide(settingsKey, settings)
  return settings
}

export function useSettings(): SettingsContext {
  const settings = inject(settingsKey)
  if (!settings) throw new Error("useSettings() 需要在 provideSettings() 之后调用")
  return settings
}
