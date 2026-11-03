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

  if (platform === "win32") {
    return {
      // 窗控由页面自画（卡片右上角）；保留 thickFrame 的缩放边框
      titleBarStyle: "hidden",
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences,
    }
  }

  if (platform === "linux") {
    // 无边框窗口在 Linux 上依赖窗口管理器给缩放命中带，实测不可靠（上游 issue 52452、49173），
    // 也丢掉系统阴影与窗口管理器行为；这里保留原生边框，页面内不再自画标题条与窗控。
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
