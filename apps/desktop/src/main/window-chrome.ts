import type { BrowserWindowConstructorOptions } from "electron";

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

/**
 * 按平台返回窗口铬层；不含 preload / 窗控 IPC。
 * 侧栏用系统材质；输入卡桌面用不透底混合（亚克力窗上 CSS backdrop-filter 会透到系统材质）。
 */
export function windowChromeFor(platform: string): BrowserWindowConstructorOptions {
  const webPreferences = { ...SECURE_WEB_PREFERENCES };

  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
      vibrancy: "sidebar",
      visualEffectState: "followWindow",
      webPreferences,
    };
  }

  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#00000000", symbolColor: "#7f858f", height: 44 },
      backgroundMaterial: "acrylic",
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences,
    };
  }

  if (platform === "linux") {
    return {
      frame: false,
      transparent: true,
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
