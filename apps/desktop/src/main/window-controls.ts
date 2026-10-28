import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron"

import { applyWindowMaterial } from "./window-material.js"

/** 自画窗控的 IPC。只接受主窗口自己的 sender，别让未知页面操纵窗口。 */
export function registerWindowControls(
  getWindow: () => BrowserWindow | undefined,
  onTranslucentChange?: (on: boolean) => void,
): void {
  const owned = (event: IpcMainEvent | IpcMainInvokeEvent) => {
    const window = getWindow()

    if (!window || window.isDestroyed() || event.sender !== window.webContents) return undefined
    return window
  }

  ipcMain.on("pig:window:minimize", (event) => owned(event)?.minimize())

  ipcMain.on("pig:window:toggle-maximize", (event) => {
    const window = owned(event)

    if (!window) return

    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.on("pig:window:close", (event) => owned(event)?.close())

  ipcMain.handle("pig:window:is-maximized", (event) => owned(event)?.isMaximized() ?? false)

  ipcMain.on("pig:window:set-translucent", (event, value) => {
    const window = owned(event)

    if (!window) return
    const on = value === true
    applyWindowMaterial(window, process.platform, on)
    onTranslucentChange?.(on)
  })
}
