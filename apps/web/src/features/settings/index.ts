import { inject, provide, ref, type InjectionKey, type Ref } from "vue"

export { useGeneralPrefs, notifyTurnDone } from "@features/settings/hooks/use-general-prefs.js"

export type { FontSize, UiLocale } from "@features/settings/hooks/use-general-prefs.js"

export type SettingsTab = "general" | "usage" | "skills" | "extensions"

export type SettingsContext = {
  tab: Ref<SettingsTab>
  openSettings: () => void
}

export const settingsKey: InjectionKey<SettingsContext> = Symbol("settings")

export function provideSettings(): SettingsContext {
  const tab = ref<SettingsTab>("general")

  function openSettings() {
    tab.value = "general"
    void import("@router/index.js").then((module) => module.default.push({ name: "settings" }))
  }

  const settings = { tab, openSettings }
  provide(settingsKey, settings)
  return settings
}

export function useSettings(): SettingsContext {
  const settings = inject(settingsKey)

  if (!settings) throw new Error("useSettings() 需要在 provideSettings() 之后调用")
  return settings
}
