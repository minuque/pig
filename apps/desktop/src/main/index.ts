import { access } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ChildProcess } from "node:child_process"
import { app, dialog, Menu, type BrowserWindow } from "electron"

import { VITE_DEV_ORIGIN, appUrl, gatewayOrigin, isDesktopDev } from "./urls.js"
import { killVite, spawnVite, waitForHttp } from "./vite-child.js"
import { createElectronDirectoryPort, type DirectoryPort } from "./directory-port.js"
import { createMainWindow } from "./window.js"
import { resolveWebRoot } from "./paths.js"

type GatewayInstance = {
  start(): Promise<number>
  stop(): Promise<void>
}

type GatewayModule = {
  default: new (options: { platformPort: DirectoryPort; webRoot?: string }) => GatewayInstance
  canonicalizePath: (path: string) => string
}

let gateway: GatewayInstance | undefined
let vite: ChildProcess | undefined
let mainWindow: BrowserWindow | undefined
let stopping = false

async function loadGatewayModule(isPackaged: boolean): Promise<GatewayModule> {
  if (isPackaged) {
    // 非字面量，避免 tsc emit 把 gateway 源码拉进 rootDir
    const spec = "@pig/gateway"
    return (await import(spec)) as GatewayModule
  }
  // exports 指向 dist，开发时可能没有
  const url = new URL("../../../../packages/gateway/src/index.js", import.meta.url).href
  return (await import(url)) as GatewayModule
}

async function shutdown(): Promise<void> {
  if (stopping) return
  stopping = true
  if (vite) killVite(vite)
  vite = undefined
  try {
    await gateway?.stop()
  } finally {
    gateway = undefined
    app.quit()
  }
}

app.on("window-all-closed", () => {
  // 单窗口本地工具：关窗必须释放端口，darwin 也退出
  void shutdown()
})

app.on("before-quit", (event) => {
  if (stopping) return
  event.preventDefault()
  void shutdown()
})

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  try {
    const isDev = isDesktopDev()
    const isPackaged = app.isPackaged
    const gatewayMod = await loadGatewayModule(isPackaged)
    const webRoot = resolveWebRoot(isDev, isPackaged, import.meta.url, process.resourcesPath)
    const preloadPath = fileURLToPath(new URL("../preload/index.js", import.meta.url))

    if (webRoot) {
      try {
        await access(webRoot)
      } catch {
        dialog.showErrorBox(
          "无法启动",
          isPackaged
            ? "安装包资源缺失。"
            : "未找到 Web 构建产物（apps/web/dist）。请先执行 pnpm --filter @pig/web build。",
        )
        await shutdown()
        return
      }
    }

    gateway = new gatewayMod.default({
      platformPort: createElectronDirectoryPort(
        () => mainWindow,
        (parent, options) =>
          parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options),
        gatewayMod.canonicalizePath,
      ),
      ...(webRoot ? { webRoot } : {}),
    })
    const port = await gateway.start()

    if (isDev) {
      vite = spawnVite({ GATEWAY_TARGET: gatewayOrigin(port) })
      await waitForHttp(VITE_DEV_ORIGIN)
    }

    mainWindow = createMainWindow(preloadPath)

    await mainWindow.loadURL(
      appUrl(isDev ? VITE_DEV_ORIGIN : gatewayOrigin(port), process.platform),
    )
  } catch (error) {
    dialog.showErrorBox("无法启动", error instanceof Error ? error.message : String(error))
    await shutdown()
  }
})
