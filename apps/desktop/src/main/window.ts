import { BrowserWindow, nativeTheme, type Input } from "electron"
import { stripNativeMenu, windowChromeFor } from "./window-chrome.js"

/** 创建主窗口：先隐藏，ready-to-show 后再显示。 */
export function createMainWindow(preloadPath: string): BrowserWindow {
  const chrome = windowChromeFor(process.platform)
  const window = new BrowserWindow({
    title: "pig",
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#121212" : "#ffffff",
    ...chrome,
    webPreferences: {
      ...chrome.webPreferences,
      preload: preloadPath,
    },
  })

  stripNativeMenu(window)
  stampDesktopPlatform(window)
  attachDevTools(window)
  window.once("ready-to-show", () => {
    window.show()
  })
  return window
}

/** F12 / Ctrl+Shift+I（macOS 为 Cmd+Option+I）开关 DevTools。 */
function attachDevTools(window: BrowserWindow): void {
  window.webContents.on("before-input-event", (event, input) => {
    if (!isToggleDevToolsShortcut(input)) return
    event.preventDefault()
    window.webContents.toggleDevTools()
  })
}

function isToggleDevToolsShortcut(input: Input): boolean {
  if (input.type !== "keyDown") return false
  if (input.key === "F12") return true
  if (input.key.toLowerCase() !== "i") return false
  if (process.platform === "darwin") return Boolean(input.meta && input.alt && !input.control)
  return Boolean(input.control && input.shift && !input.meta)
}

const DESKTOP_PLATFORMS = new Set(["darwin", "win32", "linux"])

/** html 解析会掉 preload 先写的标记，dom-ready 再写一次。 */
function stampDesktopPlatform(window: BrowserWindow): void {
  const platform = process.platform
  if (!DESKTOP_PLATFORMS.has(platform)) return
  const script = `document.documentElement.dataset.pigDesktopPlatform=${JSON.stringify(platform)}`
  window.webContents.on("dom-ready", () => {
    void window.webContents.executeJavaScript(script)
  })
}
