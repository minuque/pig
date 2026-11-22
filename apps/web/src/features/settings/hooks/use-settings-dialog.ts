import { ref, type InjectionKey, type Ref } from "vue"

export type SettingsPane = "general" | "appearance" | "notifications" | "models" | "archive"

export interface SettingsCrumb {
  label: string
  action?: (() => void) | undefined
}

export const SETTINGS_TRAIL: InjectionKey<Ref<SettingsCrumb[]>> = Symbol("settings-trail")
const settingsOpen = ref(false)
const settingsPane = ref<SettingsPane>("general")

export function useSettingsDialog() {
  function openSettings(pane: SettingsPane = "general") {
    settingsPane.value = pane
    settingsOpen.value = true
  }

  function closeSettings() {
    settingsOpen.value = false
    settingsPane.value = "general"
  }

  return { settingsOpen, settingsPane, openSettings, closeSettings }
}
