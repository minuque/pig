import { inject, provide, type InjectionKey } from "vue"
import { useRouter } from "vue-router"

export { useGeneralPrefs, notifyTurnDone } from "@features/settings/hooks/use-general-prefs.js"

export type { FontSize, UiLocale } from "@features/settings/hooks/use-general-prefs.js"

export type SettingsContext = {
  openSettings: () => void
}

export const settingsKey: InjectionKey<SettingsContext> = Symbol("settings")

export function provideSettings(): SettingsContext {
  const router = useRouter()

  function openSettings() {
    void router.push({ name: "settings-general" })
  }

  const settings = { openSettings }
  provide(settingsKey, settings)
  return settings
}

export function useSettings(): SettingsContext {
  const settings = inject(settingsKey)

  if (!settings) throw new Error("useSettings() 需要在 provideSettings() 之后调用")
  return settings
}
