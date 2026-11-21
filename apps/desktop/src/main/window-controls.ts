import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron"

export function registerWindowControls(getWindow: () => BrowserWindow | undefined): void {
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
}
