import { BrowserWindow, nativeTheme, type Input } from "electron"

import { gatewayOriginArg } from "./urls.js"
import { stripNativeMenu, windowChromeFor } from "./window-chrome.js"
import {
  DEFAULT_WINDOW_SIZE,
  captureWindowState,
  type WindowFrame,
  type WindowState,
} from "./window-state.js"

const SAVE_DEBOUNCE_MS = 300

export type CreateMainWindowOptions = {
  gatewayOrigin?: string
  frame?: WindowFrame
  persistState?: (state: WindowState) => void
}

/** 创建主窗口：先隐藏，ready-to-show 后再显示。 */
export function createMainWindow(
  preloadPath: string,
  options: CreateMainWindowOptions = {},
): BrowserWindow {
  const chrome = windowChromeFor(process.platform)
  const frame = options.frame ?? { ...DEFAULT_WINDOW_SIZE, isMaximized: false }
  const window = new BrowserWindow({
    title: "pig",
    width: frame.width,
    height: frame.height,
    ...(frame.x !== undefined && frame.y !== undefined ? { x: frame.x, y: frame.y } : {}),
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#121212" : "#ffffff",
    ...chrome,
    webPreferences: {
      ...chrome.webPreferences,
      preload: preloadPath,
      ...(options.gatewayOrigin
        ? { additionalArguments: [gatewayOriginArg(options.gatewayOrigin)] }
        : {}),
    },
  })

  stripNativeMenu(window)
  stampDesktopPlatform(window)
  attachDevTools(window)

  if (options.persistState) persistWindowState(window, options.persistState)
  window.once("ready-to-show", () => {
    if (frame.isMaximized) window.maximize()
    window.show()
  })
  return window
}

/** resize/move 节流写入；close 再刷一次。 */
function persistWindowState(
  window: BrowserWindow,
  persistState: (state: WindowState) => void,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined

    if (window.isDestroyed()) return
    persistState(captureWindowState(window))
  }
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }

  window.on("resize", schedule)
  window.on("move", schedule)
  window.on("close", flush)
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
