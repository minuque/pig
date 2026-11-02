import { beforeEach, describe, expect, it } from "vitest"

import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"

describe("use settings dialog", () => {
  const settings = useSettingsDialog()

  beforeEach(() => {
    settings.closeSettings()
  })

  it("openSettings 打开并定位到指定分区", () => {
    settings.openSettings("models")

    expect(settings.settingsOpen.value).toBe(true)
    expect(settings.settingsPane.value).toBe("models")
  })

  it("关闭后复位到通用分区", () => {
    settings.openSettings("models")
    settings.closeSettings()

    expect(settings.settingsOpen.value).toBe(false)
    expect(settings.settingsPane.value).toBe("general")
  })
})
