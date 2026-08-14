import { BrowserWindow } from "electron";

/** 创建主窗口：先隐藏，ready-to-show 后再显示。 */
export function createMainWindow(preloadPath: string): BrowserWindow {
  const window = new BrowserWindow({
    title: "pig",
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  return window;
}
