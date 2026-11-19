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
      // 红绿灯在 44px 条带里竖直居中（12px 高）
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences,
    }
  }

  // Windows 藏起标题条，窗控由页面画；thickFrame 保住贴边缩放与 Aero Snap，roundedCorners 保住系统圆角。
  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences,
    }
  }

  // Linux 去掉系统边框，窗控由页面画。
  if (platform === "linux") {
    return { frame: false, webPreferences }
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
