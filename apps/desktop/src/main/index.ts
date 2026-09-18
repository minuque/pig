import { access } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { ChildProcess } from "node:child_process"
import { app, dialog, Menu, screen, type BrowserWindow } from "electron"

import { handlePigProtocol, registerPigScheme } from "./protocol.js"
import {
  desktopCdpPort,
  gatewayOrigin,
  isDesktopBench,
  isDesktopDev,
  pigAppUrl,
  viteDevOrigin,
} from "./urls.js"
import { killVite, spawnVite, waitForHttp } from "./vite-child.js"
import { createElectronDirectoryPort, type DirectoryPort } from "./directory-port.js"
import { createMainWindow } from "./window.js"
import { resolveWebRoot } from "./paths.js"
import {
  readWindowStateFile,
  restoreWindowFrame,
  windowStatePath,
  writeWindowStateFile,
} from "./window-state.js"

registerPigScheme()

const cdpPort = desktopCdpPort()

if (cdpPort) {
  // 命令行 --remote-debugging-port 在本壳无效，须 ready 前 appendSwitch。
  app.commandLine.appendSwitch("remote-debugging-port", cdpPort)
  app.commandLine.appendSwitch("remote-allow-origins", "*")
}

type GatewayInstance = {
  start(): Promise<number>
  stop(): Promise<void>
}

type GatewayModule = {
  default: new (options: {
    platformPort: DirectoryPort
    webRoot?: string
    sessionDir?: string
    cwd?: string
  }) => GatewayInstance
  canonicalizePath: (path: string) => string
}

function envDir(name: "PIG_SESSION_DIR" | "PIG_CWD"): string | undefined {
  const value = process.env[name]
  return value ? resolve(value) : undefined
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

function onInterrupt(): void {
  if (vite) {
    killVite(vite)
    vite = undefined
  }

  void shutdown()
}

process.once("SIGINT", onInterrupt)

process.once("SIGTERM", onInterrupt)

if (process.platform === "win32") process.once("SIGBREAK", onInterrupt)

process.once("exit", () => {
  if (vite) killVite(vite)
})

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

    const sessionDir = envDir("PIG_SESSION_DIR")
    const cwd = envDir("PIG_CWD")
    gateway = new gatewayMod.default({
      platformPort: createElectronDirectoryPort(
        () => mainWindow,
        (parent, options) =>
          parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options),
        gatewayMod.canonicalizePath,
      ),
      ...(webRoot ? { webRoot } : {}),
      ...(sessionDir ? { sessionDir } : {}),
      ...(cwd ? { cwd } : {}),
    })
    const port = await gateway.start()
    const httpOrigin = gatewayOrigin(port)

    if (isDev) {
      vite = spawnVite({ GATEWAY_TARGET: httpOrigin })
      await waitForHttp(viteDevOrigin())
    } else {
      if (!webRoot) throw new Error("桌面壳缺少 Web 资源")
      handlePigProtocol(httpOrigin, webRoot)
    }

    const stateFile = windowStatePath(app.getPath("userData"))
    const displays = screen.getAllDisplays().map((display) => display.bounds)
    const frame = restoreWindowFrame(readWindowStateFile(stateFile), displays)
    mainWindow = createMainWindow(preloadPath, {
      ...(isDev ? {} : { gatewayOrigin: httpOrigin }),
      frame,
      persistState: (state) => writeWindowStateFile(stateFile, state),
    })

    const origin = isDev ? viteDevOrigin() : pigAppUrl()
    process.env.PIG_GATEWAY_ORIGIN = origin
    await mainWindow.loadURL(isDesktopBench() ? "about:blank" : origin)
  } catch (error) {
    dialog.showErrorBox("无法启动", error instanceof Error ? error.message : String(error))
    await shutdown()
  }
})
