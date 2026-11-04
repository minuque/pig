import type { BrowserWindowConstructorOptions } from "electron"

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const

/** 按平台返回窗口铬层；不含 preload / 窗控 IPC。 */
export function windowChromeFor(platform: string): BrowserWindowConstructorOptions {
  const webPreferences = { ...SECURE_WEB_PREFERENCES }

  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
      webPreferences,
    }
  }

  // Windows 与 Linux 都走原生边框与窗控：Windows 无边框窗口的缩放命中带要自己补，
  // Linux 上窗口管理器行为、系统阴影也会一起丢；页面内不再自画标题条。
  if (platform === "win32" || platform === "linux") {
    return { frame: true, webPreferences }
  }

  return { webPreferences }
}

/** 去掉 Electron 默认 File/Edit/View 菜单，避免占出原生标题条。 */
export function stripNativeMenu(window: {
  setMenu(menu: null): void
  setMenuBarVisibility(visible: boolean): void
}): void {
  window.setMenu(null)
  window.setMenuBarVisibility(false)
}
