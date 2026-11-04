import { ipcMain, type BrowserWindow, type IpcMainEvent } from "electron"

import { applyWindowMaterial } from "./window-material.js"

/** 半透明窗口的 IPC。只接受主窗口自己的 sender，别让未知页面操纵窗口。 */
export function registerWindowMaterial(
  getWindow: () => BrowserWindow | undefined,
  onTranslucentChange?: (on: boolean) => void,
): void {
  ipcMain.on("pig:window:set-translucent", (event: IpcMainEvent, value: unknown) => {
    const window = getWindow()

    if (!window || window.isDestroyed() || event.sender !== window.webContents) return
    const on = value === true
    applyWindowMaterial(window, process.platform, on)
    onTranslucentChange?.(on)
  })
}
