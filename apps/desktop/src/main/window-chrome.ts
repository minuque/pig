import type { BrowserWindowConstructorOptions } from "electron"

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const

export function windowChromeFor(platform: string): BrowserWindowConstructorOptions {
  const webPreferences = { ...SECURE_WEB_PREFERENCES }

  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences,
    }
  }

  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences,
    }
  }

  if (platform === "linux") {
    return { frame: false, webPreferences }
  }

  return { webPreferences }
}

export function stripNativeMenu(window: {
  setMenu(menu: null): void
  setMenuBarVisibility(visible: boolean): void
}): void {
  window.setMenu(null)
  window.setMenuBarVisibility(false)
}
