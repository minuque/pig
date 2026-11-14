import { ref, type InjectionKey, type Ref } from "vue"

export type SettingsPane = "general" | "appearance" | "notifications" | "models"

/** 分区内的下钻路径，由当前 pane 写回，弹框头部统一渲染。 */
export interface SettingsCrumb {
  label: string
  action?: (() => void) | undefined
}

export const SETTINGS_TRAIL: InjectionKey<Ref<SettingsCrumb[]>> = Symbol("settings-trail")
/** 设置弹框的全局开关：任何分区都能直接打开指定 tab。 */
const settingsOpen = ref(false)
const settingsPane = ref<SettingsPane>("general")

export function useSettingsDialog() {
  function openSettings(pane: SettingsPane = "general") {
    settingsPane.value = pane
    settingsOpen.value = true
  }

  /** 关闭后复位到通用分区，下次普通打开仍从默认页开始。 */
  function closeSettings() {
    settingsOpen.value = false
    settingsPane.value = "general"
  }

  return { settingsOpen, settingsPane, openSettings, closeSettings }
}
