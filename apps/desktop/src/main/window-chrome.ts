import type { BrowserWindowConstructorOptions } from "electron";

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

/**
 * 按平台返回窗口铬层；不含 preload / 窗控 IPC。
 * 窗体不透明，好让输入卡/菜单的 CSS backdrop-filter 采到页面而不是壁纸。
 */
export function windowChromeFor(platform: string): BrowserWindowConstructorOptions {
  const webPreferences = { ...SECURE_WEB_PREFERENCES };

  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
      webPreferences,
    };
  }

  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#00000000", symbolColor: "#7f858f", height: 44 },
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences,
    };
  }

  if (platform === "linux") {
    return {
      frame: false,
      webPreferences,
    };
  }

  return { webPreferences };
}

/** 去掉 Electron 默认 File/Edit/View 菜单，避免占出原生标题条。 */
export function stripNativeMenu(window: {
  setMenu(menu: null): void;
  setMenuBarVisibility(visible: boolean): void;
}): void {
  window.setMenu(null);
  window.setMenuBarVisibility(false);
}
