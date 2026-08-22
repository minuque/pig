import { BrowserWindow, nativeTheme } from "electron";
import { stripNativeMenu, windowChromeFor } from "./window-chrome.js";

/** 创建主窗口：先隐藏，ready-to-show 后再显示。 */
export function createMainWindow(preloadPath: string): BrowserWindow {
  const chrome = windowChromeFor(process.platform);
  const window = new BrowserWindow({
    title: "pig",
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    ...chrome,
    webPreferences: {
      ...chrome.webPreferences,
      preload: preloadPath,
    },
  });
  stripNativeMenu(window);
  window.once("ready-to-show", () => {
    window.show();
  });
  return window;
}
